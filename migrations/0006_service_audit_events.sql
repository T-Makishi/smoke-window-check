CREATE TABLE IF NOT EXISTS service_audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('vendor_login_email_limit_reset','vendor_passcode_lock_reset')),
  actor_email TEXT NOT NULL COLLATE NOCASE,
  tenant_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_audit_events_tenant_type_created
  ON service_audit_events (tenant_id, event_type, created_at DESC);
