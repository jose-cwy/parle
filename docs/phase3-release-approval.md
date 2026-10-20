# Phase 3 production release approval

Status: **prepared, not executed.** `0003` is not on primary. The primary ledger is still absent. Phase 3 is not deployed. `--execute-primary-0003` was not used.

Checksum of `database/migrations/0003_phase3_analytics.sql`:

`611daa96f31d10b73f5f86ea7aaaa39441ae1cd7234461e77da416180decf51a`

## Reviewed SQL

The file is additive only (`IF NOT EXISTS`, no `DROP` / `TRUNCATE` / `DELETE FROM` / `SET SCHEMA`). Wrapped by `scripts/migrate.js` in a single `BEGIN`/`COMMIT`. On failure: `ROLLBACK`, then `schema_migrations` row `status=failed` (on the target that has a ledger). `CREATE INDEX CONCURRENTLY` is not used, so the transaction is valid.

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_activated_at TIMESTAMPTZ;

ALTER TABLE product_feedback ADD COLUMN IF NOT EXISTS dimension VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_product_feedback_dimension_created
  ON product_feedback (dimension, created_at DESC);

CREATE TABLE IF NOT EXISTS product_events ( ... );
-- indexes + partial unique indexes; see file
```

### Production objects that would be created or altered

| Object | Change | Existing data |
|--------|--------|----------------|
| `users.first_activated_at` | add nullable `timestamptz` | unchanged; catalog-only add (no default) |
| `product_feedback.dimension` | add nullable `varchar(16)` | unchanged; existing rows stay `NULL` |
| `idx_product_feedback_dimension_created` | new btree on `(dimension, created_at DESC)` | read-share lock while building |
| `product_events` | **new** table | no existing rows |
| `product_events.id` | uuid PK `gen_random_uuid()` | n/a |
| `product_events.user_id` | uuid NULL, FK `users(id) ON DELETE SET NULL` | n/a |
| `product_events.is_guest` | boolean NOT NULL default false | n/a |
| `product_events.mode_id`, `session_key`, `rating`, `reason`, `dimension`, `response`, `message_count`, `created_at` | nullable except `created_at` | n/a |
| `idx_product_events_created` | new | n/a |
| `idx_product_events_name_created` | new | n/a |
| `idx_product_events_user_created` | partial, `user_id IS NOT NULL` | n/a |
| `idx_product_events_message_sent_user_day` | non-unique day index | n/a |
| `product_events_conversation_started_authed` | unique `(user_id, session_key)` where name/user/session set | n/a |
| `product_events_user_activated` | unique `(user_id)` | n/a |
| `product_events_account_created` | unique `(user_id)` | n/a |
| `product_events_survey_shown_authed_day` | unique `(user_id, UTC date)` | n/a |
| `schema_migrations` | **created on first successful execute** | currently **absent** on primary |

No `message_sent` unique constraint. Nullable `session_key` / guest `user_id` are excluded from those unique indexes.

### Locking and failure modes

- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` without default: short `ACCESS EXCLUSIVE`, no table rewrite.
- Index on live `product_feedback`: share lock; should be brief on a small table.
- New `product_events` indexes build on an empty table.
- Duplicate unique rows cannot exist on first create.
- Missing `product_feedback` would fail the second `ALTER` and roll back the whole file.
- `gen_random_uuid()` is available on Neon.

### Data loss

**None from applying `0003`.** It does not `UPDATE`/`DELETE` existing rows. The FK `ON DELETE SET NULL` does not delete users. Existing chat, memory, and feedback rows stay. The only later effect is: if a user account is deleted, matching `product_events.user_id` become null.

## Production authorization mechanism (disabled)

Required together, and only for `0003`:

- `--authorize-primary-additive`
- `--migration=0003_phase3_analytics.sql`
- `--expected-checksum=611daa96f31d10b73f5f86ea7aaaa39441ae1cd7234461e77da416180decf51a`
- `--require-branch=br-morning-sun-apghun9g`
- project id must be `little-truth-88273418`
- `--execute-primary-0003` **(not enabled in this run)**

Still rejected: `0001`, `0002`, `archive_legacy`, `--allow-destructive`, `--database-url=` on execute, `--dry-run` on execute, `--rehearsal` mixed with execute, wrong checksum, wrong branch.

Concurrency: `pg_try_advisory_lock(872451901)`. Failures recorded on the ledger after rollback.

Until `--execute-primary-0003` is explicitly approved, primary runs throw *before* `ensureLedger`.

### Rehearsal results (`scripts/phase3-rehearse-primary-auth.js`)

| Check | Result |
|-------|--------|
| Child wrong checksum | refused |
| Child `--migration=0001` | refused |
| Child `--execute-primary-0003` + rehearsal | refused |
| Child authorized bundle | `SKIP_APPLIED 0003` on `br-misty-recipe-apcj8oyo` |
| Primary assembled auth, no execute | `Primary execution is disabled` |
| Primary `--identity-only` | identity ok, no DDL |
| Primary `schema_migrations` | **null** |
| Primary `product_events` | **null** |
| Primary `users.first_activated_at` | **absent** |

## Application verification

Local Next.js was restarted. Latest feedback and admin routes loaded.

- Synthetic e2e (`scripts/phase3-e2e.js`): six modes, same-session follow-up, thumbs reasons, legacy reason rejected, survey shown/skip/answer, legacy “helping” rejected, crisis, guest send, ending detector, admin 404 for test user. All passed.
- Concurrent `/api/feedback/product` `shown` ×3: all **200** (primary has no `product_events`; insert fail-closed). Skip **200**. Chat still returned 200 throughout e2e.
- Child concurrent `survey_shown` inserts: **23505**.
- `ADMIN_EMAILS`: test user API **404**; anonymous API **401** (auth pipeline before allowlist); `requireAdminUser` true only when env allowlist matches DB email; browser `/admin/insights` title **Not found**.
- `GET /api/feedback/product` `askedToday: false` on primary because server-side `survey_shown` cannot persist until `0003`. Client localStorage still caps once per UTC day.
- `npm test`: 112 passed, 1 skipped (primary persistence writes).

## Deployment order (after a later explicit approval)

1. Apply **only** `0003` on primary with `--execute-primary-0003` and the checksum above. Do not run `0001`/`0002`.
2. Confirm `schema_migrations` has `0003_phase3_analytics.sql` / `applied` and the same checksum.
3. Set `ADMIN_EMAILS` (and optional `METRICS_EXCLUDE_EMAILS`, `PARLE_ANALYTICS_VERIFIED_FROM`) on Vercel.
4. Deploy the Phase 3 application.
5. If the app is deployed first, chat and thumbs still work; events fail closed and insights stay empty.

## Rollback and recovery

- **App rollback:** safe with `0003` left in place (unused columns/tables). Restores pre-Phase-3 product behavior.
- **Failed migrate:** transaction rolls back; retry with `--retry-failed` after fixing the cause. `IF NOT EXISTS` is idempotent.
- **Schema undo:** not prepared. Dropping `product_events` or columns would be a separate named approval. Do not improvise `DROP`.
- **Bad unique index:** would fail the transaction; empty new table makes that unlikely.

## Outstanding risks

- Until production `0003`, server once-per-day survey uniqueness does not persist; client localStorage is the cap.
- Anonymous `/api/admin/insights` is **401**, not 404; authed non-admins are 404. The HTML page returns 200 with a “Not found” body.
- Conservative ending detector will miss some real closes.
- No 24-month deletion job.
- Verified D1 stays pending until the day after first post-launch authed `message_sent`.
- `schema_migrations` will be created on primary at first execute (new object, not data loss).
- Guest `survey_shown` is not uniquely constrained.

Stop. No production execute, deploy, or ledger bootstrap was performed.
