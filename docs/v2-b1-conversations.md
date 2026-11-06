# Parlé V2-B.1 — rehearsal conversations

**Status:** Implemented on local branch `v2/b1-conversations` and rehearsal Neon only. Production is unchanged. Stop here pending explicit approval for the next milestone.

## 1. Technical design (corrected)

### Ownership

- `conversations` has `PRIMARY KEY (id)` plus `UNIQUE (id, user_id)`.
- `conversation_messages` and `conversation_requests` use `FOREIGN KEY (conversation_id, user_id) REFERENCES conversations (id, user_id)`.
- Routes authenticate with `runApiPipeline({ requireAuth: true })` and always query `user_id = session id`.
- Foreign or unknown conversation IDs return **404** (existence is not confirmed).
- Client `system` / `developer` roles are stripped before completion.

### Durable coordination

- `conversation_requests` stores `idempotency_key`, `status`, `lease_owner`, `lease_expires_at`.
- A live lease on the same conversation returns **429** `processing`.
- Failed or cancelled requests with the same key can be reacquired after expiry or failure; the original user message is reused.
- Conversation rows are locked with `FOR UPDATE` only while inserting the next `seq`, not for the whole stream.
- Separate conversations do not share a user-wide lock.

### Encryption

- Message bodies and training copies use existing AES-GCM `enc:v1:` via `lib/security/encryption.js`.
- List/get decrypt only for the owning user.

### Out of scope (unchanged)

- HavenChat cutover, name prompting, continuation card, legacy wrap-import, production deletion, Vercel, primary Neon.

### Deletion / personalization (design only)

- Archive vs soft-delete vs erasure stay distinct; B.1 has no delete API.
- Names stay conversation-scoped in later milestones. Crisis handling stays turn-contextual.

## 2. Changed files

Local branch `v2/b1-conversations` at production SHA `badd746b1ec8dda4c912760376fca25a475a9c8b` (uncommitted V2 work):

- `database/migrations/0005_conversations_v2.sql` (new)
- `database/schema.sql` (snapshot of new tables)
- `lib/parle/conversations.js` (new)
- `pages/api/conversations/index.js` (new)
- `pages/api/conversations/[id].js` (new)
- `pages/api/conversations/[id]/messages.js` (new)
- `tests/unit/conversationsFilter.test.js` (new)
- `tests/unit/conversationsV2.int.test.js` (new)
- `tests/unit/migrateArgs.test.js` (0005 listed)
- `docs/database.md` (0005 rehearsal note)
- `docs/v2-b1-conversations.md` (this file)
- `scripts/v2b1-rehearsal-check.js` (identity/ledger check)

Not modified: `pages/api/chat/*`, `lib/chatMemoryDb.js`, HavenChat, Vercel, production env.

P1 resurrection work remains on `preserve/p1-chat-resurrection` @ `3728141`.

## 3. Rehearsal schema and API contracts

Tables: `conversations`, `conversation_messages`, `conversation_requests` (see `0005_conversations_v2.sql`).

| Method | Path | Auth | Success |
| --- | --- | --- | --- |
| GET | `/api/conversations` | required | `{ conversations: [{ id, status, origin, mode_id, title, last_message_at, created_at }] }` |
| POST | `/api/conversations` | required | `201 { conversation }` |
| GET | `/api/conversations/:id` | required | `{ conversation, messages: [{ id, conversation_id, role, text, seq, created_at }] }` |
| POST | `/api/conversations/:id/messages` | required | SSE (`delta` / `done`) or `200 { replay: true, requestId, conversationId }` |

Send body: `{ text, idempotencyKey?, clientMessageId?, messages? }`. Privileged client roles ignored. Guests: **401**.

## 4. Test results

Command: `node scripts/run-with-rehearsal.js node --test tests/unit/conversationsFilter.test.js tests/unit/conversationsV2.int.test.js tests/unit/migrateArgs.test.js`

- First run: 13 pass / 1 fail (wall-clock overlap flake on separate conversations).
- After barrier test: **14 pass / 0 fail**.
- Integration assertions: cross-user 404, FK reject mismatched ownership, `enc:v1:` at rest, distinct IDs, Chat A vs A2 isolation, idempotent retry replay, serialized seq on one chat, gated parallel streams on two chats, failed request recoverable on same key, aborted stream leaves `cancelled` without assistant, guest GET 401, synth users have 0 `chat_memory` rows, `chat_memory` count+max_id unchanged during the test.

## 5. Verified database branch

- Project `little-truth-88273418`
- Branch `br-square-unit-apbswjj3`
- Endpoint `ep-royal-smoke-aplmf7b6` (migrate identity)
- `schema_migrations`: `0005_conversations_v2.sql` **applied** at `2026-10-29T07:58:35.528Z`

## 6. Legacy tables

- No writes to `chat_memory` from V2-B.1 code paths.
- During the passing integration test, `COUNT(*)` and `MAX(id)` of `chat_memory` were equal before and after.
- Post-check: `chat_memory` n=`191`, max_id=`263`; leftover `v2b1-*` users = 0.
- Primary branch was not migrated.

## 7. Remaining risks

- Send handler is not rate-limited inside the library path (pipeline defers; production chat still uses its own limiter).
- Provider errors in production send still fall back to a canned reply unless `fallbackReply` is disabled; tests disable it.
- Leases are 45s; a longer stream that dies without updating the lease can be stolen.
- HTTP smoke against a running Next server was not run (library + handler 401 only).
- `conversation_requests` unique key is per user+conversation+idempotency, not global.
- Legacy `/api/chat/send` still uses an in-memory per-user lock.

## 8. GO / NO-GO

- **GO** to keep this isolated V2-B.1 work on `v2/b1-conversations` and rehearsal `br-square-unit-apbswjj3`.
- **NO-GO** for production migrate, git push to `main`, Vercel, HavenChat cutover, name prompting, continuation card, or legacy import.
- Next milestone requires a new explicit approval.
