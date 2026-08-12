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
  status TEXT NOT NULL DEFAULT 'unconfirmed'
    CHECK (status IN ('unconfirmed','consulting','sitePlanned','inspected','quoted','ordered','completed','onHold','cancelled')),
  assignee TEXT NOT NULL DEFAULT '',
  internal_memo TEXT NOT NULL DEFAULT '',
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending','sent','failed')),
  received_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, case_number),
  UNIQUE (tenant_id, client_submission_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_inquiries_tenant_received
  ON vendor_inquiries (tenant_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_inquiries_tenant_status
  ON vendor_inquiries (tenant_id, status, received_at DESC);
