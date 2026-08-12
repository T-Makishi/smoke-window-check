CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  vendor_email TEXT NOT NULL COLLATE NOCASE,
  settings_json TEXT NOT NULL,
  license_type TEXT NOT NULL DEFAULT 'trial' CHECK (license_type IN ('trial', 'production')),
  trial_days INTEGER NOT NULL CHECK (trial_days IN (7, 14, 30)),
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_vendor_email
  ON tenants (vendor_email);

CREATE INDEX IF NOT EXISTS idx_tenants_status_expires
  ON tenants (status, expires_at);

CREATE TABLE IF NOT EXISTS auth_credentials (
  subject TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  passcode_salt TEXT NOT NULL,
  passcode_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (subject, email)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (subject, email) REFERENCES auth_credentials(subject, email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_credentials_email
  ON auth_credentials (email);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_subject_expires
  ON auth_sessions (subject, expires_at);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_applications_email ON trial_applications (email);
CREATE INDEX IF NOT EXISTS idx_trial_applications_status_created ON trial_applications (status, created_at);
CREATE INDEX IF NOT EXISTS idx_trial_applications_fingerprint_created ON trial_applications (request_fingerprint, created_at);

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

CREATE INDEX IF NOT EXISTS idx_production_requests_status_requested ON production_requests (status, requested_at);

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

CREATE INDEX IF NOT EXISTS idx_email_events_tenant_type ON email_events (tenant_id, event_type);

CREATE TABLE IF NOT EXISTS service_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_email_changes (
  id TEXT PRIMARY KEY,
  current_email TEXT NOT NULL COLLATE NOCASE,
  new_email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','expired','cancelled')),
  created_at TEXT NOT NULL,
  confirmed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_service_email_changes_status ON service_email_changes (status, expires_at);

CREATE TABLE IF NOT EXISTS vendor_inquiries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  case_number TEXT NOT NULL,
  client_submission_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL,
  site_address TEXT NOT NULL,
  site_name TEXT NOT NULL DEFAULT '',
  symptom_summary TEXT NOT NULL DEFAULT '',
  urgency TEXT NOT NULL DEFAULT '',
  estimate_min INTEGER NOT NULL DEFAULT 0,
  estimate_max INTEGER NOT NULL DEFAULT 0,
  media_count INTEGER NOT NULL DEFAULT 0,
  media_names_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (status IN ('unconfirmed','consulting','sitePlanned','inspected','quoted','ordered','completed','onHold','cancelled')),
  assignee TEXT NOT NULL DEFAULT '',
  internal_memo TEXT NOT NULL DEFAULT '',
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed')),
  received_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, case_number),
  UNIQUE (tenant_id, client_submission_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_inquiries_tenant_received ON vendor_inquiries (tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_inquiries_tenant_status ON vendor_inquiries (tenant_id, status, received_at DESC);
