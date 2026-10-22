# V1 release review (pre-deploy)

**Date:** 22 October 2026 (UTC+8)  
**Production (rollback before this release):** `parle.chat` deployment `dpl_133DiMdRZ3Ce3NT99uNp6PPjzex7` (`parle-fp15z1m00-josz.vercel.app`, inspected 22 Oct 2026). Older recorded IDs: `dpl_BEmJeQqKQxWxEN79i58t23baQgbu`, `dpl_DXVay2hZZfZeurYweooQN9wYF7TX`.  
**This review:** local only. **Do not deploy until named approval.**  
**Schema:** no migration required.

## Verdict

| Slice | Ready? |
|---|---|
| **Security hotfix (API)** | **Yes — deploy independently** |
| **Onboarding UX + session-end bound** | **Safe to include in the same deploy** |
| Whole working tree as-is | Yes, if you also keep tests/docs; **exclude `test-results/`** |

Remaining issues (not blockers for this hotfix): in-memory rate limits on Vercel; DB column DEFAULT `false` vs register `TRUE` (no backfill). Admin auth was not weakened.

---

## Priority 1 — Security hotfix

Client `hiddenInjections`, `contextRecap`, and `crossSessionSummary` are discarded on `/api/chat/send` and `/api/chat/guest-send`. Trusted context is built only from:

- stored `last_session_summary` when `memory_enabled`
- allowlisted onboarding enum (authed: `users.onboarding_reason`; guest: body enum only)
- server reply-quality and hidden-think blocks
- user/assistant turns as untrusted data

Privacy flags are unchanged (`COALESCE` still fills NULL only).

**Independent deploy set**

- `lib/parle/trustedPrompt.js`
- `lib/parle/crossSessionMemory.js`
- `lib/parle/preferences.js` (reads `onboarding_reason`)
- `pages/api/chat/send.js`
- `pages/api/chat/guest-send.js`
- matching unit/API tests

An old production client can keep sending those fields; the new API ignores them.

**API evidence (local `:3001`, 22 Oct):** guest crisis with forged fields → hotlines; guest normal turn with forge marker absent from body; authed crisis + normal send with forge marker absent. Unit: 134 pass / 1 skip.

---

## Priority 2 — Session-end

`chat_memory` has **no `session_id`**. Happy path: New Chat runs session-end then `DELETE` so the table is the live conversation. A raw last-40 read can still mix an uncleared earlier session.

**Smallest safe fix (no schema):** treat client `message_count` as a **length cap only** (not as transcript text). Take `min(40, message_count)` latest rows. `message_count` missing/0 → empty transcript → **do not** overwrite last-session summary or living profile. Memory/personalisation off → skip transcript entirely. Cleared buffer → empty.

Synthetic unit tests: mixed earlier+current rows with `message_count = 4` keep only the current session; empty/cleared emit no transcript.

Durable session IDs would need an additive column later (separate approval).

---

## Priority 3 — Onboarding

Focused Playwright `tests/e2e/onboarding.spec.js`, empty storage, Edge desktop + Pixel 5: **4 passed** (~18s). First assistant bubble appeared without answering the sheet. Crisis hotlines appeared without an onboarding choice. Composer stayed enabled.

**Previous Playwright failures**

| Failure | Cause |
|---|---|
| Mobile landing hamburger | **Test environment.** Suite uses Edge + Pixel 5, not iPhone WebKit; desktop nav often has no “Open menu”. |
| Guest crisis composer hidden | **Test + burst.** Empty-state vs hidden bottom textarea; later reruns also hit guest 10/min. Not an onboarding product bug. |

---

## Priority 4 — Diff hygiene

Unrelated / do not ship: `test-results/**`. Optional with the hotfix: `docs/*`, `playwright.config.js`, `styles/parle-chat.css`, `HavenChat.js` / `OnboardingSheet.js` (UX; not required for the API patch). `.gitignore` if it only ignores `.vercel`.

No AI model change. No production schema. No cron emails.

---

## Stop

Approve one of:

1. **API security hotfix only** (recommended first if you want the smallest prod diff).  
2. **Hotfix + session-end + onboarding** (recommended complete slice; still no migration).

Do not promote until you say so.
