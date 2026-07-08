-- Digital ABD — Phase 4 gap closure
-- Covers FR-006, FR-010, FR-021, FR-032, FR-041, FR-042 uplift

CREATE TABLE project_workflow_configs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    approval_chain      TEXT[] NOT NULL DEFAULT ARRAY['site_supervisor', 'inspector_oic'],
    updated_by          UUID REFERENCES users(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE deviations
    ADD COLUMN IF NOT EXISTS approval_chain TEXT[] NOT NULL DEFAULT ARRAY['site_supervisor', 'inspector_oic'],
    ADD COLUMN IF NOT EXISTS approval_stage_index INTEGER NOT NULL DEFAULT 0;

CREATE TABLE record_versions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type         TEXT NOT NULL,
    entity_id           UUID NOT NULL,
    version_number      INTEGER NOT NULL,
    changed_by          UUID REFERENCES users(id),
    changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_reason       TEXT,
    before_state        JSONB,
    after_state         JSONB,
    UNIQUE (org_id, entity_type, entity_id, version_number)
);

CREATE TABLE project_checklist_configs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_type        TEXT NOT NULL,
    required_items      TEXT[] NOT NULL,
    updated_by          UUID REFERENCES users(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, project_type)
);

ALTER TABLE project_workflow_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_checklist_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON project_workflow_configs
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON record_versions
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON project_checklist_configs
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE INDEX idx_workflow_configs_org_project ON project_workflow_configs(org_id, project_id);
CREATE INDEX idx_record_versions_entity ON record_versions(org_id, entity_type, entity_id, changed_at DESC);
CREATE INDEX idx_project_checklist_configs_org_type ON project_checklist_configs(org_id, project_type);

-- Seed default workflow config for demo project
INSERT INTO project_workflow_configs (org_id, project_id, approval_chain, updated_by)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  ARRAY['site_supervisor', 'inspector_oic'],
  'b0000000-0000-4000-8000-000000000001'
)
ON CONFLICT (project_id) DO NOTHING;

INSERT INTO project_checklist_configs (org_id, project_type, required_items, updated_by)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'urban', ARRAY['trench', 'duct', 'photos', 'cable'], 'b0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', 'hdd_heavy', ARRAY['trench', 'duct', 'photos', 'cable', 'hdd_crossing'], 'b0000000-0000-4000-8000-000000000001')
ON CONFLICT (org_id, project_type) DO NOTHING;
