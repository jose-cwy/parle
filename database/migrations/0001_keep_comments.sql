-- Additive comments only. Safe to re-run via migrator checksum skip.

COMMENT ON TABLE users IS 'Parlé accounts, privacy flags, encrypted last_session_summary';
COMMENT ON TABLE diary IS 'Private journal; content encrypted at rest';
COMMENT ON TABLE chat_memory IS 'Authed chat transcript; text and training_content encrypted';
COMMENT ON TABLE quote_favorites IS 'Saved quote ids; not gamification counters';
COMMENT ON TABLE session_signals IS 'Per-session telemetry written at session-end';
COMMENT ON TABLE session_length_history IS 'Rolling session stats for preference knobs';
COMMENT ON TABLE user_preference_profile IS 'Learned reply length/tone knobs';
COMMENT ON TABLE user_living_profile IS 'Encrypted living profile JSON';
COMMENT ON TABLE anonymous_sessions IS 'Guest training session headers';
COMMENT ON TABLE anonymous_messages IS 'Guest training messages; encrypted';
COMMENT ON TABLE usage_tracking IS 'Guest and authed message caps';
COMMENT ON TABLE guest_emails IS 'Guest follow-up emails for cron';
COMMENT ON TABLE message_feedback IS 'Thumbs ratings; excerpts no longer written';
COMMENT ON TABLE product_feedback IS 'In-chat product pulse; Phase 3 read path later';
COMMENT ON TABLE user_memory IS 'DEPRECATED API /api/memory; keep until soak';
COMMENT ON TABLE gamification IS 'DEPRECATED counters; keep until soak';
COMMENT ON TABLE letters_to_self IS 'DEPRECATED leftover; login SELECT only';
