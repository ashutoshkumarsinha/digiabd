-- Digital ABD — Phase 3 Migration
-- Resilience, GIS exports, ETL jobs, CAD artifacts

CREATE TABLE etl_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    route_id        UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    job_type        TEXT NOT NULL CHECK (job_type IN ('gis_layer_refresh', 'cad_generation', 'data_quality_scan')),
    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    requested_by    UUID REFERENCES users(id),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    output_ref      TEXT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gis_layers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    route_id        UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    layer_type      TEXT NOT NULL CHECK (layer_type IN ('centerline', 'segments', 'closures', 'crossings')),
    feature_count   INTEGER NOT NULL DEFAULT 0,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by    UUID REFERENCES users(id),
    metadata        JSONB
);

CREATE TABLE cad_artifacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    route_id        UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    format          TEXT NOT NULL CHECK (format IN ('dxf', 'dwg', 'json')),
    file_ref        TEXT NOT NULL,
    file_checksum   TEXT NOT NULL,
    generated_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE etl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gis_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON etl_jobs
    USING (org_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY tenant_isolation ON gis_layers
    USING (org_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY tenant_isolation ON cad_artifacts
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE INDEX idx_etl_jobs_org_route ON etl_jobs(org_id, route_id, created_at DESC);
CREATE INDEX idx_gis_layers_org_route ON gis_layers(org_id, route_id, generated_at DESC);
CREATE INDEX idx_cad_artifacts_org_route ON cad_artifacts(org_id, route_id, created_at DESC);
