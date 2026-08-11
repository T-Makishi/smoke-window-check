ALTER TABLE tenants ADD COLUMN license_type TEXT NOT NULL DEFAULT 'trial'
  CHECK (license_type IN ('trial', 'production'));

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
