CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  vendor_email TEXT NOT NULL COLLATE NOCASE,
  settings_json TEXT NOT NULL,
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
