# Parlé V2-D — legacy history migration design

**Status:** D.1–D.3 implemented on rehearsal only. D.4+ not authorized. No production execution, deploy, or primary schema.

Production SHA remains `badd746`. Branch `v2/b1-conversations`. Rehearsal Neon `br-square-unit-apbswjj3`.

**Recommendation:** **GO** for rehearsal development of a **lossless one-timeline wrap** plus a **read-only “Earlier conversations” surface**. **NO-GO** for production execution, for inferring per-chat boundaries, and for deleting `chat_memory`.

---

## 1. Exact legacy dependencies

### Server timeline (`chat_memory`)

Schema (rehearsal `information_schema`, matches `database/schema.sql`):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK | serial; gaps exist after deletes |
| `user_id` | uuid → `users` | only ownership column |
| `role` | text | writers use `user` / `assistant` |
| `text` | text | AES-GCM `enc:v1:` via `DATA_ENCRYPTION_KEY` |
| `training_content` | text | same cipher, PII-scrubbed plaintext then encrypted |
| `created_at` | timestamptz | insert time; guest import may pass a client timestamp |

**There is no `conversation_id`, `session_id`, `mode_id`, or import source on the row.**

Writers:

- `/api/chat/send` — `insertChatMessage` user then assistant (crisis/guardrail/stream persist)
- `/api/chat/import-guest` — appends guest draft **only if** the account already has zero `chat_memory` rows
- `/api/chat/clear` — `DELETE FROM chat_memory WHERE user_id = $1` (whole account)
- Edit/resend truncate is **disabled** (`applyChatMemoryEditTruncate` no-ops) because trailing deletes cannot prove thread identity

Readers:

- `/api/chat/history` — last **200** rows `ORDER BY created_at ASC` (not a full dump)
- `/api/chat/send` completion — last 14 for model context when the client omits `messages`
- `/api/chat/session-end` — last 40, then capped by untrusted client `message_count`

Ordering is `(created_at, id)` in practice. Two rows can share `created_at`; **id is the stable sequence**. History currently sorts by `created_at` only.

### Encryption

`lib/security/encryption.js`: `enc:v1:{iv}:{tag}:{ciphertext}`, AES-256-GCM, 32-byte `DATA_ENCRYPTION_KEY`. Decrypt of a non-prefixed value returns the string unchanged. Decrypt failure logs `decrypt_failed` and returns `''` (empty), which is a **data-loss hazard** if a migrator decrypts then re-encrypts blindly.

V2 `conversation_messages.text_enc` / `training_content_enc` use the **same** helper.

### What cannot be recovered from the server

- Individual conversation / New Chat boundaries
- Which sidebar title belonged to which stretch of the timeline
- Locally archived vs live pane (browser-only)
- Local tombstones (`parle.chat.archives.deleted.v1`)
- Guest vs authed origin **after** import (imported rows look identical)
- Messages deleted by `/api/chat/clear` or older truncate paths (id gaps)
- More than 200 rows via the current history API (the table itself may hold more)

### Browser archives vs server

`lib/parle/chatArchives.js` stores up to 40 transcripts in `localStorage` keyed by local user id. That is **not** a replica of `chat_memory`. P1/`chatClearPolicy` exists because New Chat used to wipe the **whole** server timeline. Server rows may mix several UI sessions; local archives may contain slices the server never split, or copies of the same text.

**Do not treat local archives as source of truth for migration.** Optional later: a user-initiated export of local archives into `origin=archive_import` conversations. Out of scope until a separate approval.

### Memory and summaries

- `users.last_session_summary` — encrypted, overwritten on session-end when `memory_enabled`
- `users.memory_enabled` / `personalisation_enabled` — consent for summary + living profile, not for storing the transcript
- `/api/chat/returning-opening` — LLM over the summary, not over `chat_memory`
- `session_signals` — telemetry keyed by client `sessionId`; **cannot join to message rows**
- Immediate model context is the **active thread**, not the account timeline (`immediateChatHistory.js`)

Migration must **not** insert the summary as a fake message, and must **not** feed the wrap timeline into new V2 completions.

### Guest identification

`planGuestImport` skips if any `chat_memory` row exists. There is **no** `legacy_import_key` on those inserts. Guest drafts currently land in a **new V2 conversation locally** (V2-C) and are not written to `chat_memory`. Historical imported guest text already in `chat_memory` cannot be labeled after the fact.

### Rehearsal shape (aggregates only, no plaintext)

Inspector: `scripts/v2d-legacy-shape.js` on `br-square-unit-apbswjj3`.

| Fact | Value |
| --- | --- |
| `chat_memory` rows | 191 |
| Distinct users with rows | 1 |
| `enc:v1:` on `text` | 191 / 191 |
| `enc:v1:` on `training_content` | 191 / 191 |
| roles | 104 user / 87 assistant / 0 other |
| id range | 1–263 (gaps) |
| max rows on one account | 191 |
| V2 conversations / messages | 53 / 250 |
| `origin=legacy_timeline` | 0 |

All rehearsal ciphertext is prefixed. Production counts were not queried.

---

## 2. Recommended strategy and trade-offs

### Preferred: one wrap conversation per account

Create **at most one** conversation with:

- `origin = 'legacy_timeline'`
- `legacy_import_key = 'chat_memory:v1'`
- title equivalent to **“Earlier conversations”**
- `status = 'archived'` (or a dedicated send-forbidden origin rule)

Copy **every** `chat_memory` row for that user, in `(created_at, id)` order, into `conversation_messages` with monotonic `seq`.

**Why this is the lossless baseline**

- Matches the actual data model (one timeline)
- Does not invent New Chat cuts
- Uses existing `origin` / `legacy_import_key` unique index from `0005`
- Users still see history; new chats stay separate UUIDs

**Trade-off:** the wrap looks like one long thread. That is honest. Splitting would be fiction.

### Alternative: read-only history view without copying

Keep serving `/api/chat/history` (raise the 200 cap or add a cursor) behind a labeled UI, never inserting V2 rows.

**Trade-off:** two storage systems forever; pagination/search/archive diverge; cutover of HavenChat stays dual-path. Acceptable as a **temporary** compatibility surface while wrap copy is verified, not as the end state.

### Rejected

- Inferring conversations from time gaps, mode, or `session_signals`
- Replacing the wrap with localStorage archives
- Deleting `chat_memory` as part of migration
- Feeding wrap messages into new-chat completions (“Last time we talked…” is a later milestone)

### How users avoid merging

1. Wrap is not selected on New Chat.
2. `POST .../messages` on `origin=legacy_timeline` returns **409/404** (send forbidden).
3. Completion builders skip `legacy_timeline` threads.
4. Sidebar lists wrap under a **History** heading, not in the live stack.
5. Restore-from-archive must **not** silently turn a wrap into a writable live chat without an explicit “continue in a new chat” that **copies nothing** and only opens a blank V2 conversation.

---

## 3. Proposed schema / mapping

Existing, reuse:

- `conversations.origin` including `legacy_timeline`
- `UNIQUE (user_id, legacy_import_key) WHERE legacy_import_key IS NOT NULL`

Additive (rehearsal first; **not applied now**):

```text
user_chat_migration (
  user_id UUID PK REFERENCES users(id),
  state TEXT NOT NULL,           -- see §4
  snapshot_max_id BIGINT,        -- chat_memory.id frozen at start of a pass
  copied_through_id BIGINT,      -- restart cursor
  wrap_conversation_id UUID,
  started_at / finished_at / error TEXT
)

conversation_legacy_map (
  user_id UUID NOT NULL,
  chat_memory_id INTEGER NOT NULL,
  conversation_id UUID NOT NULL,
  conversation_message_id UUID NOT NULL,
  PRIMARY KEY (user_id, chat_memory_id),
  FOREIGN KEY (conversation_id, user_id) REFERENCES conversations (id, user_id)
)
```

Copy algorithm:

1. Lock `user_chat_migration` for that user (`FOR UPDATE`).
2. `SELECT id, role, text, training_content, created_at FROM chat_memory WHERE user_id = $1 AND id > copied_through_id ORDER BY created_at ASC, id ASC`.
3. **Do not decrypt** prefixed ciphertext. Copy `text` → `text_enc`, `training_content` → `training_content_enc`.
4. Non-prefixed rows: encrypt in-process; never log plaintext.
5. Insert map row first-or-skip (`ON CONFLICT DO NOTHING`) so retries cannot duplicate.
6. Preserve `created_at` on the V2 row (column already exists).
7. Advance `copied_through_id`.
8. Repeat until `copied_through_id >= snapshot_max_id`, then one catch-up pass.

GET pagination for the wrap must exceed today’s 80/200 caps (cursor by `seq`).

No change to `DATA_ENCRYPTION_KEY`. Same key, new IVs only when a row was stored in plaintext.

---

## 4. State machine and concurrency

Per-account `user_chat_migration.state`:

| State | Meaning |
| --- | --- |
| `absent` / `legacy_only` | Production path: `/api/chat/send` owns the timeline. No wrap. |
| `migrating` | Wrap exists or is being created. Copy in progress. Legacy writes still allowed **or** briefly paused (see below). |
| `interrupted` | Worker died; cursor retained; safe to resume. |
| `migrated` | Catch-up complete. V2 is the write path. Wrap is read-only. `chat_memory` **retained**. |
| `v2_with_legacy` | Cutover already created live V2 chats **and** wrap. Normal post-C.1 rehearsal accounts. |
| `rolled_back_dual` | V2 UI plus wrap remain visible. Legacy send may be re-enabled. **V2 rows are not deleted.** |

**Interrupted:** leave wrap + map + cursor. Resume is idempotent via `conversation_legacy_map`.

**Concurrent legacy writes:** while `migrating`, `/api/chat/send` may still insert `chat_memory` (production freeze is a later cutover). Each pass snapshots `MAX(id)` and copies `id > copied_through_id`. Final pass requires `MAX(id)` unchanged for one lock interval, then flip to `migrated`.

**After `migrated`:** V2 send only. Dual-write to `chat_memory` is optional and **off by default** (avoids enlarging the legacy table). Retention of existing `chat_memory` is mandatory until a later retirement approval.

**Cross-account:** every SELECT/INSERT includes `user_id = session user`. Foreign wrap IDs 404. Worker processes one `user_id` at a time with an advisory lock `hashtext(user_id::text)`.

**Local tombstones:** ignored by the server job. They must not hide the wrap.

---

## 5. Reconciliation and rollback

### Reconciliation (audit, no plaintext logs)

Per user, compare:

- `COUNT(*)` from `chat_memory`
- `COUNT(*)` from `conversation_legacy_map`
- wrap `COUNT(*)` from `conversation_messages`
- min/max `chat_memory.id` vs cursor
- ciphertext prefix counts
- `enc:v1:` byte-length equality on a sample of ids (compare ciphertext, not decrypted text)

Mismatch → `interrupted` + error code, no delete.

### Rollback that does not hide V2

Rollback **must not** mean “turn off V2 and show only `chat_memory`.” Leaving database rows is not enough: the live app must still **route, list, and open** both surfaces.

Guaranteed accessible history after a future rollback (design only; no production rollback code in D.1–D.2):

1. All `origin=live` conversations stay in the V2 sidebar and keep their UUIDs (`?c=`).
2. The wrap stays listed as Earlier conversations (`origin=legacy_timeline`, `legacy_import_key=chat_memory:v1`).
3. `user_chat_migration` / `conversation_legacy_map` stay; they are how the wrap is proven complete, not disposable scaffolding.
4. `chat_memory` is still intact (source of truth until a later retirement approval).
5. If legacy `/api/chat/send` is re-enabled, new `chat_memory` rows are **not** mixed into live V2 chats; they wait for a new catch-up into the wrap only. State returns to `pending_quiesce` / `migrating`, never a silent `migrated`.
6. No `DELETE` of `conversation_messages`, wrap rows, or map rows on rollback.
7. Feature flags / routing must keep V2 conversation APIs reachable. Switching HavenChat back to account-wide `chat_memory` as the only UI would hide post-cutover chats even if those rows remain.
8. D.3 UI is not a rollback. If V2 routing is turned off, users lose Chat A even though `conversations` rows remain. A concrete read-access fallback for post-cutover V2 messages: keep `/api/conversations` list+GET (and `?c=` UUID restore) mounted; keep the live sidebar. Wrap remains `/api/conversations/legacy` plus GET with cursor. Do not route post-cutover chats through `chat_memory`.

A user who created Chat A after cutover still sees Chat A. Earlier timeline remains the wrap. That is the anti-simplistic rollback.

**Not authorized now:** production rollback implementation, dual-write cutover, or deleting wrap tables.

---

## 6. User-facing experience

- Sidebar section **Earlier conversations** (not “Deleted”, not mixed with New Chat).
- One item, server title, read-only composer (or composer hidden).
- Short explanation: “This is your previous account history, kept in the order it was saved. New chats are separate.”
- Pagination: `GET /api/conversations/:id?cursor=&limit=&v=` for wrap only. Cursor is opaque base64url JSON `{ t: created_at, i: message id, s: seq }`. The server pages with `seq > s` after owner checks. `v` is wrap `timeline_revision` (monotonic, rehearsal 0009). `updated_at` milliseconds can collide across catch-up/resequence in the same ms, so revision is the stale token. Mismatch returns the first page with `stale: true`. Default 50, max 100. No unbounded dump. Live V2 GET is unchanged (no cursor walk).
- `GET /api/conversations/legacy` returns the owner wrap plus migration state, or `{ conversation: null, migration.state: 'absent' }`. No fabricated entry.
- Wrap is excluded from active/archived lists.
- Opening wrap is explicit (sidebar or restoring `?c=` / stored wrap). New Chat does not select it.
- Guest: no wrap (no `chat_memory`). Existing guest draft → new live V2 chat, already V2-C behavior.
- Memory consent unchanged; returning opening still uses `last_session_summary` when enabled.
- Do not auto-open the wrap after login; restore last **live** `?c=` as today.

---

## 7. Security and privacy

- Owner-scoped SQL only; 404 for others (same as V2-C).
- Copy ciphertext; decrypt only unprefixed rows; never print message text in jobs or reports.
- Same `DATA_ENCRYPTION_KEY`; no key rotation in this milestone.
- Local deleted archives are not server deletes.
- Retain `chat_memory` until an explicit retirement milestone.
- Worker logs: user id, counts, ids, states — **not** bodies.
- Rehearsal first; production job requires a named approval and a frozen send path.

---

## 8. Phased rehearsal implementation plan

Do **not** start until this design is approved.

| Phase | Work | Not included |
| --- | --- | --- |
| **D.0** | Close V2-C.1 gates in §9 | Product cutover |
| **D.1** | Additive map/state tables on rehearsal only | Primary Neon |
| **D.2** | Idempotent copy job on **synth** users (insert known `chat_memory`, migrate, assert counts) | Genuine rehearsal account wrap until synth green |
| **D.3** | Read-only wrap UI + send-forbidden | Names, continuation card |
| **D.4** | Catch-up + dual-access rollback drill on synth | Production |
| **D.5** | Optional: one genuine rehearsal account after founder approval | Delete `chat_memory` |

Each phase stops for approval.

---

## 9. Outstanding V2-C.1 blockers (gates, not work in this phase)

Targeted follow-ups only:

1. **Playwright A–H desktop+mobile** in one run after the `?c=` restore guard (last full run 17/18; D then passed alone).
2. **Mobile Archive** with a normal click (not `force: true`); CSS overlap with the title button.
3. **HTTP burst** `tests/api/conversationsV2.http.test.js` on a Next process with `PARLE_USERCHAT_BURST` **and** stub; confirm 40/min still applies when those env vars are unset.
4. **Test-only switches:** `PARLE_V2_TEST_STUB`, `PARLE_V2_SKIP_DAILY`, `PARLE_USERCHAT_BURST` must no-op in production (`NODE_ENV=production` or unset). Add unit asserts that skip-daily is false when the flag is absent.
5. **Shared `streamChatReply`:** keep `deferComplete` V2-only; re-run `tests/unit/chatStreamAbort.test.js` plus a guest/authed send fixture that still persists fallback.

No implementation in V2-D planning.

---

## 10. GO / NO-GO for migration development

**GO** to implement D.1–D.2 on rehearsal after D.0 gates, using the wrap model.

**NO-GO** for production migration, primary schema, deleting or shrinking `chat_memory`, splitting timelines, Google Sign-In, names, or continuation cards.

**NO-GO** if the next request asks to infer conversation boundaries from timestamps or local archives.
