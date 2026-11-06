-- Additive V2-D.1 rehearsal tables for synthetic legacy wrap-copy.
-- Does not ALTER message bodies, DELETE, or rewrite chat_memory rows.
-- Apply only via: node scripts/migrate.js --rehearsal --require-branch=br-square-unit-apbswjj3

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_memory_id_user
  ON chat_memory (id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_messages_id_convo_user
  ON conversation_messages (id, conversation_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_one_legacy_timeline
  ON conversations (user_id)
  WHERE origin = 'legacy_timeline';

CREATE TABLE IF NOT EXISTS user_chat_migration (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'legacy_only'
    CHECK (state IN (
      'legacy_only',
      'migrating',
      'interrupted',
      'pending_quiesce',
      'migrated'
    )),
  wrap_conversation_id UUID,
  snapshot_xmin TEXT,
  snapshot_at TIMESTAMPTZ,
  last_batch_at TIMESTAMPTZ,
  mapped_count INTEGER NOT NULL DEFAULT 0 CHECK (mapped_count >= 0),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (wrap_conversation_id, user_id)
    REFERENCES conversations (id, user_id)
);

CREATE TABLE IF NOT EXISTS conversation_legacy_map (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_memory_id INTEGER NOT NULL,
  conversation_id UUID NOT NULL,
  conversation_message_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chat_memory_id),
  UNIQUE (conversation_message_id),
  FOREIGN KEY (chat_memory_id, user_id)
    REFERENCES chat_memory (id, user_id),
  FOREIGN KEY (conversation_id, user_id)
    REFERENCES conversations (id, user_id),
  FOREIGN KEY (conversation_message_id, conversation_id, user_id)
    REFERENCES conversation_messages (id, conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_legacy_map_convo
  ON conversation_legacy_map (user_id, conversation_id);

CREATE OR REPLACE FUNCTION parle_assert_legacy_wrap_origin()
RETURNS trigger AS $$
DECLARE
  orig TEXT;
  wrap_id UUID;
BEGIN
  wrap_id := CASE
    WHEN TG_TABLE_NAME = 'user_chat_migration' THEN NEW.wrap_conversation_id
    ELSE NEW.conversation_id
  END;
  IF wrap_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT origin INTO orig
    FROM conversations
   WHERE id = wrap_id AND user_id = NEW.user_id;
  IF orig IS DISTINCT FROM 'legacy_timeline' THEN
    RAISE EXCEPTION 'legacy wrap destination must have origin=legacy_timeline';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_chat_migration_wrap_origin ON user_chat_migration;
CREATE TRIGGER trg_user_chat_migration_wrap_origin
  BEFORE INSERT OR UPDATE OF wrap_conversation_id ON user_chat_migration
  FOR EACH ROW
  EXECUTE FUNCTION parle_assert_legacy_wrap_origin();

DROP TRIGGER IF EXISTS trg_conversation_legacy_map_wrap_origin ON conversation_legacy_map;
CREATE TRIGGER trg_conversation_legacy_map_wrap_origin
  BEFORE INSERT OR UPDATE ON conversation_legacy_map
  FOR EACH ROW
  EXECUTE FUNCTION parle_assert_legacy_wrap_origin();
