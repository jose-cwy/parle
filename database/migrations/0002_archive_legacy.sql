-- destructive
-- Child-branch rehearsal only. migrate.js refuses this file on the primary branch
-- even with --allow-destructive.

CREATE SCHEMA IF NOT EXISTS archive_legacy;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chat_messages',
    'diary_entries',
    'future_letters',
    'guest_exit_feedback',
    'journey_progress',
    'profiles',
    'session_feedback',
    'sessions',
    'auth_tokens',
    'deep_feedback'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive_legacy', t);
    END IF;
  END LOOP;
END $$;
