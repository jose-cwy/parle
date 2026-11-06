-- Additive V2-D.4 rehearsal revision for wrap pagination.
-- Does not rewrite message bodies. Apply only via:
-- node scripts/migrate.js --rehearsal --require-branch=br-square-unit-apbswjj3

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS timeline_revision BIGINT NOT NULL DEFAULT 0;
