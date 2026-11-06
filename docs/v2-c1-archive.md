# Parlé V2-C.1 — scoped archive and chat lifecycle

**Status:** Rehearsal-only on `v2/b1-conversations`. Production SHA remains `badd746`. No deploy, no primary migrations.

**Verdict:** **NO-GO** for production cutover. **CONDITIONAL GO** for isolated V2-D planning, not names/continuation/legacy import.

## 1. Archive API contract

No new migration. `conversations.status` already allows `archived`.

| Method | Path | Body | Auth | Success |
| --- | --- | --- | --- | --- |
| GET | `/api/conversations` | — | required | active list |
| GET | `/api/conversations?status=archived` | — | required | archived list |
| PATCH | `/api/conversations/:id` | `{ status: "archived" }` | owner | `{ conversation }` |
| PATCH | `/api/conversations/:id` | `{ status: "active" }` | owner | restore |
| GET | `/api/conversations/:id` | — | owner | active **or** archived thread |

Rules:

- Foreign or unknown IDs: **404**. No row change.
- Archive Chat 2 does not change Chat 1.
- Message rows are kept. Send to an archived id: **404**.
- Sidebar label is **Archive**. Restore is enabled. Copy states chats are stored, not permanently deleted.
- `/api/chat/clear` is not used. `chat_memory` is not written.

## 2. Changed files (this milestone)

- `lib/parle/conversations.js` — archive/restore/list status
- `pages/api/conversations/index.js` — `?status=archived`
- `pages/api/conversations/[id].js` — PATCH
- `lib/parle/conversationClient.js` — archive/restore, selected ID in localStorage + `?c=`
- `lib/parle/conversationSendPolicy.js` — `PARLE_V2_SKIP_DAILY` test-only
- `lib/parle/chatStreamResponse.js` — empty provider error SSE only when `deferComplete` (V2)
- `lib/parle/v2TestStream.js` — drip/timeout stubs + header
- `components/haven/HavenChat.js`
- `components/haven/ParleChatSidebar.js`
- `tests/unit/conversationsArchive.int.test.js`
- `tests/unit/chatStreamAbort.test.js`
- `tests/api/conversationsV2.http.test.js`
- `tests/e2e/v2-conversations.spec.js`
- `scripts/v2c-playwright-gate.js`
- `scripts/v2c-mint-and-playwright.js`
- `docs/v2-c1-archive.md`

## 3–8. Evidence and limitations

See the V2-C.1 completion report in chat. Stopped pending approval.
