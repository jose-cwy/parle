-- additive auth verification + Google identities (no DROP / TRUNCATE / SET SCHEMA / DELETE)
-- Rehearse on the Neon child branch only. Do not apply on production until named approval.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_required BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_challenges_token_hash_idx
  ON auth_challenges (token_hash);

CREATE INDEX IF NOT EXISTS auth_challenges_email_purpose_created_idx
  ON auth_challenges (email, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS user_auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  email_at_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_auth_identities_provider_subject_idx
  ON user_auth_identities (provider, provider_subject);

CREATE INDEX IF NOT EXISTS user_auth_identities_user_provider_idx
  ON user_auth_identities (user_id, provider);
