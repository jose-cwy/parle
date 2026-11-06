# Parlé V2-B.2 — backend hardening

**Status:** Complete on `v2/b1-conversations`. Rehearsal Neon only. Production and HavenChat unchanged. Stop pending explicit approval.

## 1. Exact changed files

- `database/migrations/0006_conversation_lease_token.sql`
- `database/schema.sql`
- `docs/database.md`
- `docs/v2-b2-hardening.md`
- `lib/parle/chatStreamResponse.js`
- `lib/parle/conversationComplete.js`
- `lib/parle/conversationSendPolicy.js`
- `lib/parle/conversations.js`
- `lib/parle/v2TestStream.js`
- `lib/rateLimiter.js`
- `pages/api/conversations/index.js`
- `pages/api/conversations/[id].js`
- `pages/api/conversations/[id]/messages.js`
- `scripts/v2b2-http-sse-gate.js`
- `tests/api/conversationsV2.http.test.js`
- `tests/unit/conversationsV2.int.test.js`
- `tests/unit/migrateArgs.test.js`
- `tests/unit/rateLimiter.test.js`

Production SHA remains `badd746`. P1 remains `preserve/p1-chat-resurrection` @ `3728141`.

## 2. Rate-limit behavior and evidence

`POST /api/conversations/:id/messages` uses the same `userChat` burst (40/min per user) and authenticated daily cap as `/api/chat/send`.

- Auth and ownership run first. Guests 401. Foreign IDs 404. Neither creates rows.
- Burst and daily increment run only for a **new** idempotency key.
- Completed or in-flight same-key retries skip quota (`skipQuota`).
- Account-level burst is keyed by `userChat:user:<id>`, so Chat B cannot bypass Chat A’s cap.
- The old per-user `withChatProcessing` lock is **not** applied; conversation leases serialize one chat without blocking another.
- Guest quota policy is unchanged (`guestChat` still only `/api/chat/guest-send`).

Evidence: `tests/unit/rateLimiter.test.js`, quota skip in `conversationsV2.int.test.js`, HTTP burst 429 via `PARLE_USERCHAT_BURST=6` only while `PARLE_V2_TEST_STUB=1` (production limit stays 40).

## 3. Lease expiry and stale-writer results

- `lease_token` fencing on acquire; persist is `SELECT … FOR UPDATE` then complete **only** if the token still owns `streaming`.
- Heartbeat `touchLease` during tokens; lost owners do not persist.
- SSE `done` is deferred until persist succeeds so clients do not observe completion before the row exists.
- Lease window is 90s to cover the 60s provider stream timeout, with fencing rather than a process lock.

Evidence: int test expired a live lease, persisted with the new token, rejected the stale token (`stale-writer-must-not-land` absent). Same-chat seq unique; separate chats overlapped via start barrier.

## 4. Canned fallback before/after

- **Before (V2-B.1):** V2 send passed a canned `Yeah, that's a lot…` into `streamChatReply` on provider failure and could persist it as an assistant message.
- **After:** V2 never passes `fallbackReply`. Provider errors emit `{ error: 'provider_error' }`, mark the request `failed`, and do not insert an assistant row. Deterministic stubs exist only when `PARLE_V2_TEST_STUB=1`.
- **Unchanged:** production `/api/chat/send` still uses its existing canned fallback. Prompts, six modes, crisis JSON, guardrails, and OpenAI timeouts are reused on the real V2 path (`buildV2CompletionMessages`).

## 5. HTTP/SSE results

`node scripts/run-with-rehearsal.js node scripts/v2b2-http-sse-gate.js`

Next on `127.0.0.1:3053`, `DATABASE_URL` forced to rehearsal, `PARLE_V2_TEST_STUB=1`.

**pass 1 / fail 0** (create, list, get, SSE `stub-ok`, consecutive reload, duplicate replay, same-chat concurrent, split-chat concurrent, foreign 404, fail+recover, client abort hang, burst 429).

## 6. Encryption and isolation

HTTP and int tests: stored `text_enc` matches `^enc:v1:` and does not contain plaintext markers. User B GET/POST of User A’s id returns 404. FK rejects mismatched `conversation_id`/`user_id`.

## 7. Legacy `chat_memory`

V2 paths do not write `chat_memory`. HTTP and int tests compared `COUNT(*)` and `MAX(id)` before/after. Unchanged.

## 8. Rehearsal identity

- Project `little-truth-88273418`
- Branch `br-square-unit-apbswjj3`
- `0006_conversation_lease_token.sql` applied on that branch only

## 9. Remaining blockers

- HTTP gate uses explicit test stubs, not live OpenAI (cost/flake). Real provider wiring is in the non-stub path and is unproven over HTTP against the live model.
- Burst 429 over HTTP used a stub-only lowered cap so the check finished inside one window; production remains 40/min (unit-tested).
- Production `/api/chat/send` canned fallback is still present by design.
- HavenChat is not connected. Local Next leftover processes may remain on older 304x ports.
- No dual-write, names, continuation card, or legacy import.

## 10. GO / NO-GO

- **GO** to keep this isolated backend as the V2 API foundation.
- **NO-GO** for production HavenChat cutover, deploy, push, or primary migrate.
- A later milestone may attach UI on this branch against rehearsal only, after explicit approval.
