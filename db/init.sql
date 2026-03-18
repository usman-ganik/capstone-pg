BEGIN;

CREATE TABLE IF NOT EXISTS customer_configs (
  slug TEXT PRIMARY KEY,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_configs_status
  ON customer_configs (status);

CREATE INDEX IF NOT EXISTS idx_customer_configs_updated_at
  ON customer_configs (updated_at DESC);


CREATE TABLE IF NOT EXISTS customer_api_users (
  username TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL REFERENCES customer_configs(slug) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_api_users_customer_slug
  ON customer_api_users (customer_slug);


CREATE TABLE IF NOT EXISTS payment_sessions (
  id TEXT PRIMARY KEY,
  customer_slug TEXT NOT NULL REFERENCES customer_configs(slug) ON DELETE CASCADE,
  rfx_id TEXT,
  rfx_number TEXT,
  account_id TEXT,
  user_id TEXT,
  supplier_name TEXT,
  supplier_email TEXT,
  amount NUMERIC(18, 2),
  currency TEXT,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  received_number TEXT,
  gateway_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_customer_slug
  ON payment_sessions (customer_slug);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_created_at
  ON payment_sessions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_customer_created_at
  ON payment_sessions (customer_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_status
  ON payment_sessions (status);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_rfx_id
  ON payment_sessions (rfx_id);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_rfx_number
  ON payment_sessions (rfx_number);


CREATE TABLE IF NOT EXISTS api_call_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_slug TEXT,
  phase TEXT,
  endpoint_name TEXT,
  method TEXT,
  resolved_url TEXT,
  status_code INTEGER,
  ok BOOLEAN NOT NULL DEFAULT FALSE,
  duration_ms INTEGER,
  error_message TEXT,
  request_headers JSONB,
  request_body TEXT,
  response_body TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_call_logs_created_at
  ON api_call_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_call_logs_customer_slug
  ON api_call_logs (customer_slug);

CREATE INDEX IF NOT EXISTS idx_api_call_logs_phase
  ON api_call_logs (phase);

CREATE INDEX IF NOT EXISTS idx_api_call_logs_ok
  ON api_call_logs (ok);

COMMIT;
