-- SANDAR initial schema (D1 / SQLite). Public catalogue, private workspace,
-- identity, consent/audit, agentic tasks, plans, entitlements and billing.
-- Money is always stored as INTEGER minor units.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth_subject TEXT NOT NULL UNIQUE,
  account_state TEXT NOT NULL DEFAULT 'active' CHECK (account_state IN ('active','suspended')),
  plan_id TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  area TEXT NOT NULL DEFAULT 'life',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done','dropped')),
  target_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_ws ON goals(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS cash_flow_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inflow','outflow')),
  label TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency_code TEXT NOT NULL DEFAULT 'IDR',
  expected_date TEXT,
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','weekly','monthly','yearly')),
  certainty TEXT NOT NULL DEFAULT 'estimated' CHECK (certainty IN ('confirmed','estimated','unknown')),
  category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cfi_ws ON cash_flow_items(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS resource_listings (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'resource' CHECK (kind IN ('resource','opportunity')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  topic_codes TEXT NOT NULL,
  publisher_name TEXT NOT NULL,
  publisher_type TEXT NOT NULL,
  jurisdiction_code TEXT NOT NULL,
  coverage_text TEXT,
  official_source_url TEXT NOT NULL,
  source_title TEXT,
  retrieved_at TEXT,
  last_verified_at TEXT,
  review_interval_days INTEGER NOT NULL DEFAULT 90,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','checked','stale','withdrawn','needs_review')),
  caveats TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rl_status ON resource_listings(verification_status, last_verified_at);
CREATE INDEX IF NOT EXISTS idx_rl_juris ON resource_listings(jurisdiction_code);

CREATE TABLE IF NOT EXISTS listing_reports (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES resource_listings(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose_code TEXT NOT NULL CHECK (purpose_code IN ('workspace_storage','ai_processing','external_search')),
  notice_version TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id, purpose_code);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  agent TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','planning','awaiting_user_input','running','awaiting_approval','completed','failed','cancelled')),
  inputs_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_ws ON agent_tasks(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  tool TEXT,
  outcome TEXT,
  latency_ms INTEGER,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_events ON task_events(task_id, occurred_at);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES agent_tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  area TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','done')),
  review_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plans_ws ON plans(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS plan_steps (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user','suggestion','source')),
  done INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_steps_plan ON plan_steps(plan_id, position);

CREATE TABLE IF NOT EXISTS usage_counters (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  period TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, metric, period)
);

CREATE TABLE IF NOT EXISTS provider_usage (
  provider TEXT NOT NULL,
  period_day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider, period_day)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','active','grace','cancelled','expired')),
  provider TEXT NOT NULL,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL CHECK (status IN ('created','pending','paid','failed','expired','refunded')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  outcome TEXT NOT NULL,
  PRIMARY KEY (provider, event_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL,
  correlation_id TEXT,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_events(occurred_at);
