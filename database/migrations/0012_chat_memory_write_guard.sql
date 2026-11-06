-- Database-level chat_memory write guard. Additive; no chat_memory rewrites.
-- Uses FOR SHARE on parle_legacy_write_barrier so freeze (FOR UPDATE) still
-- waits for in-flight writers. Unfrozen writers take SHARE and proceed.
-- Missing control table fail-opens so 0012 can exist only after 0011.

CREATE OR REPLACE FUNCTION parle_assert_chat_memory_writes_allowed()
RETURNS trigger AS $$
DECLARE
  is_frozen BOOLEAN;
BEGIN
  IF to_regclass('public.parle_legacy_write_barrier') IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT frozen INTO is_frozen
    FROM parle_legacy_write_barrier
   WHERE key = 'chat_memory'
   FOR SHARE;

  IF is_frozen IS NULL OR is_frozen THEN
    RAISE EXCEPTION 'history_save_in_progress'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_memory_legacy_write_barrier ON chat_memory;
CREATE TRIGGER trg_chat_memory_legacy_write_barrier
  BEFORE INSERT OR UPDATE OR DELETE ON chat_memory
  FOR EACH ROW
  EXECUTE FUNCTION parle_assert_chat_memory_writes_allowed();
