-- additive Phase 3 analytics (no DROP / TRUNCATE / SET SCHEMA / DELETE)
-- Do not apply on the audited primary until named-object approval.
-- Never apply 0001 or 0002 on primary as part of this file.

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_activated_at TIMESTAMPTZ;

ALTER TABLE product_feedback ADD COLUMN IF NOT EXISTS dimension VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_product_feedback_dimension_created
  ON product_feedback (dimension, created_at DESC);

CREATE TABLE IF NOT EXISTS product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  mode_id VARCHAR(64),
  session_key VARCHAR(64),
  rating VARCHAR(16),
  reason VARCHAR(64),
  dimension VARCHAR(16),
  response VARCHAR(64),
  message_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_events_created
  ON product_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_name_created
  ON product_events (name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_user_created
  ON product_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_events_message_sent_user_day
  ON product_events (user_id, ((created_at AT TIME ZONE 'UTC')::date))
  WHERE name = 'message_sent' AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_events_conversation_started_authed
  ON product_events (user_id, session_key)
  WHERE name = 'conversation_started'
    AND user_id IS NOT NULL
    AND session_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_events_user_activated
  ON product_events (user_id)
  WHERE name = 'user_activated' AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_events_account_created
  ON product_events (user_id)
  WHERE name = 'account_created' AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_events_survey_shown_authed_day
  ON product_events (user_id, ((created_at AT TIME ZONE 'UTC')::date))
  WHERE name = 'survey_shown' AND user_id IS NOT NULL;
