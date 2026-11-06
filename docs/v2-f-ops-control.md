# Parlé V2-F — operational generation control (rehearsal)

**Status:** Implemented on rehearsal only. Not exposed in production. No genuine migration, deploy, or primary schema in this milestone.

Production SHA remains `badd746b1ec8dda4c912760376fca25a475a9c8b`. Branch `v2/b1-conversations`. Rehearsal Neon `br-square-unit-apbswjj3`.

`PARLE_V2_RECOVERY` stays a rehearsal env overlay. It is **not** the operational control.

## Generation control

**Key:** `v2_generation`  
**Values:** `live` | `read_only`  
**Enablement:** `PARLE_V2_OPS_CONTROL=1` **and** connected Neon branch `br-square-unit-apbswjj3`.  
Primary branch `br-morning-sun-apghun9g` is refused. Without the env flag the control is inactive (`live`).

### Authorization

- Route: `GET|POST /api/admin/ops/v2-generation`
- Pipeline auth + `ADMIN_EMAILS` via `guardAdminApi` / `requireAdminUser`
- Unauthenticated and ordinary users receive the existing admin 401/404 hide
- Inactive (no env flag, production without flag, wrong/primary branch): **404**
- POST body: `{ value, confirm: "READ_ONLY"|"LIVE", reason (>=8 chars), expectedRevision }`
- Re-enable requires `confirm: "LIVE"` plus a matching revision. No silent flip from a GET failure.

### Failure behavior

| Condition | Generation |
| --- | --- |
| Flag off / wrong branch / primary | `live` (control not active) |
| Missing row, no prior confirmed `read_only` | `live` |
| Confirmed `read_only`, then DB read fails or row missing | **stay `read_only`** (sticky) |
| Confirmed `live`, then DB read fails | stay `live` |
| Cold process, DB read fails, nothing confirmed | **fail-closed `read_only`** until a successful read |
| Stale cache | 8s TTL; errors 2s then retry |
| Concurrent admin POST same `expectedRevision` | one commit, the other **409 `revision_conflict`** |

Audit: `parle_ops_control_audit` plus `ops_control_changed` log (actor id, old/new, revision, reason). No transcripts.

### Send path

`authorizeConversationSend` and `sendConversationMessage` consult the control **before** inserting `conversation_requests` or `conversation_messages`. Completed idempotent requests may replay. Ownership, encryption, burst, and daily limits are unchanged.

GET list / GET conversation / archive / restore / Earlier conversations **do not** require generation to be live.

### In-flight boundary

`read_only` blocks **new** POSTs. An already-acquired lease/stream is **not** aborted by the switch. That stream may persist its assistant row if it completes successfully. After it finishes, further new sends stay blocked until an authorized `LIVE` re-enable.

## Migration execution plan (not executed)

Retaining `chat_memory` rows is **not** a rollback. V2 `origin=live` chats live in `conversations` / `conversation_messages`. Redeploying `badd746` without V2 read APIs hides those chats.

### 1. Quiesce legacy `chat_memory` writes

1. Production remains on `badd746` `/api/chat/send` until wrap exists for every eligible account.
2. Deploy V2 **read** APIs and wrap job **without** cutting HavenChat send.
3. Open a named freeze window: stop new `/api/chat/send` and import-guest inserts (maintenance or send 503). Do **not** run `/api/chat/clear`.
4. Catch-up wrap with `writesQuiesced: true` until unmapped count is 0.
5. Only then cut HavenChat to V2 send. Keep `chat_memory` rows. Use `v2_generation=read_only` if a generation incident occurs after cutover.

### 2. Enumerate eligible accounts

Eligible = `users` with at least one `chat_memory` row, scoped `WHERE user_id = $owner`. Paginate `SELECT DISTINCT user_id FROM chat_memory ORDER BY user_id`. Do not wrap strangers in the same job. Synth `@parle.test` stays rehearsal-only.

### 3. Ownership-scoped wrap-copy verification

For each user, `reconcileUserLegacyWrap` must show:

- `wrapCount = 1`, `origin = legacy_timeline`
- `unmappedCount = 0`, `extraDestCount = 0`
- `ownerMismatchCount = 0`
- ciphertext and created_at match on mapped rows
- `orderMismatchCount = 0`
- destination `user_id` equals source `user_id`

A global row count without owner scope is insufficient.

### 4. Late commits and interrupted runs

- `writesQuiesced: false` → `pending_quiesce`; catch-up after freeze.
- Injected/process crash → `interrupted`; resume wrap (idempotent map on `chat_memory_id`).
- Late insert after snapshot → new unmapped ids; catch-up batch required.
- Stop the cutover if any eligible user is `legacy_only` or `interrupted` with leftover unmapped rows.

### 5. Accounts without a completed wrapper

They must keep reading **legacy** history (`/api/chat/history` while still on badd746, or a partial wrap `origin=legacy_timeline` once it exists). Do not cut their HavenChat send to V2-only until wrap `state=migrated`. Incomplete wrap remains read-only; send on wrap is 403.

### 6. Newly created V2 conversations during recovery

`origin=live` rows stay in V2 tables. Recovery UI/API must keep listing/GET/`?c=`/archive for those ids. `v2_generation=read_only` blocks new generation but must not hide existing V2 chats. Rolling back the app SHA without those APIs makes retained rows unreachable.

### 7. Stop conditions and recovery actions

| Stop | Action |
| --- | --- |
| Primary branch / checksum mismatch on migration | Abort; do not continue |
| Any eligible user without completed wrap at cutover | Keep legacy send; resume wrap |
| Wrap owner mismatch or extra dest rows | Halt that user; do not delete source |
| Control read fails after confirmed `read_only` | Stay read-only; do not assume live |
| Need to stop generation after cutover | Admin `READ_ONLY` with reason + revision |
| Need app rollback | Keep a build that can **read** V2 and wrap; do not ship `badd746` alone |
| Data incident | Do not `DELETE`/`UPDATE` `chat_memory`; snapshot first |

**Rollback of code ≠ rollback of data.** Plan a dual-read build before any production SHA change.
