# D0 — Live Neon schema inventory (read-only)

**Date:** 2026-10-19  
**Mode:** `SELECT` / `information_schema` / row counts only. No `DROP`, `DELETE`, `TRUNCATE`, or schema `ALTER`.  
**Repo SQL compared:** [`database/schema.sql`](../database/schema.sql), [`database/parle_chat.sql`](../database/parle_chat.sql), plus runtime `CREATE TABLE IF NOT EXISTS` in JS.

---

## Neon target audited

| Field | Value |
|-------|--------|
| Source of connection | This workspace `.env.local` `DATABASE_URL` |
| Neon project id | `little-truth-88273418` (`pg_settings.neon.project_id`) |
| Neon project display name | **Not in Postgres** — confirm in Neon console |
| Branch id | `br-morning-sun-apghun9g` (`neon.branch_id`) |
| Branch display name | **Not in Postgres** — confirm in Neon console |
| Endpoint id | `ep-ancient-firefly-apt9ih8w` (`neon.endpoint_id`) |
| Compute | `primary` |
| Pooler host | `ep-ancient-firefly-apt9ih8w-pooler.c-7.us-east-1.aws.neon.tech` |
| Region | `us-east-1` (AWS, cell `c-7`) |
| Database | `neondb` |
| Role | `neondb_owner` |
| Postgres | 17.11 |

**Caveat:** D0 audited the database this repo’s local env points at. Production Vercel `DATABASE_URL` was not independently confirmed (no `vercel.json`, Vercel CLI listing did not complete). Treat this as the **connected** environment, not a certified 1:1 with every host until the founder checks the Vercel project env.

---

## Classification key

| Class | Meaning |
|-------|---------|
| **in use** | Current app writes and/or reads on a product path |
| **written, weakly read** | Writes exist; no meaningful product UI read |
| **legacy / unreferenced** | Present in Neon; no current JS `INSERT`/`SELECT` (except leftover login SELECT) |
| **declared missing** | In repo SQL/JS but **absent** on this Neon |
| **schema drift** | Live columns ≠ repo CREATE / queries |

Recommended fate is **not** permission to delete. Cleanup is a later workstream, after backup/restore confirmation.

---

## Live tables (26) and row counts

| Table | Rows | Class | Fate (proposed, not executed) |
|-------|------|-------|-------------------------------|
| `users` | 11 | in use | keep |
| `chat_memory` | 104 | in use | keep |
| `anonymous_messages` | 626 | in use (write) | keep |
| `anonymous_sessions` | 38 | in use (write) | keep |
| `usage_tracking` | 87 | in use | keep |
| `session_signals` | 46 | written, weakly read | keep; fix reads later |
| `user_preference_profile` | 10 | in use | keep |
| `gamification` | 9 | in use | keep |
| `product_feedback` | 5 | written, weakly read | keep |
| `auth_tokens` | 5 | legacy | D2 candidate |
| `message_feedback` | 4 | in use | keep; stop excerpt writes later |
| `guest_emails` | 1 | in use | keep |
| `diary` | 1 | in use | keep |
| `quote_favorites` | 1 | in use | keep |
| `deep_feedback` | 2 | legacy | D2 candidate |
| `user_living_profile` | 0 | in use (empty — see defect) | keep |
| `user_memory` | 0 | API-only, unused UI | D2 candidate after confirming no clients |
| `letters_to_self` | 0 | leftover SELECT on login | D2 candidate |
| `chat_messages` | 0 | legacy | D2 candidate |
| `diary_entries` | 0 | legacy | D2 candidate |
| `future_letters` | 0 | legacy | D2 candidate |
| `guest_exit_feedback` | 0 | legacy | D2 candidate |
| `journey_progress` | 0 | legacy | D2 candidate |
| `profiles` | 0 | legacy | D2 candidate |
| `session_feedback` | 0 | legacy | D2 candidate |
| `sessions` | 0 | legacy (JWT cookies, not this table) | D2 candidate |
| **`session_length_history`** | **ABSENT** | declared missing | **do not drop**; table never created here |

---

## Column-by-column (live)

### `users` — in use

| Column | Type | Null | Notes |
|--------|------|------|--------|
| `id` | uuid PK | NO | `gen_random_uuid()` |
| `email` | text UNIQUE | NO | plaintext |
| `created_at` / `updated_at` | timestamptz | NO | |
| `password` | text | YES | bcrypt; live allows NULL (repo CREATE said NOT NULL) |
| `accepted_terms_at` | timestamptz | YES | |
| `accepted_terms_version` | text | YES | |
| `preferred_name` | text | YES | 11/11 set |
| `personalisation_enabled` | boolean | NO | **DEFAULT false** live; repo SQL default **true**; register INSERT uses TRUE |
| `training_consent` | boolean | NO | 0/11 true; seed/register write; **no product reader** |
| `memory_enabled` | boolean | NO | **DEFAULT false** live; repo SQL default **true**; 11/11 currently true |
| `last_session_summary` | text | YES | encrypted when session-end writes; **0 rows set** |
| `preferences_reset_at` | timestamptz | YES | |
| `onboarding_reason` | varchar(32) | YES | `/api/user/onboarding` |
| `onboarding_answered` | boolean | NO | 7/11 true |
| `admin` | boolean | NO | **0 admins; no JS reader/writer** |

**Missing live (code expects):** `image_attach_consent_at` — in `parle_chat.sql` and [`pages/api/chat/context.js`](../pages/api/chat/context.js) SELECT/UPDATE. Live `information_schema` has no such column (**schema drift**). Consent GET/POST can fail with `42703`.

**Writers/readers:** register, login, preferred-name, user settings, onboarding, session-end, context.js.

### `diary` — in use (journal)

| Column | Type | Notes |
|--------|------|--------|
| `id` | serial PK | |
| `user_id` | uuid FK users | nullable live |
| `content` | text | **1/1 `enc:v1:`** |
| `created_at` | timestamptz | |
| `entry_date` | date | present; unique index `(user_id, entry_date)` |

Writer: [`lib/journalDb.js`](../lib/journalDb.js).

### `chat_memory` — in use

| Column | Type | Notes |
|--------|------|--------|
| `id` | serial PK | **exists live**; [`listChatMessages`](../lib/chatMemoryDb.js) does **not** SELECT `id` (Phase 1 additive later) |
| `user_id` | uuid | nullable live |
| `role` | text | |
| `text` | text | **104/104 encrypted** |
| `created_at` | timestamptz | |
| `training_content` | text | **104/104 encrypted** |

### `user_memory` — weakly used

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | uuid PK FK | |
| `memory` | jsonb | **plaintext**; 0 rows |
| `updated_at` | timestamptz | |

API: [`pages/api/memory/index.js`](../pages/api/memory/index.js). No `fetch('/api/memory')` in `pages/` or `components/`.

### `gamification` — in use (9 rows)

`user_id`, `streaks`, `entries_count`, `quotes_read`, `chat_interactions`, `badges`.

### `quote_favorites` — in use (1 row)

`(user_id, quote_id)` PK, `created_at`.

### `letters_to_self` — leftover

Full letter columns; **0 rows**. Only [`pages/api/auth/login.js`](../pages/api/auth/login.js) `SELECT 1` for `firstTime`. No INSERT in repo. Unique on `user_id`.

### `session_signals` — written, weakly read (46 rows)

Live columns: `session_id`, `user_id`, `message_count`, `user_avg_message_length`, `avg_reply_gap_seconds`, `mode_switches`, `final_mode`, `silence_after_response_count`, `repeat_sentiment_detected`, `session_length_minutes`, `training_eligible`, `created_at`.

**No `starting_mode`.** [`pages/api/chat/sessions.js`](../pages/api/chat/sessions.js) SELECTs it → `42703` → returns `[]`. No UI fetch of that API found.

Writer: [`pages/api/chat/session-end.js`](../pages/api/chat/session-end.js).

### `anonymous_sessions` / `anonymous_messages` — in use (write)

Guest training store. All 626 messages `enc:v1:` on `content` and `training_content`. No product list UI.

### `usage_tracking` — in use (87 rows)

`user_identifier`, `message_count`, `usage_date`, `is_guest`. Guest + authed send via [`lib/usageTracking.js`](../lib/usageTracking.js). Unique `(user_identifier, usage_date)`.

### `guest_emails` — in use (1 row)

Email **plaintext**. `followup_due_at` set; `followup_sent_at` **null**. Cron would attempt send if invoked with Resend configured.

### `message_feedback` — in use (4 rows)

Excerpts **plaintext**: 3 `reply_excerpt`, 2 `user_excerpt` non-empty. Prompt reader: `getRecentReplyFeedback`. Do not DROP columns in Phase 1; stop new excerpt writes is a later persistence change.

### `product_feedback` — weakly read (5 rows, 1 note)

No SELECT in app (Phase 3 admin).

### `user_living_profile` — in use, empty

`payload` encrypted by design. **0 rows.** Likely because session-end throws before this write (missing `session_length_history`).

### `user_preference_profile` — in use (10 rows)

Matches runtime CREATE in [`lib/parle/preferences.js`](../lib/parle/preferences.js). Rolling length/tone rules **depend on missing history table**.

### `session_length_history` — **ABSENT on this Neon**

Declared in `parle_chat.sql`. JS `INSERT`/`SELECT` in `updateProfileAfterSession` with **no try/catch**. Live `information_schema`: table does not exist.

### Legacy tables with **zero current JS references**

Column lists are for inventory only; **do not query user text**.

**`auth_tokens`** (5 rows): `id`, `email`, `token_hash`, `expires_at`, `consumed_at`, `created_at`. Looks like old email-magic-link store. Current [`utils/resend.js`](../utils/resend.js) does not read this table.

**`sessions`** (0): cookie JWT is used instead (`hs_session`). Columns: `id`, `user_id`, `token_hash`, `expires_at`, `created_at`.

**`chat_messages`** (0): `id`, `user_id`, `role`, `content`, `crisis_flag`, `created_at`. Superseded by `chat_memory`.

**`diary_entries`** (0): dated mood/tags journal. Superseded by `diary`.

**`future_letters`** (0): `content`, `locked`, `unlocked_at`, `final_reflection`. Parallel to `letters_to_self`.

**`profiles`** (0): `nickname`, `heartbreak_stage`, `mood_start`, `support_need`, `breakup_date`, `terms_accepted`, `current_stage`. Old onboarding; current flags live on `users`.

**`journey_progress`** (0): `stage`, `task_key`, `completed`.

**`deep_feedback`** (2 rows): `answer_1`, `answer_2`, `answer_3` — **plaintext answers may still exist; do not dump**.

**`guest_exit_feedback`** (0), **`session_feedback`** (0): older pulse schemas; current product uses `product_feedback` / `message_feedback`.

---

## Encryption / sensitivity (aggregates only)

| Store | Status |
|-------|--------|
| `chat_memory.text` / `training_content` | 104/104 `enc:v1:` |
| `anonymous_messages` content / training | 626/626 `enc:v1:` |
| `diary.content` | 1/1 `enc:v1:` |
| `users.last_session_summary` | 0 set |
| `user_living_profile.payload` | 0 set |
| `message_feedback` excerpts | plaintext present (3+2) |
| `user_memory.memory` | plaintext JSONB (empty) |
| `guest_emails.email` | plaintext |
| `users.email` / bcrypt `password` | plaintext / hash |
| `deep_feedback` answers | plaintext (2 rows) |

---

## Application dependency map (current code)

| Path | Tables |
|------|--------|
| Auth register/login/me/settings | `users` |
| Journal API | `diary` |
| Authed chat send / history / clear | `chat_memory`, `usage_tracking`, `users` settings, `user_preference_profile`, `user_living_profile` (read) |
| Guest send | `anonymous_*`, `usage_tracking` |
| Session-end | `session_signals`, `session_length_history` (**missing**), `user_preference_profile`, `user_living_profile`, `chat_memory`, `users.last_session_summary`, `message_feedback` (recent) |
| Guest email + cron | `guest_emails` |
| Feedback APIs | `message_feedback`, `product_feedback` |
| Quotes / gamification | `quote_favorites`, `gamification` |
| Memory API | `user_memory` (no UI) |
| Chat sessions list API | `session_signals.starting_mode` (**missing column**) |

Sidebar archives remain **localStorage**, not Neon.

---

## Dual-file vs live drift

| Item | Live Neon | `schema.sql` | `parle_chat.sql` | Runtime JS |
|------|-----------|--------------|------------------|------------|
| `image_attach_consent_at` | **missing** | missing | ALTER | SELECT/UPDATE |
| `session_length_history` | **missing** | missing | CREATE | INSERT/SELECT, no catch |
| `users.memory_enabled` default | **false** | true | — | register TRUE; settings COALESCE |
| `users.admin` | present | missing | missing | unused |
| `session_signals.starting_mode` | **missing** | missing | missing | SELECT in sessions.js |
| Legacy Heartstrings tables (`profiles`, `future_letters`, …) | present | missing | missing | unused |
| `message_feedback` excerpts | present | yes | no | CREATE IF NOT EXISTS |

---

## Live defect (read-only finding)

`updateProfileAfterSession` inserts into `session_length_history` **before** living-profile and last-session-summary writes. Table is missing → session-end can abort after `session_signals` insert. Consistent with: 46 `session_signals`, 0 `user_living_profile`, 0 `last_session_summary`. **Do not create the table in D0.** Creating it is a Phase 1+ persistence change and needs explicit approval.

---

## Cron (separate, not blocked on D0)

See the D0 completion report in chat: deployed route exists on `parle.chat`; handler fail-opens if `CRON_SECRET` unset; GET/POST were **not** used (would send due guest email).

---

## Phase 1 implication

D0 live map is complete. **Stop here.** Phase 1 persistence (chat `id` on list/insert, cron fail-closed, excerpt stop-write, optional `session_length_history` CREATE) requires founder approval. **No cleanup/DROP.**
