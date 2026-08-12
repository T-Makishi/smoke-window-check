CREATE TABLE IF NOT EXISTS billing_subscriptions (
  tenant_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe')),
  provider_customer_id TEXT UNIQUE,
  provider_subscription_id TEXT UNIQUE,
  plan_code TEXT NOT NULL DEFAULT '' CHECK (plan_code IN ('', 'monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'none'
    CHECK (status IN ('none','checkout_pending','trialing','active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused')),
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0,1)),
  current_period_start TEXT,
  current_period_end TEXT,
  grace_ends_at TEXT,
  canceled_at TEXT,
  ended_at TEXT,
  last_payment_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
  ON billing_subscriptions (status, current_period_end);

CREATE TABLE IF NOT EXISTS contract_acceptances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('monthly','annual')),
  amount_yen INTEGER NOT NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  commerce_version TEXT NOT NULL,
  accepted_email TEXT NOT NULL COLLATE NOCASE,
  request_fingerprint TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contract_acceptances_tenant_at
  ON contract_acceptances (tenant_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  tenant_id TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','processed','ignored','failed')),
  error_message TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL,
  processed_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_tenant_received
  ON billing_webhook_events (tenant_id, received_at DESC);
