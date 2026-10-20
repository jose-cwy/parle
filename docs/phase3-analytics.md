# Phase 3 analytics (V1)

Privacy-first product metrics. **Automatic deletion is not implemented.** Events are intended to be kept for 24 months; they do not expire until a deletion job is approved and shipped.

## Access

`ADMIN_EMAILS` is server-only. `/admin/insights` and `/api/admin/insights` load `users.email` from the signed-in session id and compare to the allowlist. Everyone else gets 404.

## Official metrics exclusions

Excluded from dashboard aggregates:

- any `*@parle.test` address
- extra addresses in `METRICS_EXCLUDE_EMAILS`

## Verified vs estimated retention

- `PARLE_ANALYTICS_VERIFIED_FROM` (UTC date, default `2026-10-20`)
- **Verified D1/D7 / DAU:** server `product_events.name = 'message_sent'` with `user_id` set, on or after that date, matching `users.first_activated_at`
- **Estimated historical activation:** `first_activated_at` before that date (backfill from `usage_tracking` if run later). Not reported as precise D1/D7.

Session-end timestamps are not used as an activity day.

## Events

Allowlisted names: `account_created`, `conversation_started`, `message_sent`, `user_activated`, `feedback_thumbs`, `feedback_outcome`, `survey_shown`, `survey_skipped`.

No chat text, summaries, names, guest session tokens, or free-text notes.

`message_sent` is **not** unique (retries of real turns are separate). Authed `conversation_started` is unique per `(user_id, session_key)`. `survey_shown` is unique per authed user per UTC day (skip still counts as shown).

## Survey

Shown only after a conservative in-page ending (not “don’t fix it” / “just listen”). Not on unload or New Chat. Once per UTC day even if skipped. Skip is not stored as “Same”.
