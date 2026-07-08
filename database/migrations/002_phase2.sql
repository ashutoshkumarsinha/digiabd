-- Digital ABD — Phase 2 Migration
-- Webhooks, idempotency, sync batches, notifications, asset master

CREATE TABLE webhook_subscriptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    secret          TEXT NOT NULL,
    events          TEXT[] NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE idempotency_keys (
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    request_path    TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_body   JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    PRIMARY KEY (org_id, idempotency_key)
);

CREATE TABLE sync_batches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    device_id       TEXT,
    status          TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'partial', 'failed')),
    item_count      INTEGER NOT NULL DEFAULT 0,
    success_count   INTEGER NOT NULL DEFAULT 0,
    error_count     INTEGER NOT NULL DEFAULT 0,
    errors          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    channel         TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms')),
    event_type      TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_master (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    asset_type      TEXT NOT NULL CHECK (asset_type IN ('cable_drum', 'duct', 'closure', 'other')),
    serial_number   TEXT NOT NULL,
    manufacturer    TEXT,
    specifications  JSONB,
    warranty_expiry DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, serial_number)
);

CREATE TABLE integration_endpoints (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    system_type     TEXT NOT NULL CHECK (system_type IN ('scm', 'noc', 'itsm', 'cmdb')),
    name            TEXT NOT NULL,
    base_url        TEXT NOT NULL,
    credentials_ref TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON webhook_subscriptions
    USING (org_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY tenant_isolation ON notifications
    USING (org_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY tenant_isolation ON asset_master
    USING (org_id = current_org_id() OR current_org_id() IS NULL);
CREATE POLICY tenant_isolation ON integration_endpoints
    USING (org_id = current_org_id() OR current_org_id() IS NULL);

CREATE INDEX idx_webhooks_org ON webhook_subscriptions(org_id) WHERE is_active = TRUE;
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_asset_master_org ON asset_master(org_id);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX idx_sync_batches_user ON sync_batches(user_id, created_at DESC);

-- Seed demo webhook for NOC integration testing
INSERT INTO webhook_subscriptions (org_id, name, url, secret, events) VALUES
    ('a0000000-0000-4000-8000-000000000001', 'NOC Dev Webhook', 'http://host.docker.internal:3099/webhooks/abd', 'dev-webhook-secret', ARRAY['abd.segment.completed', 'abd.deviation.created']);

INSERT INTO integration_endpoints (org_id, system_type, name, base_url) VALUES
    ('a0000000-0000-4000-8000-000000000001', 'scm', 'Demo SCM', 'http://host.docker.internal:3098/api');
