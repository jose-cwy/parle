-- Split wrap-origin triggers. A shared NEW.conversation_id reference cannot
-- compile against user_chat_migration. Additive; no chat_memory rewrites.

CREATE OR REPLACE FUNCTION parle_assert_user_chat_migration_wrap()
RETURNS trigger AS $$
DECLARE
  orig TEXT;
BEGIN
  IF NEW.wrap_conversation_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT origin INTO orig
    FROM conversations
   WHERE id = NEW.wrap_conversation_id AND user_id = NEW.user_id;
  IF orig IS DISTINCT FROM 'legacy_timeline' THEN
    RAISE EXCEPTION 'legacy wrap destination must have origin=legacy_timeline';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION parle_assert_legacy_map_wrap()
RETURNS trigger AS $$
DECLARE
  orig TEXT;
BEGIN
  SELECT origin INTO orig
    FROM conversations
   WHERE id = NEW.conversation_id AND user_id = NEW.user_id;
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
  EXECUTE FUNCTION parle_assert_user_chat_migration_wrap();

DROP TRIGGER IF EXISTS trg_conversation_legacy_map_wrap_origin ON conversation_legacy_map;
CREATE TRIGGER trg_conversation_legacy_map_wrap_origin
  BEFORE INSERT OR UPDATE ON conversation_legacy_map
  FOR EACH ROW
  EXECUTE FUNCTION parle_assert_legacy_map_wrap();
