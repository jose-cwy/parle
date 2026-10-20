# Parlé database rehearsal — final report

**Date:** 2026-10-20  
**Stopped before:** any production archive/`DROP`, Phase 2, Phase 3.

`DATABASE_URL` was not modified. All schema-changing SQL used `--rehearsal` → `REHEARSAL_DATABASE_URL` only.

---

## 1. Connection safety

| Check | Result |
|-------|--------|
| Rehearsal host | `ep-cold-cake-aptphzec-pooler.c-7.us-east-1.aws.neon.tech` |
| Rehearsal branch | `br-misty-recipe-apcj8oyo` |
| Rehearsal endpoint | `ep-cold-cake-aptphzec` |
| Primary host (`DATABASE_URL`) | `ep-ancient-firefly-apt9ih8w-pooler.c-7.us-east-1.aws.neon.tech` |
| Primary branch | `br-morning-sun-apghun9g` |
| Project | `little-truth-88273418` for both |
| `--rehearsal` missing URL | throws; does **not** use `DATABASE_URL` or `--database-url=` |
| Migrator on primary | refused for **all** files until named-object approval |

Identity was confirmed before re-running migrate. Credentials and keys were not printed.

---

## 2. Uncommitted changes vs approved plan

**In scope (keep):** docs, KEEP snapshot, superseded `parle_chat.sql`, numbered migrations, migrator + rehearsal scripts, privacy-safe deprecation headers on `/api/memory`, `/api/chat/sessions`, `/api/gamification/progress` (still served), `sessionPersist` skip on primary.

**Not in those diffs:** no API 410, no gamification write removal, no Phase 2/3, no primary DDL.

**Migration tracking:** `schema_migrations` on the child only; checksum skip on re-run; `0002` marked `-- destructive` and skipped without `--allow-destructive`.

---

## 3. Before / after schema (child vs primary-as-pre-archive)

Primary is the live pre-archive shape. The child is that copy after `0001`+`0002`.

### Location of legacy tables

| Table | Primary (`public`) | Child after rehearsal |
|-------|--------------------|------------------------|
| `auth_tokens` | 5 | `archive_legacy` 5 |
| `deep_feedback` | 2 | `archive_legacy` 2 |
| `chat_messages` | 0 | `archive_legacy` 0 |
| `diary_entries` | 0 | `archive_legacy` 0 |
| `future_letters` | 0 | `archive_legacy` 0 |
| `guest_exit_feedback` | 0 | `archive_legacy` 0 |
| `journey_progress` | 0 | `archive_legacy` 0 |
| `profiles` | 0 | `archive_legacy` 0 |
| `session_feedback` | 0 | `archive_legacy` 0 |
| `sessions` | 0 | `archive_legacy` 0 |

No `DROP`. Rows were relocated on the **child only**.

### KEEP / soak counts (public)

| Table | Child | Primary | Notes |
|-------|------:|--------:|-------|
| `users` | 11 | 11 | |
| `chat_memory` | 94 | 94 | |
| `diary` | 2 | 2 | |
| `anonymous_messages` | 633 | 633 | |
| `anonymous_sessions` | 39 | 39 | |
| `usage_tracking` | 91 | 91 | |
| `guest_emails` | 1 | 1 | |
| `gamification` | 9 | 9 | soak |
| `quote_favorites` | 1 | 1 | |
| `message_feedback` | 4 | 4 | |
| `product_feedback` | 5 | 5 | |
| `user_living_profile` | 1 | 1 | |
| `user_preference_profile` | 10 | 10 | |
| `user_memory` | 0 | 0 | soak |
| `letters_to_self` | 0 | 0 | soak |
| `session_signals` | 49 | 50 | drift after branch fork (primary still receiving writes) |
| `session_length_history` | 3 | 4 | same |
| `schema_migrations` | 2 | absent | child ledger only |

Primary: no `archive_legacy`, no `schema_migrations`.

---

## 4. Migration results (child `br-misty-recipe-apcj8oyo`)

| File | First apply | Re-run this session |
|------|-------------|---------------------|
| `0001_keep_comments.sql` | APPLIED (comments) | SKIP_APPLIED |
| `0002_archive_legacy.sql` | APPLIED (`SET SCHEMA`) | SKIP_APPLIED with `--allow-destructive`; SKIP_DESTRUCTIVE without it |

---

## 5. Tests

| Test | Result |
|------|--------|
| Identity gate | pass |
| Migrator checksum skip | pass |
| `--rehearsal` no-fallback unit tests | pass |
| Deprecation log (no bodies) | pass |
| Cron auth unit | pass |
| `rehearse-app-flows.js` (13 checks) | **13 pass / 0 fail** |
| `run-rehearsal-db-tests.js` sessionPersist | pass on child |
| Synthetic leftover users | 0 on child and primary |
| Live HTTP of Next APIs with child URL | **not run** — `npm run dev` still uses `DATABASE_URL` by design |

App-flow coverage (synthetic `@parle.test` only, then deleted):

- Auth bcrypt roundtrip  
- `letters_to_self` SELECT still works  
- Chat insert + decrypted history  
- Journal encrypt/list/delete  
- Living profile + preference knobs  
- Quote favorites  
- Message + product feedback  
- Guest usage increment  
- Guest email + anonymous session  
- Deprecated `user_memory` + `gamification` writes  
- `session_signals` insert  
- Archive tables absent from `public`  

---

## 6. Recovery

| Check | Result |
|-------|--------|
| Child branch as copy of primary | Confirmed (same project; different branch/endpoint) |
| Synthetic `enc:v1:` write → reconnect-style read → decrypt | pass (`recovery_decrypt_after_reconnect`) |
| Keys / ciphertext / real transcripts logged | no |
| Neon PITR window recorded via API | **no** (no `NEON_API_KEY`) |

---

## 7. Production cron

Dummy `POST https://parle.chat/api/cron/guest-email-followups` with `Bearer rehearsal-unauth-probe`:

**401 Unauthorized**

That means fail-closed code is deployed **and** `CRON_SECRET` **is configured** (wrong secret does not run the mailer). It is no longer the earlier 503 “not configured” state.

---

## 8. Remaining mismatches

- Child `session_signals` / `session_length_history` counts lag the primary by 1 because the primary kept taking live writes after the branch was forked. Not caused by `0002`.
- Child has `schema_migrations` + `archive_legacy`; primary does not.
- Production Vercel project name / env `DATABASE_URL` still not read from the Vercel API (health only shows the key is set).
- Live UI/HTTP was not pointed at the child.

---

## 9. Recommended future removal (not approved)

**Archive on primary (same as child `0002`, still not DROP):**  
`auth_tokens`, `chat_messages`, `deep_feedback`, `diary_entries`, `future_letters`, `guest_exit_feedback`, `journey_progress`, `profiles`, `session_feedback`, `sessions`.

**Soak — keep in `public` until a later named approval:**  
`gamification`, `user_memory`, `letters_to_self`; columns `users.admin`, `users.training_consent`; `message_feedback` excerpt columns (already written null).

**Do not archive:** KEEP tables listed in `docs/database.md`.

---

## 10. Exact proposed production cleanup (do not run)

After explicit named-object approval, and after relaxing the new “refuse all migrate on primary” guard with a dedicated flag:

1. Snapshot / confirm Vercel `DATABASE_URL` is `br-morning-sun-apghun9g`.  
2. `node scripts/migrate.js --require-branch=br-morning-sun-apghun9g` for `0001` only if comments are wanted.  
3. Same migrator with `--allow-destructive` for `0002_archive_legacy.sql` (`CREATE SCHEMA archive_legacy` + `ALTER TABLE public.<name> SET SCHEMA archive_legacy` for the ten tables above).  
4. Do **not** `DROP`/`DELETE`/`TRUNCATE` those tables in that step.

The migrator currently **refuses the primary entirely**, so production apply cannot happen by accident.

---

## 11. Outstanding risks / blockers

1. Production cleanup is **blocked on your named-object approval**.  
2. Vercel `DATABASE_URL` equality with this Neon primary is still inferred, not read from the host dashboard.  
3. PITR window not recorded.  
4. One due `guest_emails` row remains on the primary (unchanged by rehearsal). Legitimate cron may send it now that `CRON_SECRET` is set.  
5. Soak APIs still write.

**Not requesting production cleanup.** Approve named objects before any primary `SET SCHEMA` or `DROP`.
