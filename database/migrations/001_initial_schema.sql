-- Digital ABD — Initial Schema (Phase 1 MVP)
-- PostgreSQL 16 + PostGIS 3.4

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ---------------------------------------------------------------------------
-- Organizations & Users (Multi-tenancy)
-- ---------------------------------------------------------------------------

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    tier            TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard', 'professional', 'enterprise')),
    data_region     TEXT NOT NULL DEFAULT 'ap-south-1',
    retention_years INTEGER NOT NULL DEFAULT 10,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_units (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    cost_center     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN (
        'field_engineer', 'site_supervisor', 'inspector_oic', 'gis_engineer',
        'noc_operator', 'program_manager', 'auditor', 'vendor_admin',
        'enterprise_admin', 'system_admin'
    )),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, email)
);

-- ---------------------------------------------------------------------------
-- Projects & Routes
-- ---------------------------------------------------------------------------

CREATE TABLE projects (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    business_unit_id    UUID REFERENCES business_units(id) ON DELETE SET NULL,
    name                TEXT NOT NULL,
    client_name         TEXT,
    vendor_name         TEXT,
    project_type        TEXT NOT NULL DEFAULT 'urban' CHECK (project_type IN ('urban', 'rural', 'hdd_heavy', 'mixed')),
    status              TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
    design_route_ref    TEXT,
    start_date          DATE,
    end_date            DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE routes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    total_length_km NUMERIC(10, 3),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'signed_off')),
    centerline      GEOMETRY(LINESTRING, 4326),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE segments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    route_id        UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    chainage_start  NUMERIC(10, 2) NOT NULL,
    chainage_end    NUMERIC(10, 2) NOT NULL,
    surface_type    TEXT CHECK (surface_type IN ('road', 'shoulder', 'rural', 'urban', 'highway', 'railway')),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'approved', 'signed_off')),
    completeness    NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (chainage_end > chainage_start)
);

-- ---------------------------------------------------------------------------
-- Field Capture Records
-- ---------------------------------------------------------------------------

CREATE TABLE survey_points (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    segment_id      UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    location        GEOMETRY(POINT, 4326) NOT NULL,
    altitude_m      NUMERIC(8, 3),
    accuracy_m      NUMERIC(6, 2),
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE trench_records (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    segment_id              UUID NOT NULL UNIQUE REFERENCES segments(id) ON DELETE CASCADE,
    depth_m                 NUMERIC(5, 2) NOT NULL,
    width_m                 NUMERIC(5, 2),
    bedding_type            TEXT,
    reinstatement_status    TEXT NOT NULL DEFAULT 'pending' CHECK (reinstatement_status IN ('pending', 'in_progress', 'completed')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE duct_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    segment_id          UUID NOT NULL UNIQUE REFERENCES segments(id) ON DELETE CASCADE,
    duct_type           TEXT NOT NULL CHECK (duct_type IN ('HDPE', 'DWC', 'RCC')),
    diameter_mm         NUMERIC(6, 1),
    duct_count          INTEGER NOT NULL DEFAULT 1,
    protection_method   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hdd_crossings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    segment_id      UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    entry_point     GEOMETRY(POINT, 4326) NOT NULL,
    exit_point      GEOMETRY(POINT, 4326) NOT NULL,
    bore_length_m   NUMERIC(10, 2) NOT NULL,
    depth_m         NUMERIC(5, 2),
    pipe_spec       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cable_lay_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    segment_id      UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    manufacturer    TEXT,
    core_count      INTEGER NOT NULL,
    sheath_type     TEXT,
    drum_number     TEXT,
    laid_length_m   NUMERIC(10, 2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE joint_closures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    segment_id      UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    location        GEOMETRY(POINT, 4326) NOT NULL,
    closure_type    TEXT NOT NULL,
    splice_count    INTEGER NOT NULL DEFAULT 0,
    technician_id   UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE otdr_tests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    closure_id      UUID NOT NULL REFERENCES joint_closures(id) ON DELETE CASCADE,
    file_ref        TEXT NOT NULL,
    file_checksum   TEXT,
    result_summary  JSONB,
    test_date       TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crossings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    segment_id          UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    crossing_type       TEXT NOT NULL CHECK (crossing_type IN ('railway', 'highway', 'canal', 'river', 'culvert', 'bridge', 'utility')),
    protection_measure  TEXT,
    approval_ref        TEXT,
    location            GEOMETRY(POINT, 4326),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE photo_evidence (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    segment_id          UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    linked_entity_type  TEXT,
    linked_entity_id    UUID,
    phase               TEXT NOT NULL CHECK (phase IN ('before', 'during', 'after')),
    file_ref            TEXT NOT NULL,
    file_checksum       TEXT NOT NULL,
    location            GEOMETRY(POINT, 4326),
    captured_at         TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Compliance & Workflow
-- ---------------------------------------------------------------------------

CREATE TABLE deviations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    segment_id      UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    category        TEXT NOT NULL,
    description     TEXT NOT NULL,
    justification   TEXT,
    severity        TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending_approval', 'approved', 'rejected')),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE approval_actions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    deviation_id    UUID NOT NULL REFERENCES deviations(id) ON DELETE CASCADE,
    actor_id        UUID NOT NULL REFERENCES users(id),
    decision        TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'returned')),
    comments        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Audit Log
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID REFERENCES organizations(id),
    entity_type     TEXT NOT NULL,
    entity_id       UUID,
    action          TEXT NOT NULL,
    actor_id        UUID REFERENCES users(id),
    actor_email     TEXT,
    ip_address      INET,
    before_state    JSONB,
    after_state     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Row-Level Security (Multi-tenant isolation)
-- ---------------------------------------------------------------------------

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE trench_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE duct_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hdd_crossings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cable_lay_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE otdr_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE crossings ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE deviations ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;

-- App sets: SET app.current_org_id = '<uuid>';
CREATE OR REPLACE FUNCTION current_org_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_org_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE POLICY tenant_isolation ON organizations
    USING (id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON business_units
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON users
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON projects
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON routes
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON segments
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON survey_points
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON trench_records
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON duct_records
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON hdd_crossings
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON cable_lay_records
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON joint_closures
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON otdr_tests
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON crossings
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON photo_evidence
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON deviations
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON approval_actions
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_projects_org ON projects(org_id);
CREATE INDEX idx_routes_project ON routes(project_id);
CREATE INDEX idx_routes_org ON routes(org_id);
CREATE INDEX idx_segments_route ON segments(route_id);
CREATE INDEX idx_segments_org ON segments(org_id);
CREATE INDEX idx_segments_status ON segments(status);
CREATE INDEX idx_survey_points_segment ON survey_points(segment_id);
CREATE INDEX idx_joint_closures_segment ON joint_closures(segment_id);
CREATE INDEX idx_photo_evidence_segment ON photo_evidence(segment_id);
CREATE INDEX idx_deviations_segment ON deviations(segment_id);
CREATE INDEX idx_deviations_status ON deviations(status);
CREATE INDEX idx_audit_logs_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_routes_centerline_gist ON routes USING GIST(centerline);
CREATE INDEX idx_joint_closures_location_gist ON joint_closures USING GIST(location);

-- ---------------------------------------------------------------------------
-- Seed Data (Development)
-- ---------------------------------------------------------------------------

INSERT INTO organizations (id, name, tier) VALUES
    ('a0000000-0000-4000-8000-000000000001', 'Demo Telecom Ltd', 'enterprise'),
    ('a0000000-0000-4000-8000-000000000002', 'Second Demo Operator', 'standard');

INSERT INTO users (id, org_id, email, full_name, role) VALUES
    ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin@demo.telecom', 'Demo Admin', 'enterprise_admin'),
    ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'engineer@demo.telecom', 'Field Engineer', 'field_engineer'),
    ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'oic@demo.telecom', 'Inspector OIC', 'inspector_oic'),
    ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'engineer2@demo.telecom', 'Field Engineer 2', 'field_engineer');

INSERT INTO projects (id, org_id, name, client_name, vendor_name, project_type, status) VALUES
    ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'City Fiber Ring Phase 1', 'State Broadband Board', 'OFC Vendor A', 'urban', 'active'),
    ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Second Operator Pilot', 'Railways', 'OFC Vendor B', 'rural', 'active');

INSERT INTO routes (id, org_id, project_id, name, total_length_km, status) VALUES
    ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Ring Segment North', 12.5, 'in_progress'),
    ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Pilot Route', 3.1, 'in_progress');
