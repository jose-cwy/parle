-- NeonDB / Postgres schema for Heartstrings Club V1

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diary (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_memory (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gamification (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  streaks INTEGER DEFAULT 0,
  entries_count INTEGER DEFAULT 0,
  quotes_read INTEGER DEFAULT 0,
  chat_interactions INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT ARRAY[]::text[]
);

CREATE TABLE IF NOT EXISTS quote_favorites (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  quote_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quote_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_diary_user ON diary(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_favorites_user ON quote_favorites(user_id);
