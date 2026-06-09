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
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_name TEXT;

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

CREATE TABLE IF NOT EXISTS user_memory (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  memory JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
CREATE INDEX IF NOT EXISTS idx_user_memory_updated ON user_memory(updated_at);
CREATE INDEX IF NOT EXISTS idx_quote_favorites_user ON quote_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_letters_to_self_user_completed ON letters_to_self(user_id, is_completed);

-- parlé chatbot (see database/parle_chat.sql for full migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_session_summary TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences_reset_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS session_signals (
  session_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_count INTEGER NOT NULL DEFAULT 0,
  user_avg_message_length INTEGER NOT NULL DEFAULT 0,
  avg_reply_gap_seconds INTEGER NOT NULL DEFAULT 0,
  mode_switches INTEGER NOT NULL DEFAULT 0,
  final_mode VARCHAR(64),
  silence_after_response_count INTEGER NOT NULL DEFAULT 0,
  repeat_sentiment_detected BOOLEAN NOT NULL DEFAULT FALSE,
  session_length_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_signals_user ON session_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_session_signals_created ON session_signals(user_id, created_at DESC);
