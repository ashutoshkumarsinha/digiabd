-- Digital ABD — Phase 4 Migration
-- Governance: SLA metrics, compliance reports, escalations, fault events

CREATE TABLE escalation_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    trigger_type    TEXT NOT NULL CHECK (trigger_type IN (
        'completeness_below', 'open_deviations', 'sla_breach', 'approval_overdue'
    )),
    threshold       NUMERIC(10, 2) NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    notify_roles    TEXT[] NOT NULL DEFAULT ARRAY['program_manager'],
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE escalation_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id         UUID REFERENCES escalation_rules(id) ON DELETE SET NULL,
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    route_id        UUID REFERENCES routes(id) ON DELETE SET NULL,
    trigger_type    TEXT NOT NULL,
    severity        TEXT NOT NULL,
    message         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE TABLE sla_metric_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    metric_name     TEXT NOT NULL,
    metric_value    NUMERIC(12, 4) NOT NULL,
    target_value    NUMERIC(12, 4),
    unit            TEXT,
    snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE compliance_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    route_id        UUID REFERENCES routes(id) ON DELETE CASCADE,
    report_type     TEXT NOT NULL CHECK (report_type IN ('segment', 'route', 'project')),
    entity_id       UUID NOT NULL,
    passed_count    INTEGER NOT NULL DEFAULT 0,
    failed_count    INTEGER NOT NULL DEFAULT 0,
    total_checks    INTEGER NOT NULL DEFAULT 0,
    details         JSONB NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by    UUID REFERENCES users(id)
);

CREATE TABLE fault_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    route_id        UUID REFERENCES routes(id) ON DELETE SET NULL,
    segment_id      UUID REFERENCES segments(id) ON DELETE SET NULL,
    reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    fault_type      TEXT,
    chainage        NUMERIC(10, 2),
    mttr_minutes    NUMERIC(10, 2),
    metadata        JSONB
);

CREATE TABLE audit_exports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    route_id        UUID REFERENCES routes(id) ON DELETE CASCADE,
    export_type     TEXT NOT NULL DEFAULT 'audit_package',
    file_ref        TEXT,
    record_count    INTEGER NOT NULL DEFAULT 0,
    generated_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE fault_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON escalation_rules
    USING (org_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY tenant_isolation ON escalation_events
    USING (org_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY tenant_isolation ON sla_metric_snapshots
    USING (org_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY tenant_isolation ON compliance_reports
    USING (org_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY tenant_isolation ON fault_events
    USING (org_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY tenant_isolation ON audit_exports
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE INDEX idx_escalation_events_org_status ON escalation_events(org_id, status, created_at DESC);
CREATE INDEX idx_sla_snapshots_project ON sla_metric_snapshots(org_id, project_id, snapshot_at DESC);
CREATE INDEX idx_compliance_reports_entity ON compliance_reports(org_id, entity_id);
CREATE INDEX idx_fault_events_route ON fault_events(org_id, route_id, reported_at DESC);

-- Seed default escalation rules for demo org
INSERT INTO escalation_rules (org_id, name, trigger_type, threshold, severity, notify_roles) VALUES
    ('a0000000-0000-4000-8000-000000000001', 'Low ABD Completeness', 'completeness_below', 80, 'high', ARRAY['program_manager', 'site_supervisor']),
    ('a0000000-0000-4000-8000-000000000001', 'Open Deviations Threshold', 'open_deviations', 3, 'medium', ARRAY['inspector_oic', 'program_manager']);

-- Seed sample fault events for MTTR demo
INSERT INTO fault_events (org_id, route_id, fault_type, chainage, reported_at, resolved_at, mttr_minutes) VALUES
    ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'fiber_cut', 2500, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days' + INTERVAL '4 hours', 240),
    ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'splice_failure', 5100, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days' + INTERVAL '2 hours', 120);
