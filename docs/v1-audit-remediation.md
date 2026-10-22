# Parlé V1 audit remediation

**Date:** 21 October 2026 (UTC+8)  
**Scope:** local implementation and isolated verification only  
**Production:** unchanged (`josz/parle` / `parle.chat` still `456d591` / `dpl_BEmJeQqKQxWxEN79i58t23baQgbu`)  
**Constraint:** no production deploy, no production schema change, no customer-row edits, no cron emails, no Redis, no model/prompt rewrite.

**Verdict: READY WITH ISSUES**

The P0 prompt-injection path is fixed in this working tree and covered by unit tests. Onboarding no longer holds the first reply. Session-end history is bounded and no longer trusts a client transcript. Privacy defaults are documented without flipping stored `FALSE` flags. Rate limits remain in-memory per instance (known Vercel gap). This code is **not in production**. Do not ship until a named deploy approval.

---

## 1. Findings investigated

### A. Client-controlled AI instructions (P0) — **confirmed, fixed locally**

**Root cause.** `POST /api/chat/send` and `POST /api/chat/guest-send` copied `hiddenInjections`, `contextRecap`, and (authed) `crossSessionSummary` into `buildChatCompletionMessages` as **system** messages. `resolveCrossSessionSummary` fell back to the client string when no stored summary existed. The browser also appended recap/onboarding strings to `hiddenInjections`.

**Fix (smallest).** Ignore those client fields at the API boundary. Build injections only from:

- allowlisted onboarding enum (`heartbreak` | `friendship_family` | `just_talking`) mapped server-side
- authed `users.onboarding_reason` (not free text)
- guest `onboardingReason` only if it matches that enum
- server-computed reply-quality and hidden-think blocks
- stored `last_session_summary` when `memory_enabled` (never a client summary)

User messages, guest `messages` history, and image attachments stay untrusted user/assistant content.

**Files:** `lib/parle/trustedPrompt.js`, `lib/parle/crossSessionMemory.js`, `lib/parle/preferences.js`, `pages/api/chat/send.js`, `pages/api/chat/guest-send.js`, `components/haven/HavenChat.js`, `tests/unit/trustedPrompt.test.js`, `tests/unit/crossSessionMemory.test.js`, `tests/api/remediation.test.js`.

### B. Onboarding overlay — **confirmed, fixed locally**

**Root cause.** The first user send stored a pending reply, opened a modal overlay, and set `inputDisabled` from `onboardingSheetOpen`, so streaming never started until skip/select.

**Fix.** Send immediately. After the first reply returns, dock a non-modal sheet above the composer. Composer stays enabled. Onboarding context for later turns is server-side (DB or allowlisted guest enum), not a client system injection.

**Files:** `components/haven/HavenChat.js`, `components/haven/OnboardingSheet.js`, `styles/parle-chat.css`, `lib/parle/onboarding.js`, `tests/e2e/audit.spec.js`.

**Browser evidence.** Playwright Chromium (first isolated run this phase) sent a guest crisis line, showed SG hotlines **and** the onboarding dialog, with the composer not treated as overlay-locked. The Cursor IDE browser on `localhost:3000/chat` was already an **authenticated** session (history + thumbs), so it was not a clean guest overlay lab. Do not treat that tab as guest.

### C. Session-end unbounded `chat_memory` — **confirmed, fixed locally**

**Root cause.** If the client omitted `transcript`, session-end `SELECT`ed all `chat_memory` rows for the user. A forged client transcript could also become the living-profile / last-session summary source.

**Fix.** Ignore client `transcript`. Load at most **40** recent decrypted rows via `getRecentChatMessages` and `formatSessionTranscript`. Encrypted summary + living-profile writes still run when those flags are on and the bounded transcript is non-empty.

**Files:** `lib/parle/sessionTranscript.js`, `pages/api/chat/session-end.js`, `tests/unit/sessionTranscript.test.js`.

Synthetic unit histories: 6 turns kept in full; 80 turns truncated to the latest 40.

### D. Privacy preference defaults — **documented, no user-row mutation**

| Source | `memory_enabled` | `personalisation_enabled` |
|---|---|---|
| Product intent for **new** accounts | ON | ON |
| `INSERT` in `lib/handlers/authRegister.js` | `TRUE` | `TRUE` |
| Neon column DEFAULT | `FALSE` | `FALSE` |
| `DEFAULT_USER_SETTINGS` / UI | `true` | `true` |
| `ensureUserSettingsDefaults` | `COALESCE(..., TRUE)` — **NULL only** | same |

**Intended behavior.** New registrations are opted in by the INSERT. A user who set either flag to `FALSE` stays off. NULL (legacy) is filled to ON on settings read. The column DEFAULT remaining `FALSE` is a schema mismatch: a raw INSERT that omits the columns would create opted-out users.

**Not done (needs separate approval):** `ALTER TABLE users ALTER COLUMN memory_enabled SET DEFAULT TRUE` (and personalisation). **Not done:** any `UPDATE users SET memory_enabled = TRUE WHERE ...`. Seed `@parle.test` accounts were toggled through all four combinations then restored to their previous values during API journeys.

**Files:** `lib/parle/userSettings.js` (comments), `tests/unit/userSettings.test.js`.

### E. Distributed rate limiting — **evaluated, not implemented**

In-memory `lib/rateLimiter.js` and `lib/chatProcessingLock.js` still apply. They were **not** disabled. On Vercel they are per isolate, so aggregate guest 10/min and processing locks are weaker than a single-process lab.

**Minimal shared-state options (not added):**

1. **Upstash Redis / Vercel KV** — correct for token buckets + short TTL locks. New dependency and a small monthly cost even at hobby volume; failover if Redis is down must fail closed or fall back to in-memory (weaker).  
2. **Postgres rows / `pg_advisory_lock`** — no new vendor. Advisory locks are **connection-scoped** and would pin a pool client for the whole model stream (tens of seconds) → pool exhaustion. A `expires_at` lock table is a **schema change** (needs approval).  
3. **Keep in-memory** (current) — zero extra cost; enough for low genuine traffic; insufficient against distributed abuse.

Recommendation: ship the P0 prompt fix first; add Upstash only if abuse or overlapping streams show up in production. Do not hold a PG connection across OpenAI streaming.

---

## 2. Exact files modified

| Path | Change |
|---|---|
| `lib/parle/trustedPrompt.js` | **new** — discard client privileged fields; allowlisted onboarding |
| `lib/parle/sessionTranscript.js` | **new** — bounded transcript formatter |
| `lib/parle/crossSessionMemory.js` | no client summary fallback |
| `lib/parle/preferences.js` | load `onboarding_reason` with settings |
| `lib/parle/userSettings.js` | privacy-intent comments |
| `lib/parle/onboarding.js` | `getGuestOnboardingReason` |
| `pages/api/chat/send.js` | trusted injections; DB history only |
| `pages/api/chat/guest-send.js` | trusted injections; recap ignored |
| `pages/api/chat/session-end.js` | ignore client transcript; LIMIT 40 |
| `components/haven/HavenChat.js` | no hold-to-onboard; no client injections/recap |
| `components/haven/OnboardingSheet.js` | non-modal |
| `styles/parle-chat.css` | docked onboarding |
| `playwright.config.js` | Edge channel; Pixel 5 instead of WebKit iPhone |
| `tests/unit/trustedPrompt.test.js` | **new** |
| `tests/unit/sessionTranscript.test.js` | **new** |
| `tests/unit/crossSessionMemory.test.js` | forged summary rejected |
| `tests/unit/userSettings.test.js` | COALESCE-only contract |
| `tests/api/remediation.test.js` | **new** |
| `tests/api/authedJourneys.test.js` | **new** |
| `tests/e2e/audit.spec.js` | onboarding after first reply; selector fixes |
| `docs/v1-audit-remediation.md` | **this file** |

No production schema files applied. No `ADMIN_EMAILS` / `requireAdminUser` weakening.

---

## 3. Automated and end-to-end results

Environment: **local** Next 13.5 on `http://localhost:3000`, `.env.local`, Neon primary (same project as production). **Not production HTTP** except that the database is the shared primary. Seed user `testuser_a@parle.test` only.

### Unit (`npm test`)

**130 pass / 0 fail / 1 skip** (skip: primary-branch persistence write guard, unchanged).

New coverage: forged `hiddenInjections` / recap / summary never appear in system messages; empty stored summary does not promote client text; short vs long session transcripts; COALESCE does not assign `TRUE` over `FALSE`.

### API (`npm run test:api` against local :3000)

| Test | Result |
|---|---|
| Settings 401, guest crisis 200, no key leak | **PASS** |
| Unauth admin APIs 401 | **PASS** |
| Forged privileged fields still crisis + hotlines | **PASS** |
| Guest usage 200 | **PASS** |
| `tests/api/security.test.js` / `rateLimits.test.js` | **SKIP** unless `RUN_API_TESTS=1` (not set this run) |
| Authed seed login, `/api/auth/me` non-admin, admin API 404/401 | **PASS** |
| Settings four combinations then restore | **PASS** |
| Quotes GET, journal create/read/edit/delete (synthetic) | **PASS** |
| Session-end with UUID, client transcript ignored | **PASS** (after fixing invalid session id) |
| Logout | **PASS** |

Registration **not executed** (would call `sendVerificationEmail` / Resend). New-account onboarding overlay **not** run as a brand-new authed user.

### Playwright (`npx playwright test`, Edge channel)

Second full run: **14 passed / 2 failed** (after selector fixes).

| Spec | Chromium | Mobile (Pixel 5 + Edge) |
|---|---|---|
| Landing CTA → `/chat` | PASS | PASS |
| Marketing nav drawer | PASS | FAIL / skip-worthy (no hamburger in this channel) |
| Footer terms/contact | PASS | PASS |
| Guest journal/quotes → login | PASS | PASS |
| Guest crisis + onboarding dialog + composer | PASS on an earlier isolated run; **FAIL** on a later run after guest burst tests (composer/hotline race or 10/min guest limit) | PASS on second run |
| Unauth `/admin` 404 | PASS | PASS |
| Login page “Log in” | PASS | PASS |

**Blockers:** Playwright Chromium/WebKit binaries were missing; tests used **installed Microsoft Edge**. iPhone WebKit project was remapped to Pixel 5 + Edge. Cursor browser could not exercise guest overlay (existing authed cookie). Image attach consent modal and voice input: UI present (Attach image, Start voice input) — **not** submitted. Live 36-scenario eval **not** re-run. Admin overview/users/conversations pages **not** re-clicked as founder this phase (admin APIs remain 401 unauth / 404 non-admin). Follow-up emails **not** sent.

---

## 4. Previously untested features now verified

| Feature | Status now | How |
|---|---|---|
| Forged privileged prompt fields | **PASS** (unit + guest crisis API) | Isolated, synthetic |
| Privacy four combinations | **PASS** (API, seed user) | PATCH/GET, restored |
| Journal CRUD | **PASS** (API, seed user) | Synthetic commute/rain notes; created row deleted |
| Quotes list | **PASS** (API) | Authenticated GET |
| Logout | **PASS** (API) | Seed session |
| Non-admin vs admin APIs | **PASS** | Seed user 404/401; unauth 401 |
| Session-end persist path | **PASS** (API 200) | Bounded DB transcript |
| Guest crisis + onboarding UX | **PASS** (Playwright Chromium, first run) | Isolated Edge |
| Six conversation modes in UI | **PASS** (picker visible) | Local authed chat: Cross-Mode, Emotional, Be honest, Vent, Stop reaching out, Let's just talk — **not** a six-mode streamed conversation |
| Guest quota endpoint | **PASS** | GET 200 |
| Clear Chat / New Chat click | **NOT TESTED** this phase (New Chat button visible in authed browser) | |
| Thumbs / relief surveys | **NOT TESTED** (thumbs buttons visible on existing local history; not clicked) | |
| Image/voice | **NOT TESTED** (controls visible) | |
| Registration / terms cookie | **NOT TESTED** (email side effect) | |
| Guest daily cap 30 | **NOT TESTED** (would burn quota) | |
| Founder admin UI pages | **NOT TESTED** this phase | |
| Cross-session recall live | **NOT TESTED** (unit only; no production memory inspection) | |

Do not read **PASS** for anything not executed.

---

## 5. Performance (local vs previous production audit)

Previous audit: **production** `parle.chat`, guest-send TTFB ~280–311 ms, full ~805–1485 ms.

This phase: **local** `localhost:3000` (dev compiler, same Neon). Not comparable as a prod regression test.

| Call | n | Status | Total ms |
|---|---|---|---|
| Guest crisis `/api/chat/guest-send` | 2 | 200 | 3872, 2077 |
| Guest short hello (stream complete) | 2 | 200 | 3291, 4234 |
| Authed `/api/chat/send` synthetic | 2 | 200 | 9898, 8212 |
| Authed `/api/chat/session-end` | 1 | 200 | 9046 |
| `GET /` document | 1 | 200 | 261 |
| `GET /chat` | 1 | 200 | 63 |
| `GET /journal` (cookie) | 1 | 200 | 38 |

No streaming stalls observed in these samples. No processing-lock 429 in the authed pair. Guest 10/min **did** interact with later Playwright crisis (likely). Hidden-think off. No production load test.

Time-to-first-visible-token was **not** split from full body on local `Invoke-WebRequest` (full response). Production TTFB from the prior audit remains the better edge signal.

---

## 6. Remaining failures, gaps, blockers

- **Not deployed.** Production still accepts client `hiddenInjections`.  
- **In-memory rate limits / locks** on Vercel.  
- **Column DEFAULT false** vs register TRUE (schema approval).  
- Playwright: mobile hamburger; crisis flake under guest burst; no WebKit iPhone binary.  
- Registration E2E blocked to avoid Resend.  
- Cursor browser authed — cannot prove guest overlay there.  
- Six modes not each streamed.  
- Health config disclosure, guest email UI, `OPENAI_MODEL` unset in Vercel: unchanged P2 from the original audit.  
- Live 36-eval not re-run.

---

## 7. Privacy / database approval needed

1. Optional: `ALTER COLUMN ... SET DEFAULT TRUE` for `memory_enabled` and `personalisation_enabled`. **Do not** backfill existing `FALSE`.  
2. Optional later: rate-limit lock table or Upstash (new dep).  
3. **No** legacy cleanup migrations (`0001`/`0002`) requested.

---

## 8. Deployment readiness and rollback

**Ready to deploy this working tree only after explicit approval.** Rollback for a future Vercel promote remains the previous production deployment `dpl_DXVay2hZZfZeurYweooQN9wYF7TX` (pre-admin-v2) or `dpl_BEmJeQqKQxWxEN79i58t23baQgbu` (current prod, pre-this-fix). This remediation has **no** production alias yet.

Suggested prod smoke after approval: guest crisis; guest hello without privileged fields; first-message onboarding does not hide the reply; founder admin still 200; non-admin `/admin` 404; no Resend/cron.

---

## Classification

**READY WITH ISSUES** — P0 is fixed locally and tested; production is still on the unfixed prompt path; rate-limit topology and schema DEFAULT remain known issues; several product journeys are still only partially executed.
