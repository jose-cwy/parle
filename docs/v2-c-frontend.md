# Parlé V2-C — frontend conversation integration

**Status:** Rehearsal-only on `v2/b1-conversations`. Production SHA remains `badd746`. No deploy, no primary migrations, no production UI cutover.

**Verdict:** **NO-GO** for production cutover. **CONDITIONAL GO** for the next isolated V2 milestone (scoped archive/delete API, then deeper interrupt Playwright), not for names/continuation/legacy migration.

## 1. Real-provider verification

Environment: Neon `br-square-unit-apbswjj3`. `PARLE_V2_TEST_STUB` unset. Script: `scripts/v2c-real-provider-gate.js`.

Result: `REAL_PROVIDER=VERIFIED`

| Check | Result |
| --- | --- |
| First token | true |
| Completion | true |
| Persistence | true |
| Consecutive messages in one conversation | true |
| Crisis JSON (six-mode path still crisis-first) | true |
| No canned fallback | true |
| `chat_memory` row count and max id unchanged | true |

Not exercised against live OpenAI in this gate (covered by stub HTTP/unit tests from V2-B.2):

- Forced provider timeout
- Processing lease expiry and fencing during a live generation
- Multi-tab write collision on the same conversation

Those remain **stub-verified, live-provider NOT VERIFIED**.

Synthetic user was created and deleted on rehearsal only. Transcripts and secrets were not printed.

## 2. Exact changed files (V2-C plus inherited uncommitted V2 work)

V2-C frontend:

- `components/haven/HavenChat.js`
- `components/haven/ParleChatSidebar.js`
- `lib/parle/conversationClient.js`
- `scripts/v2c-real-provider-gate.js`
- `scripts/v2c-playwright-gate.js`
- `tests/e2e/v2-conversations.spec.js`
- `docs/v2-c-frontend.md`

Inherited V2-B on this branch (not production):

- `database/migrations/0005_conversations_v2.sql`
- `database/migrations/0006_conversation_lease_token.sql`
- `database/schema.sql`
- `docs/database.md`
- `docs/v2-b1-conversations.md`
- `docs/v2-b2-hardening.md`
- `lib/parle/conversations.js`
- `lib/parle/conversationComplete.js`
- `lib/parle/conversationSendPolicy.js`
- `lib/parle/v2TestStream.js`
- `lib/parle/chatStreamResponse.js` (shared)
- `lib/rateLimiter.js` (shared)
- `pages/api/conversations/index.js`
- `pages/api/conversations/[id].js`
- `pages/api/conversations/[id]/messages.js`
- `scripts/v2b1-rehearsal-check.js`
- `scripts/v2b2-http-sse-gate.js`
- `tests/api/conversationsV2.http.test.js`
- `tests/unit/conversationsFilter.test.js`
- `tests/unit/conversationsV2.int.test.js`
- `tests/unit/migrateArgs.test.js`
- `tests/unit/rateLimiter.test.js`

Unchanged: `pages/api/chat/send.js`, `pages/api/chat/guest-send.js`, `pages/api/chat/clear.js`, `pages/api/chat/history.js`.

## 3. How HavenChat uses conversation IDs

Authenticated chat:

- Server UUID from `POST /api/conversations` is the only saved-conversation identity.
- Selected ID is cached in `sessionStorage` (`parle.v2.selectedConversation:<userId>`). Refresh restores that ID if it still exists in `GET /api/conversations`, else the newest listed conversation.
- Titles may cache in `localStorage` (`parle.v2.conversationTitles:<userId>`). Titles never own messages.
- Send goes to `POST /api/conversations/:id/messages` with a client idempotency key.
- New Chat calls `createConversation` and switches the selected ID.
- Switch loads `GET /api/conversations/:id` and replaces the pane. Stale commits are gated by `sessionOpGen` / `selectGen`.
- In-flight replies abort on New Chat / switch. Empty assistant placeholders are dropped; the user turn stays.
- Failed send keeps the user message and appends a system notice. Composer restore is used on HTTP errors.
- Onboarding sheet only opens when send returns success (`true`), not `false`.
- Authenticated init does **not** hydrate `/api/chat/history` into the live pane and does **not** import guest drafts into `chat_memory`. A guest draft may land as local messages on a **new** V2 conversation until the next send persists them.

Guest chat still uses `/api/chat/guest-send` and local live-session identity.

## 4. Desktop/mobile Playwright

Gate: `node scripts/run-with-rehearsal.js node scripts/v2c-playwright-gate.js` with stub enabled for deterministic replies. Ports 3071–3074.

Final run: **4 passed (1.1m)**

- Chromium: two chats stay separate across switch and refresh
- Chromium: account B does not see account A markers
- Mobile (Pixel 5): same isolation journey
- Mobile: account B isolation

Covered: create Chat 1, exchange, create Chat 2, exchange, switch, refresh, composer enabled after refresh, archive control visible and disabled, second account.

Not covered in Playwright: leave Chat and return, New Chat during an active stream, switch during stream, refresh during interrupted stream, failure/retry UI, second simultaneous browser tab, lease expiry UI.

## 5. Cross-conversation and cross-user isolation

- Playwright: Chat 1 marker never appears in Chat 2; refresh does not mix markers.
- Playwright: `testuser_b@parle.test` sees zero `v2c-chat1-` / `v2c-chat2-` strings.
- HTTP/unit (V2-B): foreign conversation ID returns 404 and writes no rows; two conversations generate concurrently without mixing; idempotent retry does not duplicate.

## 6. Streaming, retry, cancellation, timeout

| Case | Evidence | Result |
| --- | --- | --- |
| Normal send + complete | Real provider gate + Playwright | Pass |
| Two consecutive messages | Real provider gate + Playwright | Pass |
| New Chat after completed send | Playwright | Pass (pane clears; new ID) |
| New Chat / switch during stream | Client abort + gen guards | Implemented; **no Playwright** |
| Refresh during interrupted stream | sessionStorage restore + GET | Implemented; **no Playwright** |
| Idempotent retry | HTTP/unit stub | Pass (no duplicate user row) |
| Provider fail then retry same key | HTTP/unit stub | User row kept; retry resumes |
| Hang/cancel | HTTP/unit stub | Request not completed |
| Provider timeout / lease expiry | Unit lease fencing + stub HTTP | Stub pass; **live OpenAI NOT VERIFIED** |
| Multi-tab | HTTP concurrent same conversation | 409 processing; **no two-tab Playwright** |

Client: SSE `error` throws from `consumeChatStream`. Empty/failed streams keep the user message and show a recoverable notice.

## 7. Legacy history

`chat_memory` is not written by V2 send. Real-provider gate asserted row count and max id unchanged.

Authenticated HavenChat no longer loads `/api/chat/history` into the live pane. Legacy rows remain in the database. Sidebar footer states they are not in this rehearsal list. No migration, no inferred message boundaries, no `/api/chat/clear`.

## 8. Known limitations

- **No scoped archive/delete API.** Trash is disabled: “Archive is not available in this rehearsal build.” Do not claim deletion.
- Playwright journeys for interrupt, leave/return, failure UI, and two tabs are incomplete.
- Live OpenAI timeout and lease fencing were not re-proven in V2-C.
- Shared `streamChatReply` now emits SSE `error` on empty provider output and skips persist on `providerError`. That affects `/api/chat/send` and `/api/chat/guest-send` **on this branch** even though those route files were not edited.
- Rate limiter maps V2 list/create to `chat` and V2 messages to `userChat`. `PARLE_USERCHAT_BURST` only applies when `PARLE_V2_TEST_STUB=1`.
- Guest-to-auth draft may show locally in a new V2 conversation before the first persisted send.
- P1 preservation branch was not merged.

## 9. Production backend

Production remains SHA `badd746`. This work is uncommitted on `v2/b1-conversations`. No Vercel deploy, no env changes, no primary Neon writes.

`/api/chat/send` source is unmodified. Shared helpers `chatStreamResponse.js` and `rateLimiter.js` **would** change production chat behavior if this branch were deployed. Do not ship until those diffs are reviewed in isolation.

## 10. GO / NO-GO

**NO-GO** for production, migrations on primary, or HavenChat cutover on `parle.chat`.

**CONDITIONAL GO** for the next isolated V2 milestone: implement a safely scoped archive (or keep delete disabled), then add interrupt/leave-return/multi-tab Playwright on rehearsal. Do not start names, continuation cards, legacy import, Google Sign-In, or prompt changes.
