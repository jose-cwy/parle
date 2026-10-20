# Parlé database

Operating notes for Neon Postgres. Editing SQL files in git does **not** change production.

**Production cleanup is not authorized.** Do not `DROP`, `DELETE`, `TRUNCATE`, rename, or `SET SCHEMA` on the primary branch `br-morning-sun-apghun9g`. Child-branch rehearsal of `0001`/`0002` already passed; do not promote those files until named-object approval.

## Environments

| Field | Audited primary (local `DATABASE_URL`) |
|-------|----------------------------------------|
| Neon project id | `little-truth-88273418` |
| Primary branch id | `br-morning-sun-apghun9g` |
| Endpoint id | `ep-ancient-firefly-apt9ih8w` |
| Pooler host | `ep-ancient-firefly-apt9ih8w-pooler.c-7.us-east-1.aws.neon.tech` |
| Database | `neondb` |
| Role | `neondb_owner` |
| Region | `us-east-1` |

Rehearsal child (local `REHEARSAL_DATABASE_URL` only): branch `br-misty-recipe-apcj8oyo`, endpoint `ep-cold-cake-aptphzec`. Never use that URL as `DATABASE_URL`.

Vercel Production `DATABASE_URL` must match the primary project/branch above before any production schema work. Confirm identity (`neon.project_id` / `neon.branch_id`) without printing the connection string.

## SQL artifacts

1. **`database/schema.sql`** — KEEP snapshot plus soak/review tables. Documentation / empty-DB bootstrap. Editing it does not change Neon.
2. **`database/parle_chat.sql`** — superseded. Do not apply.
3. **`database/migrations/*.sql`** — versioned changes via `scripts/migrate.js`. `0001`/`0002` are **not** to be applied on the primary.

## Migrator

```text
node scripts/migrate.js --rehearsal --require-branch=<child-branch-id> [--allow-destructive]
```

- `--rehearsal` uses **only** `REHEARSAL_DATABASE_URL` (never `DATABASE_URL`, never `--database-url=`).
- Production execution of `0003` stays **disabled** until a later `--execute-primary-0003` approval. Assembling `--authorize-primary-additive` is not enough.
- `0001` / `0002` / destructive SQL cannot be selected on the primary 0003 path.
- Ledger: `schema_migrations` (exists on the child after rehearsal; **absent on primary** until an approved execute).

| File | Kind | Where |
|------|------|--------|
| `0001_keep_comments.sql` | comments | child only |
| `0002_archive_legacy.sql` | `SET SCHEMA archive_legacy` | child only |
| `0003_phase3_analytics.sql` | additive analytics | child rehearsed; primary not applied |

## Classification

| Class | Meaning |
|-------|---------|
| **KEEP** | Current product reads and/or writes |
| **SOAK** | Still served or leftover SELECT; keep until a later named approval |
| **ARCHIVE** | Unreferenced legacy; rehearsed to `archive_legacy` on the child; **still in `public` on primary** |

Encrypted at rest (`enc:v1:` AES-GCM, `DATA_ENCRYPTION_KEY`): `diary.content`, `chat_memory.text`, `chat_memory.training_content`, `users.last_session_summary`, `user_living_profile.payload`, `anonymous_messages.content`, `anonymous_messages.training_content`.

---

## KEEP tables

### `users` — accounts

Purpose: login, privacy flags, onboarding, encrypted session summary.

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `email` | text UNIQUE | plaintext |
| `password` | text | bcrypt; live nullable |
| `created_at` / `updated_at` | timestamptz | |
| `accepted_terms_at` / `accepted_terms_version` | timestamptz / text | |
| `preferred_name` | text | |
| `memory_enabled` | boolean | chat memory |
| `personalisation_enabled` | boolean | living profile + preference knobs |
| `training_consent` | boolean | **SOAK column** — written, no product reader |
| `last_session_summary` | text | encrypted |
| `preferences_reset_at` | timestamptz | |
| `onboarding_reason` | varchar(32) | |
| `onboarding_answered` | boolean | |
| `admin` | boolean | **SOAK column** — unused in JS |
| `image_attach_consent_at` | timestamptz | `/api/chat/context` |

Dependencies: referenced by most KEEP/SOAK tables (`ON DELETE CASCADE` or `SET NULL`).  
Writers: register, login, settings, onboarding, session-end, context.

### `diary` — private journal

`id` serial PK, `user_id` → `users`, `content` encrypted, `created_at`, `entry_date` (unique per user).  
API: `/api/journal`. Lib: `lib/journalDb.js`.

### `chat_memory` — authed transcript

`id` serial PK, `user_id` → `users`, `role`, `text` encrypted, `training_content` encrypted, `created_at`.  
API: `/api/chat/send`, `/api/chat/history`, `/api/chat/clear`. Lib: `lib/chatMemoryDb.js`.

### `quote_favorites`

`(user_id, quote_id)` PK, `created_at`. `user_id` → `users`.  
API: `/api/quotes/favorites`.

### `session_signals` — session-end telemetry

PK `session_id`, `user_id` → `users`, counts/modes, `training_eligible`, `created_at`. **No `starting_mode` column** (query lives on `session_length_history`).  
Writer: `/api/chat/session-end`. Deprecated reader: `/api/chat/sessions`.

### `session_length_history` — rolling preference inputs

`id` serial, `user_id` → `users`, `user_avg_message_length`, `starting_mode`, `final_mode`, `mode_switches`, `repeat_sentiment_detected`, `created_at`.  
Writer: `lib/parle/preferences.js` via session-end.

### `user_preference_profile` — reply knobs

PK `user_id` → `users`. Length/tone checks, averages, `most_used_mode`, `session_count`, `last_updated`.  
Depends on `session_length_history` for updates.

### `user_living_profile` — encrypted facts JSON

PK `user_id` → `users`, `payload` encrypted, `updated_at`.  
Writer: session-end / living-profile helpers.

### `anonymous_sessions` / `anonymous_messages` — guest training store

Sessions: PK `session_token`, `mode_used`, `message_count`, `training_eligible`, `created_at`.  
Messages: `id`, `session_token` → `anonymous_sessions`, `role`, `content` encrypted, `mode_id`, `training_eligible`, `reply_kind`, `training_content` encrypted, `created_at`.  
Writer: guest send. No product list UI.

### `usage_tracking` — guest/authed caps

`id`, `user_identifier`, `message_count`, `usage_date`, `is_guest`. Unique `(user_identifier, usage_date)`. No FK.  
Lib: `lib/usageTracking.js`. Guest window 30 / 4 hours.

### `guest_emails` — cron follow-ups

`id`, `email` plaintext, `reason`, `session_message_count`, `source`, `followup_due_at`, `followup_sent_at`, `created_at`. Unique lower(email).  
API: `/api/guest/email`. Cron: `/api/cron/guest-email-followups`.

### `message_feedback` — thumbs

`id`, `user_id` → `users` (SET NULL), `session_id`, `message_id`, `rating`, `reason`, `mode_id`, `is_guest`, `created_at`, `reply_excerpt`, `user_excerpt` (no longer written).  
API: `/api/feedback`. Reader: reply-quality injection.

### `product_feedback` — in-chat pulse / outcomes

`id`, `user_id` → `users` (SET NULL), `session_id`, `variant`, `response`, `note` (no longer written), `message_count`, `is_guest`, `created_at`, `dimension` (`relief` \| `clarity`; null on legacy A/B rows).  
API: `/api/feedback/product`. `response` is NOT NULL; skip = no outcome row.

### `product_events` — allowlisted product analytics

`id`, `name`, `user_id`, `is_guest`, `mode_id`, `session_key` (authed session id only; guests omit), `rating`, `reason`, `dimension`, `response`, `message_count`, `created_at`.  
Partial unique indexes: authed `conversation_started` per session, `user_activated` / `account_created` per user, `survey_shown` per user per UTC day. **No unique on `message_sent`.**  
Intended 24-month retention; **automatic deletion is not implemented.**

`users.first_activated_at` — first server-confirmed authed `message_sent`.

Migration `0003_phase3_analytics.sql` is additive. **Not applied on primary** until named approval. Rehearse on the child only. Never apply `0001`/`0002` on primary.

---

## SOAK tables (keep in `public`)

| Table | Columns (summary) | Dependencies | Why it stays |
|-------|-------------------|--------------|----------------|
| `user_memory` | `user_id` PK → `users`, `memory` jsonb plaintext, `updated_at` | users | `/api/memory` still served (deprecated headers) |
| `gamification` | `user_id` PK → `users`, streaks/counts, `badges` | users | UI POST `/api/gamification/progress` |
| `letters_to_self` | `id`, `user_id` UNIQUE → `users`, `content`, `is_completed`, timestamps | users | login `SELECT 1` for first-time |

---

## ARCHIVE candidates (primary: still `public`)

Child rehearsal moved these to `archive_legacy`. **Primary still has them in `public`.**

| Table | Purpose (legacy) | FK | Rows at rehearsal |
|-------|------------------|----|-------------------|
| `auth_tokens` | old email magic-link | none | 5 |
| `sessions` | old DB sessions (app uses JWT `hs_session`) | users | 0 |
| `chat_messages` | old chat rows | users | 0 |
| `diary_entries` | old journal | users | 0 |
| `future_letters` | old letters | users | 0 |
| `guest_exit_feedback` | old guest exit | none | 0 |
| `journey_progress` | old journey | users | 0 |
| `profiles` | old profile (`id` → users) | users | 0 |
| `session_feedback` | old session pulse | users | 0 |
| `deep_feedback` | old long-form answers | users | 2 |

`schema_migrations` is **not** on the primary.

---

## API deprecation (privacy-safe)

`Deprecation: true`, `Sunset: Wed, 20 Jan 2027 00:00:00 GMT`, log `{ route, method, hasAuth }` only:

- `/api/memory`
- `/api/chat/sessions`
- `/api/gamification/progress`

Still served. Do not 410.

## Cron

`/api/cron/guest-email-followups`: missing secret **503**, wrong secret **401**, match runs mailer. Never print `CRON_SECRET`.

## Recovery

Restore encrypted columns with the same `DATA_ENCRYPTION_KEY`. Neon child / PITR for schema accidents. Do not apply destructive SQL if branch identity is unconfirmed.
