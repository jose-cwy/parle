-- Additive conversation tables for V2-B.1.
-- Rehearsal-only until a later primary authorization exists.
-- Does not ALTER or DELETE chat_memory.

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted')),
  title_enc TEXT,
  mode_id TEXT,
  origin TEXT NOT NULL DEFAULT 'live'
    CHECK (origin IN ('live', 'legacy_timeline', 'guest_import', 'archive_import')),
  legacy_import_key TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_legacy_import
  ON conversations (user_id, legacy_import_key)
  WHERE legacy_import_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_user_status_updated
  ON conversations (user_id, status, last_message_at DESC NULLS LAST, created_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  seq BIGINT NOT NULL,
  text_enc TEXT NOT NULL,
  training_content_enc TEXT,
  revision_of UUID REFERENCES conversation_messages(id),
  client_message_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, seq),
  FOREIGN KEY (conversation_id, user_id)
    REFERENCES conversations (id, user_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_messages_client_id
  ON conversation_messages (user_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_thread
  ON conversation_messages (conversation_id, seq);

CREATE TABLE IF NOT EXISTS conversation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'streaming', 'completed', 'cancelled', 'failed')),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  user_message_id UUID REFERENCES conversation_messages(id),
  assistant_message_id UUID REFERENCES conversation_messages(id),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, conversation_id, idempotency_key),
  FOREIGN KEY (conversation_id, user_id)
    REFERENCES conversations (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_requests_lease
  ON conversation_requests (conversation_id, status, lease_expires_at);
