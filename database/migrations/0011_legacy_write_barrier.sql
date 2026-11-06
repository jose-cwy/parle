-- Additive rehearsal write barrier for future Stage 4 freeze.
-- Does not rewrite, delete, or lock chat_memory rows.
-- No primary execute flag. Do not apply on br-morning-sun-apghun9g in this milestone.

CREATE TABLE IF NOT EXISTS parle_legacy_write_barrier (
  key TEXT PRIMARY KEY,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  epoch BIGINT NOT NULL DEFAULT 0 CHECK (epoch >= 0),
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO parle_legacy_write_barrier (key, frozen, epoch, reason)
VALUES ('chat_memory', FALSE, 0, 'default_live')
ON CONFLICT (key) DO NOTHING;
