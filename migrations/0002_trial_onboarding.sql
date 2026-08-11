CREATE TABLE IF NOT EXISTS trial_applications (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  phone TEXT NOT NULL,
  prefecture TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'cancelled')),
  token_hash TEXT NOT NULL,
  token_expires_at TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  tenant_id TEXT,
  created_at TEXT NOT NULL,
  verified_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_applications_email
  ON trial_applications (email);

CREATE INDEX IF NOT EXISTS idx_trial_applications_status_created
  ON trial_applications (status, created_at);

CREATE INDEX IF NOT EXISTS idx_trial_applications_fingerprint_created
  ON trial_applications (request_fingerprint, created_at);

CREATE TABLE IF NOT EXISTS production_requests (
  tenant_id TEXT PRIMARY KEY,
  applicant_name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'declined', 'cancelled')),
  terms_version TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_requests_status_requested
  ON production_requests (status, requested_at);

CREATE TABLE IF NOT EXISTS email_events (
  event_key TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  recipient TEXT NOT NULL COLLATE NOCASE,
  tenant_id TEXT,
  application_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_message_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_events_tenant_type
  ON email_events (tenant_id, event_type);
