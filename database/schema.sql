-- NeonDB / Postgres schema for Heartstrings Club V1

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  accepted_terms_at TIMESTAMPTZ,
  accepted_terms_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_version TEXT;

CREATE TABLE IF NOT EXISTS diary (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_memory (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gamification (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  streaks INTEGER DEFAULT 0,
  entries_count INTEGER DEFAULT 0,
  quotes_read INTEGER DEFAULT 0,
  chat_interactions INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT ARRAY[]::text[]
);

CREATE TABLE IF NOT EXISTS quote_favorites (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  quote_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quote_id)
);

CREATE TABLE IF NOT EXISTS letters_to_self (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_diary_user ON diary(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_favorites_user ON quote_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_letters_to_self_user_completed ON letters_to_self(user_id, is_completed);
