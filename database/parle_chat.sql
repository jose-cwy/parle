-- parlé chatbot system — run after schema.sql

-- User profile extensions
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_session_summary TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS personalisation_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS training_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences_reset_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image_attach_consent_at TIMESTAMPTZ;

-- Learned preference profile (logged-in only)
CREATE TABLE IF NOT EXISTS user_preference_profile (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_response_length TEXT NOT NULL DEFAULT 'medium'
    CHECK (preferred_response_length IN ('short', 'medium', 'long')),
  preferred_tone TEXT NOT NULL DEFAULT 'balanced'
    CHECK (preferred_tone IN ('warm', 'balanced', 'direct')),
  responds_well_to_questions BOOLEAN NOT NULL DEFAULT TRUE,
  prefers_validation_over_advice BOOLEAN NOT NULL DEFAULT TRUE,
  average_message_length INTEGER NOT NULL DEFAULT 0,
  average_reply_speed_seconds INTEGER NOT NULL DEFAULT 0,
  mode_switch_count INTEGER NOT NULL DEFAULT 0,
  most_used_mode VARCHAR(64) NOT NULL DEFAULT 'Just listen',
  session_count INTEGER NOT NULL DEFAULT 0,
  average_session_length_messages INTEGER NOT NULL DEFAULT 0,
  repeat_sentiment_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-session passive learning signals
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
  training_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_signals ADD COLUMN IF NOT EXISTS training_eligible BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE session_signals ALTER COLUMN training_eligible SET DEFAULT TRUE;

ALTER TABLE chat_memory ADD COLUMN IF NOT EXISTS training_content TEXT;

CREATE TABLE IF NOT EXISTS anonymous_sessions (
  session_token VARCHAR(128) PRIMARY KEY,
  mode_used VARCHAR(64),
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anonymous_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token VARCHAR(128) NOT NULL REFERENCES anonymous_sessions(session_token) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_messages_session ON anonymous_messages(session_token);

CREATE INDEX IF NOT EXISTS idx_session_signals_user ON session_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_session_signals_created ON session_signals(user_id, created_at DESC);

-- Rolling window for consecutive-session preference rules (last 5 sessions)
CREATE TABLE IF NOT EXISTS session_length_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_avg_message_length INTEGER NOT NULL DEFAULT 0,
  starting_mode VARCHAR(64),
  final_mode VARCHAR(64),
  mode_switches INTEGER NOT NULL DEFAULT 0,
  repeat_sentiment_detected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_length_history_user ON session_length_history(user_id, created_at DESC);
