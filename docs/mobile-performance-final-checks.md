# Mobile chat performance — final pre-deploy checks

**Date:** 22 October 2026 (UTC+8)  
**Production:** not deployed. No schema, model, prompt, or privacy-control changes.

**Gate verdict (22 Oct 2026, later pass):** **GO for production approval.** Not deployed. Rollback SHA remains `3913dea`.

---

## 1. Authenticated API 500 — root cause

This was **not** a chat-product regression and **not** a missing seed account.

**Evidence:**

| Check | Result |
|---|---|
| Seed user `testuser_a@parle.test` (`8e7f7acf-…`) | Present (`created_at` 2026-10-20). Login `200 {"ok":true,"firstTime":true}` on `:3000` and `:3003` |
| `GET /api/auth/me` | `200`, `isAdmin: false` |
| `GET /api/user/settings` | `200` (`memory_enabled: true`, `personalisation_enabled: true`) |
| Authed crisis `POST /api/chat/send` | `200` safety JSON with `1-767` / IMH / chat.mentalhealth.sg |
| Authed normal send | `200` SSE stream, then `insertChatMessage` |
| `POST /api/chat/session-end` | `200 {"ok":true}` |
| `tests/api/remediation.test.js` authed forge | **Passed** against `:3003` (login `200`, crisis + normal send `200`) |
| `tests/api/authedJourneys.test.js` | **Passed** (login, settings combos, journal, session-end) |

Login `500` is `handleApiError` in `pages/api/auth/login.js` after a thrown error (almost always `db.query`). The earlier suite `500` on login (not `401`, so it was **not** “user missing”) matches an **unhealthy Next process**, not a seed miss.

The same class of failure was reproduced on `/chat` as:

`TypeError: getStaticPaths is not a function`

while `/api/auth/login` still returned `200`. Mass `500`s on a stale `:3000` were the same family: the Pages Router worker was corrupt, not the chat UI diff.

**Resolution:** use a healthy `next dev`. Seed account is valid. No API code change required for the 500.

---

## 2. Persistence / recovery

| Scenario | Guest | Authed |
|---|---|---|
| Completed stream | User + assistant written to `sessionStorage` (throttled + flush on done) | User inserted before stream; assistant inserted after stream completes; `/api/chat/history` restore |
| Refresh during stream | User turn kept if persist already flushed (send persists the user turn immediately) | User kept **after** `insertChatMessage` returns. Reload **before** that can drop the live turn (no archive row yet) |
| Network interrupt | User turn remains once; empty assistant bubble is dropped on abort | Same abort path; server may already have the user row |
| Abort generation | No dedicated Stop button. **New Chat** aborts. Fixed: abort no longer rewrites the guest draft after clear | New Chat archives then resets; session-end fires when a snapshot exists |
| Close tab / new tab | **sessionStorage is tab-scoped** — a new tab does not restore a guest draft. Same-tab hide/`pagehide` + reload does | Server history + local archives survive a new tab |
| New Chat / Clear Chat | UI empties. **Bug found:** abort persist could restore the draft after New Chat. **Fixed locally:** bump opGen before abort, skip persist if stale, `clearGuestChatDraft()` in `resetToPreChatSync()` | Live chat archived then cleared; `/api/chat/clear` when needed |
| Session-end / memory | N/A | Settings PATCH `200`; session-end `200`; memory-on injects stored last-session summary (unit coverage) |

Also fixed: `maybeOfferOutcomeSurvey` referenced removed composer `text` (`ReferenceError: text is not defined` on mobile). Draft is now read from `composerDraftRef`.

---

## 3. Long chat + 4× CPU rematch

Isolated Chromium, `PLAYWRIGHT_BASE_URL=http://localhost:3004`, **workers=1**, 49-character sample `this is a longer thought about how I feel tonight`, 390×844 + `Emulation.setCPUThrottlingRate=4` for the rematch.

| | 60-msg 4× CPU avg | p95 | max | nodes | buttons |
|---|---|---|---|---|---|
| **Audit (before)** | **28.1 ms** | **34 ms** | 42 ms | ~1003 | **170** |
| **After (isolated)** | **10.21 ms** | **15 ms** | 21.6 ms | **688** | **83** |

Unthrottled (same isolated run):

| Messages | avg | p95 | nodes | buttons |
|---|---|---|---|---|
| 5 | 1.59 ms | 3.4 ms | 212 | 27 |
| 20 | 2.35 ms | 3.7 ms | 348 | 43 |
| 60 | 1.73 ms | 3.1 ms | 686 | 83 |
| 100 | 1.72 ms | 2.7 ms | 1026 | 123 |

Scroll-up stay-put passed on the healthy `:3003` run. Older copy/edit/resend/feedback are behind ⋯ and remain in the DOM when opened. Parallel 8-worker 4× (avg 44 ms) is **invalid** — CPU contention.

---

## 4. Guest rate-limit 200 vs 429

`guestChat` is **10 requests / 60s per IP**, checked **before** crisis, guardrail, and the model. `"write me html for a button"` is out of scope (`200` + `guardrail: true`) and **still counts**.

On a healthy `:3005`:

- Sequential 11: 10× `200` guardrail (~2–6s each), **11th `429 rate_limited` in 28s**
- Burst 11: **exactly one `429 rate_limited`**, rest guardrail `200`

The earlier sequential run that got **11th = 200** took **63s**, which is past `resetAt`. That is a **test-window miss**, not a guardrail bypass and not a limiter defect on one process.

**Known limitation (unchanged):** the bucket is in-memory per Node instance. Serverless replicas do not share it. Documented separately from the test miss.

The gated test now bursts 11 requests on a unique `x-forwarded-for` and asserts at least one `rate_limited` 429.

---

## 5. Release-gate regression (healthy `:3005`, 1 Playwright worker)

| Suite | Result |
|---|---|
| `npm test` | **139 passed**, 1 skipped |
| Isolated `remediation` + `rateLimits` (`RUN_API_TESTS=1`) | **9 passed**, including 11th guest `429` |
| Chromium chat-perf + onboarding + audit + release-gate | **20 passed** (New Chat abort, survey, crisis persist, older ⋯, authed stream) |
| Mobile release-gate + onboarding + crisis + scroll | **9 passed** |

Overlapping guest sends on `127.0.0.1` will 429 later tests in the same minute (empty-state “free messages return at 4:00 pm”). That is the limiter, not a UI regression. Re-run guest UI tests after the window.

---

## 6. Remaining limitations

- Guest drafts do not survive a **new tab** (`sessionStorage`).
- Authed live turns persist to Neon only after `insertChatMessage`; very early refresh can lose the UI turn if no archive exists.
- No **Stop generating** control; abort is New Chat / session switch.
- Older actions stay behind ⋯.
- `useLayoutEffect` SSR warning on the composer.
- iOS keyboard / `visualViewport` still not done.
- No list virtualization; 100 messages is still fully mounted.
- Next `dev` can 500 pages (`getStaticPaths is not a function`) after heavy HMR — restart the server; do not treat that as a product 500.
- Real iPhone Safari / Android Chrome still untested.

---

## 7. Git diff summary

Product:

- `lib/parle/chatUiPerf.js` (new)
- `components/haven/ChatInputBar.js` — composer isolation + draft ref
- `components/haven/HavenChat.js` — batched stream, follow-scroll, throttled persist, abort/New Chat draft fix, survey draft ref
- `tests/unit/chatUiPerf.test.js`, `tests/e2e/chat-perf.spec.js`, `tests/e2e/release-gate.spec.js`
- `tests/lab/` — 4× rematch harness (not in default Playwright discovery)
- `tests/e2e/audit.spec.js`, `tests/e2e/onboarding.spec.js` — visible Send/composer
- `playwright.config.js` — `workers: 1`, ignore `_*.spec.js`
- `tests/api/rateLimits.test.js` — burst 11
- docs listed above

No production deploy, no schema, model, prompt, privacy, or admin-auth change.

---

## 8. Production deployment readiness

**GO for named production approval. Do not deploy until you sign off.**

Production rollback: `3913dea` on `parle.chat`.

Suggested smoke after deploy: guest 1-turn stream, crisis hotlines, New Chat then refresh (empty), authed 1-turn + refresh, ⋯ on an older reply, optional check-in on a two-turn close.
