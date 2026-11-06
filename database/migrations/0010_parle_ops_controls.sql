-- Additive V2-F rehearsal ops control. Does not rewrite chat rows.
-- Apply only via:
-- node scripts/migrate.js --rehearsal --require-branch=br-square-unit-apbswjj3

CREATE TABLE IF NOT EXISTS parle_ops_controls (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL CHECK (value IN ('live', 'read_only')),
  revision BIGINT NOT NULL DEFAULT 0,
  updated_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parle_ops_control_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL CHECK (new_value IN ('live', 'read_only')),
  revision BIGINT NOT NULL,
  actor_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parle_ops_control_audit_key_created_idx
  ON parle_ops_control_audit (key, created_at DESC);
