# Parlé V1 complete system audit

Follow-up (local only, not deployed): [v1-audit-remediation.md](./v1-audit-remediation.md). Production snapshot below is unchanged.

**Date:** 21 October 2026 (UTC+8)  
**Production:** https://parle.chat (`josz/parle`)  
**Deployed commit:** `456d591a6998ff23b35894c0ee37c94fb059cc47`  
**Vercel deployment:** `dpl_BEmJeQqKQxWxEN79i58t23baQgbu`  
**Database:** Neon `neondb`, project `little-truth-88273418`, primary branch `br-morning-sun-apghun9g`  
**Auditor constraint:** no production deploy, no migrations, no customer content displayed, no auth bypass, no cron sends.

---

## A. Executive summary

**Verdict: READY WITH ISSUES**

Parlé V1 is **safe enough and functional enough for limited real-user use** (heartbreak chat, journal, quotes, guest try-before-signup, founder admin). Core chat, auth, encryption, admin gating, and guest quota plumbing exist and were exercised on production. It is **not** “fully verified V1” in the sense of exhaustive journeys, live 36-scenario eval re-run, or multi-instance rate-limit proof.

The product can accept users if the founder accepts the residual risks below. It should **not** be marketed as fully private against a motivated API caller, and rate limits will not hold under distributed abuse.

### Major risks

1. **Client-controlled system prompt fields** (`hiddenInjections`, `contextRecap`, `crossSessionSummary`) are merged into the model prompt on `/api/chat/send` and `/api/chat/guest-send`. A caller can inject instructions. This is the highest security finding.
2. **Rate limits and processing locks are in-memory** (`lib/rateLimiter.js`, `lib/chatProcessingLock.js`). On Vercel they are per instance, not global.
3. **`/api/health` is unauthenticated** and discloses which secrets are configured (not values).
4. **Live 36-scenario AI eval was not re-run this audit.** Quality claims rest on frozen `docs/eval/acceptance.json` (20 Oct 2026). Remaining weaknesses: Vent rhetorical `?`, Cross motive invention, scorer false positives.
5. **Several user journeys were not fully executed** (new registration, all four memory toggles in the live app, journal CRUD, quote favorite, guest UI quota, non-admin logged-in 404).
6. **DB defaults for `memory_enabled` / `personalisation_enabled` are `false`**, while register INSERT and app defaults assume `true`. Existing rows and new-user paths can diverge.
7. **Guest email capture has no in-app UI**, so the follow-up cron will not receive product traffic even if scheduled.

---

## B. Feature-by-feature results

Status key: **PASS** = implemented and verified working this audit · **PARTIAL** = works with limitations · **FAIL** = confirmed broken · **NOT TESTED** · **NOT IMPLEMENTED**.

### Authentication and accounts

| Feature | Status | Evidence |
|---|---|---|
| Registration | **NOT TESTED** | Code: `pages/api/auth/register.js`, terms modal. No new production account created. |
| Login | **PASS** | Founder already authenticated; visiting `/login` redirected to `/admin` (`postLoginPath`). |
| Logout | **NOT TESTED** | Handler `pages/api/auth/logout.js` exists; not clicked (would drop founder session). |
| Sessions (7d JWT `hs_session`) | **PARTIAL** | Production `JWT_SECRET` configured (`/api/health`). No expiry/revocation test. No server-side session store. |
| Preferred name / welcome | **PARTIAL** | Dashboard greets preferred name. Welcome flow for *new* users not re-run. |
| Terms (register cookie) | **NOT TESTED** | Register path not executed. |
| Guest terms banner | **PASS** | Production `/chat` showed terms region; composer disabled until accepted; after accept, composer enabled. |
| Guest vs authed chat | **PARTIAL** | Authed chat verified in browser. Guest HTML+composer verified only until it became clear the browser already had a founder session; guest **API** `POST /api/chat/guest-send` returned 200 ×3. |
| Route protection | **PASS** | `/dashboard` `/journal` `/quotes` use `RequireAuth`. Unauth `/admin` 404. Unauth admin APIs 401. |
| Admin login redirect | **PASS** | Logged-in founder `/login` → `https://parle.chat/admin`. |

### AI chatbot

| Feature | Status | Evidence |
|---|---|---|
| Six modes (ids: `cross`, `emotional`, `logical`, `vent`, `stop_contact`, `talk`) | **PARTIAL** | UI Cross-Mode verified. Other modes present in `lib/parle/modes.js`. Mode switch not completed in browser. |
| Streaming | **PARTIAL** | Authed send entered “Waiting for response”; reply path continued into onboarding overlay (composer locked). Guest API 200 with streaming TTFB ~280–311 ms. |
| Chat history / New Chat | **PASS** | New Chat + local archive row appeared after send. |
| Clear Chat | **NOT TESTED** | API `pages/api/chat/clear.js` not invoked. |
| Mode-switch ack | **PARTIAL** | `MODE_SWITCH_ACK` defined but not inserted on switch (code). |
| Conversation endings / surveys | **NOT TESTED** | Trigger `lib/parle/surveyEnding.js`; not reached in live chat. |
| Processing lock | **PARTIAL** | In-memory; UI showed waiting/disabled send. Multi-instance not proven. |
| Rate limiting | **PARTIAL** | Unit tests pass. Production not exhausted (low volume). |
| Guest usage cap (30 / window) | **NOT TESTED** | Copy and `guest-usage` API exist; cap not hit. |
| Error recovery | **NOT TESTED** | Client has 429/5xx paths; not fault-injected on prod. |
| Hidden-think | **PASS** (config) | Production ops page: off. Default skip vent/talk in code. |
| Crisis / safety | **PARTIAL** | Unit tests for keyword list + SG resources. Not live-triggered. Keyword-only (TODO moderation). |
| Image attach + consent | **PARTIAL** | Attach button present; `users.image_attach_consent_at` exists. Consent modal not completed. |
| Voice input | **NOT TESTED** | Button present. |
| Onboarding sheet | **PASS** | Appeared after first authed message; skip worked. Blocks composer until dismissed. |

### Memory and personalization

| Feature | Status | Evidence |
|---|---|---|
| Last-session summaries | **PARTIAL** | Encrypted column present; unit tests pass. Live new-session recall not re-run. |
| Living profile | **PARTIAL** | Code + unit tests. No live fact inspection (privacy). |
| Preference profile | **PARTIAL** | Code + settings API. Reset not clicked. |
| Cross-session recall | **PARTIAL** | Unit: memory on injects stored summary; memory off does not. |
| Session-end persist | **PARTIAL** | Code path exists; not traced end-to-end this audit. Fallback loads **all** `chat_memory` if transcript missing. |
| Memory off / personalisation off combinations | **NOT TESTED** live | Unit covers injection rules. Settings UI not toggled. |
| Encryption `enc:v1` | **PASS** (config + unit) | Health: encryption key set, 32 bytes, valid. Unit tests prefix. No ciphertext dumped. |

### User-facing

| Feature | Status | Evidence |
|---|---|---|
| Dashboard | **PASS** | Loaded for founder: greeting, quotes empty state, quick access, Control Centre shield. |
| Journal CRUD / dates | **PARTIAL** | `/journal` loaded with app nav. Create/edit/delete not executed. Encrypted `diary` table exists. |
| Quotes + favorites | **PARTIAL** | Dashboard empty-favorite state. Quotes page navigation raced; API/auth required. |
| Landing / marketing | **PASS** | `GET /` 200, ~141 KB HTML, 3 samples. |
| Responsive nav | **PARTIAL** | App rail works. Admin uses horizontal scroll nav even on a moderately wide screenshot (no Chat/Journal/Quotes in admin — **PASS** for isolation). |
| Guest experience | **PARTIAL** | Terms + API guest-send. Full guest UI journey blocked because the audit browser already had a founder cookie. |
| Guest email capture | **NOT IMPLEMENTED** (UI) | API + cron exist; no component calls `/api/guest/email`. |
| Gamification UI | **NOT IMPLEMENTED** | Deprecated APIs still posted from journal/chat. |
| Contact / terms pages | **NOT TESTED** this run | Routes exist; e2e spec covers them locally. |

### Feedback and analytics

| Feature | Status | Evidence |
|---|---|---|
| Thumbs + reasons | **PARTIAL** | Code + `message_feedback` (12 all-time). 30-day admin thumbs 0/0 — no thumbs in current UTC window. Live thumb click not done. |
| Relief / clarity surveys | **PARTIAL** | `product_feedback` 10 rows all-time. Survey UI not triggered this audit. Guest daily cap is localStorage only. |
| Activation | **PASS** | 1 verified activated user (`first_activated_at`); dashboard matches. |
| D1 / D7 | **PASS** (honest pending) | Cohort still open: pending 0/0 matured, pendingN 1. |
| Events + duplicate indexes | **PASS** | `0003` applied; unique indexes present; events 41 after this audit’s traffic. |
| Client `/api/events` | **PARTIAL** | 204, does not persist. |

### Admin Control Centre

| Feature | Status | Evidence |
|---|---|---|
| Founder → `/admin` | **PASS** | Login redirect and direct navigation. |
| Authorization | **PASS** | Unauth pages 404, APIs 401. `ADMIN_EMAILS` configured (ops). Client `isAdmin` not trusted. |
| Overview + charts | **PASS** | Registered 12, date filters 7/30/90/custom visible, charts section present. Numbers moved with live traffic (see §G). |
| Users list | **PASS** | 12 users, page 1 of 1, usage columns only (emails redacted in notes). Search UI present; pagination not stressed (n&lt;25). |
| User detail | **NOT TESTED** | Not opened (would show email + usage; avoided extra PII surface). |
| Conversations | **PARTIAL** | Page implemented; this run’s last navigation landed on ops due to parallel loads. Local + prior prod HTTP 200. |
| Feedback | **PARTIAL** | Same. |
| Retention | **PARTIAL** | Independent query: pending D1/D7. Page not fully screenshotted this pass. |
| AI Performance | **PASS** | `not_recorded` for latency/errors/cost. Hidden think off. **Model “not set”** because `OPENAI_MODEL` env unset; runtime defaults to `gpt-4o-mini`. |
| Administration | **PASS** | UTC, verified from 2026-10-20, events table present, allowlist configured, auto-deletion not implemented. |
| Date filters | **PARTIAL** | UI present; 7-day click not completed. 30-day totals differ from all-time aggregates as expected. |
| Mobile admin | **PARTIAL** | Horizontal nav; usable. |
| Non-admin logged-in 404 | **NOT TESTED** | Would require a second account session. Unauth 404/401 **PASS**. |

### Background jobs and integrations

| Feature | Status | Evidence |
|---|---|---|
| Cron guest follow-ups | **PASS** (fail-closed) | `POST` with dummy bearer → **401**. No email sent. `CRON_SECRET` required in code. No `vercel.json` cron in repo — schedule is dashboard-only (**NOT TESTED** whether a Vercel cron exists). |
| Resend | **NOT TESTED** | No-op without key in some paths; verification email not enforced. |
| OpenAI | **PASS** | Guest and authed sends 200. |
| Vercel Analytics | **PARTIAL** | `<Analytics />` in `_app.js`; no dashboard check. |
| Neon SSL | **PASS** | `verify-full` rewrite in `lib/db.js`; identity query succeeded. |

---

## C. Automated tests

### This audit (`npm test`)

| | Count |
|---|---|
| Pass | **120** |
| Fail | **0** |
| Skip | **1** (`personalization schema, save, and reload` — refuses writes on primary; rehearsal only) |
| Flaky | **None observed** (single run) |

`tests/unit/postLogin.test.js` is empty (suite still “ok”). Real post-login assertions live in `tests/unit/adminControl.test.js`.

### Not run this audit

| Suite | Why |
|---|---|
| `npm run test:api` | Requires `RUN_API_TESTS=1` and a running app. Files: `tests/api/http.test.js`, `security.test.js`, `rateLimits.test.js`. |
| `npm run test:e2e` | Playwright Chromium was not installed in this environment earlier; config `baseURL` defaults to localhost. Spec: `tests/e2e/audit.spec.js` (landing, journal/quotes login redirect). |
| `npm run eval:phase2` | 36 paid OpenAI calls; **not re-run**. Frozen acceptance used instead. |
| Rehearsal DB tests | Primary-write skip is correct. |

### Coverage gaps (critical)

- No automated test that **rejects** client `hiddenInjections` / forged `crossSessionSummary`.
- No API test for admin 401/404 in CI (only local HTTP during Admin V2).
- No e2e for six modes, memory toggles, journal CRUD, or admin charts.
- No performance tests in CI.
- Empty `postLogin.test.js`.

No tests were changed to force green. No new failing tests added (would be product changes). Recommended follow-up: a unit test that `hiddenInjections` from the client are **not** forwarded, after a deliberate fix.

---

## D. UI/UX audit

**Desktop (founder, production)**

- Chat: dark theme, Cross-Mode, New Chat, terms then composer — coherent.
- First authed message opened **onboarding overlay** and **disabled the composer** while a reply was still expected — jarring (P2).
- Dashboard: greeting and shortcuts work; Control Centre shield present for admin. An earlier screenshot showed an almost empty canvas (possible slow paint / overlay) — treat as **possible layout flash**, not confirmed empty-page bug.
- Admin: **no Chat/Journal/Quotes** in admin chrome — correct. Sidebar collapses to a **horizontal scrolling strip**; date inputs show native `dd/mm/yyyy` placeholders (P3).
- “Open Parlé” exit not verified this pass.

**Mobile**

- Unauth admin 404 and page HTML measured; founder admin on a relatively narrow viewport used the horizontal admin nav (PASS for reachability).
- Full iPhone guest journey **NOT TESTED**.

**Inconsistent behavior**

- Guest copy says chat is session-only; authed “Founder” chrome appeared in the same browser because of an existing cookie — testers must not assume incognito.
- Admin AI “model not set” vs chat using default `gpt-4o-mini`.

---

## E. Performance report

Environment: **production https://parle.chat**, n=3 unless noted, 21 Oct 2026. Times in **ms**. Not localhost. Not a load test.

### Frontend document fetch (no full browser paint profile)

| Route | Status | Bytes | min | median | p95* | max |
|---|---|---|---|---|---|---|
| `GET /` | 200 | 141376 | 32 | 50 | 50 | 203 |
| `GET /chat` | 200 | 15576 | 30 | 33 | 33 | 56 |
| `GET /admin` unauth | 404 | 5351 | 274 | 280 | 280 | 288 |
| `GET /api/health` | 200 | 172 | 269 | 272 | 272 | 310 |

\*n=3 so p95 ≈ second-highest. First `/` 203 ms looks like a **cold or distant** sample vs ~30–50 ms warm HTML.

Landing HTML **~141 KB** is large relative to `/chat` HTML (~15 KB). JS bundle sizes were not dumped (would need build analyzer).

### Backend / AI

| Call | Status | TTFB min/med/max | Total min/med/max |
|---|---|---|---|
| `GET /api/admin/overview` unauth | 401 | 266 / 281 / 294 | 267 / 282 / 295 |
| `POST /api/chat/guest-send` | 200 | 280 / 308 / 311 | **805 / 860 / 1485** |
| Cron dummy | 401 | — | 277 |

Guest-send TTFB ~300 ms (includes TLS + serverless + origin check). Full body 0.8–1.5 s for a short “hello”. Hidden-think **off**, so no extra planning RTT.

**Not measured:** authenticated send TTFB in DevTools (onboarding interrupted), session-end duration, admin query time under large `product_events` (table still tiny: 41 rows), JS long tasks, CLS.

### Ranked lag causes (code + these numbers)

| Rank | Cause | Benefit if fixed | Risk |
|---|---|---|---|
| 1 | Optional hidden-think extra completion before SSE (`PARLE_HIDDEN_THINK`) | ~1–1.5 s TTFB if ever enabled | Low if kept off |
| 2 | Large stacked prompts (~7k prompt tokens in eval) | Lower cost + slightly faster TTFB | Medium (quality) |
| 3 | Per-send DB round-trips inside processing lock | Shorter lock, fewer 429s | Medium |
| 4 | Session-end full `chat_memory` scan + extra LLM | Faster tab close / New Chat | Medium |
| 5 | Pool `max: 5`, 8s connect timeout | Headroom under concurrency | Low–medium |
| 6 | Admin `listUsers` aggregates all `product_events` | Admin page speed at scale | Low now (41 events) |
| 7 | Missing `(user_id, created_at)` index on `chat_memory` | History/session-end at scale | Low now |
| 8 | Landing HTML 141 KB + many global CSS imports | First paint | Low |

Do not claim the product is “fast” from n=3. Guest replies in ~1 s median is **acceptable for V1**; p95 unknown.

---

## F. Database and security audit

### Database

- Identity matches documented primary (`br-morning-sun-apghun9g`).
- **`schema_migrations`:** only `0003_phase3_analytics.sql` / `applied`. **0001/0002 not applied.**
- **0003 indexes** present on `product_events` / `product_feedback`.
- **`chat_memory`:** PK + `idx_chat_user` only — no created_at composite.
- Required columns: `first_activated_at`, `preferred_name`, `last_session_summary`, `image_attach_consent_at`, `product_feedback.dimension` — **present** (D0 missing-consent note is outdated).
- **Defaults:** `memory_enabled` and `personalisation_enabled` default **`false`**. Register INSERT still sets TRUE. Drift risk for any insert that omits the columns.
- Foreign keys: 22.
- Legacy tables remain (`chat_messages`, `diary_entries`, `sessions`, etc.) — **not cleaned** (per policy).
- Encryption key valid in production. Decrypt failures return empty string (silent empty UI, not a leak).
- Analytics: test emails `@parle.test` excluded in SQL. `METRICS_EXCLUDE_EMAILS` unset in Vercel.

### Security

| Issue | Severity | Notes |
|---|---|---|
| Client `hiddenInjections` / `contextRecap` / fallback `crossSessionSummary` | **P0** | `pages/api/chat/send.js`, `guest-send.js`, `lib/parle/crossSessionMemory.js` |
| In-memory rate limit / processing lock | **P1** | Bypassable across instances |
| `/api/health` config booleans | **P2** | Recon |
| CSRF = Origin + SameSite, no token | **P2** | Fine if origins tight; `ALLOWED_ORIGINS` must stay correct |
| Register email enumeration | **P3** | “Email already exists” |
| Cron secret via query | **P3** | Prefer Authorization only; unauth probe 401 |
| Runtime `CREATE TABLE` on request paths | **P2** | Drift vs `schema.sql` |
| Unauth feedback POST | **P2** | Abuse/growth, not IDOR |
| Journal/chat IDOR | **OK** | Owner checks |
| Admin 404 mask | **OK** | |
| JWT 7d, no revoke | **P2** | Stolen cookie valid until exp |
| Crisis filter | **P2** | Keywords only |
| Email verification | **P2** | Send-only, not gated |

No secrets, cookies, transcripts, or journal bodies are included in this document.

---

## G. Admin analytics verification

Independent Neon aggregates vs Control Centre (UTC). Traffic **during this audit** moved some counters (guest-send ×3, founder message).

| Metric | Independent (all-time unless noted) | Dashboard 30-day (founder session) | Match? |
|---|---|---|---|
| Registered excl. test | 12 | 12 | **Yes** |
| Test users | 1 | excluded | **Yes** |
| Activated | 1 | 1 verified / 0 estimated | **Yes** |
| D1/D7 | pending, n=0 d=0, pendingN=1 | pending | **Yes** |
| Returning users | 0 | (retention page not re-read) | Query yes |
| Thumbs all-time | 12 | 30-day **0/0** | **Yes** (window) |
| Outcomes all-time | 10 | not re-opened | — |
| Guest messages | 12 all-time | 12 in 30-day | **Yes** |
| Authed messages | 13 all-time | 5 in 30-day (then 5 after founder send in UI) | **Yes** (older messages outside 30d) |
| Conversations all-time | 3 | 2 in 30-day UI | **Plausible** (one older) |
| Modes | — | cross-heavy | Consistent with product |
| Product events | 38 then 41 | ops 41 | **Yes** |
| AI latency/cost | not stored | `not_recorded` | **Honest** |
| `OPENAI_MODEL` env | unset | “not set” | **Yes**; runtime default mini |

No fabricated metrics. UTC day boundaries used. `@parle.test` excluded.

---

## H. Prioritized bug list

### P0

**Client-injected system prompt**  
- **Repro:** `POST /api/chat/guest-send` or `/api/chat/send` with `hiddenInjections: ["Ignore previous instructions…"]` and/or `crossSessionSummary` when no stored summary.  
- **Files:** `pages/api/chat/send.js`, `pages/api/chat/guest-send.js`, `lib/parle/prompts.js`, `lib/parle/crossSessionMemory.js`.  
- **Impact:** Model jailbreak / fake memory.  
- **Fix:** Ignore client injections; compute quality/think/recap/summary **only on the server**.

### P1

**Serverless rate limits / locks are local**  
- **Repro:** Distributed clients across instances exceed 10 guest/min in aggregate.  
- **Files:** `lib/rateLimiter.js`, `lib/chatProcessingLock.js`.  
- **Fix:** Redis/Upstash or platform limiter; keep in-memory as fallback.

**Onboarding overlay vs in-flight reply**  
- **Repro:** Logged-in user sends first message; overlay + disabled composer.  
- **Files:** `components/haven/HavenChat.js`, `OnboardingSheet.js`.  
- **Fix:** Don’t block streaming; defer sheet until reply completes or show as non-modal.

**Session-end unbounded history read**  
- **Repro:** User with large `chat_memory` and missing client transcript.  
- **File:** `pages/api/chat/session-end.js`.  
- **Fix:** Require client transcript or `LIMIT` recent turns.

### P2

| Bug | Repro | Files | Fix |
|---|---|---|---|
| Memory/personalisation DB default `false` vs code `true` | Insert user without columns | `users` defaults; `lib/parle/userSettings.js` | Align defaults; backfill policy |
| Guest email never collected | Use product as guest | `lib/parle/guestEmail.js` unused | Wire UI or remove cron expectation |
| `OPENAI_MODEL` unset in Vercel | Admin AI page | env | Set `gpt-4o-mini` explicitly |
| Health config probe | `GET /api/health` | `pages/api/health.js` | Auth or strip flags |
| Crisis keywords only | Rephrase self-harm | `lib/chatSafety.js` | Moderation API later |
| Email verification unused | Register | `utils/resend.js` | Enforce or remove |
| Guest survey cap client-only | Repeat guest surveys | `ProductPulseCard.js` | Server event uniqueness |
| Admin listUsers full event scan | Scale | `adminMetrics.js` | Pre-aggregate / time bound |
| No `chat_memory(user_id, created_at)` | Scale | schema | Additive index later |
| Mode switch ack unused | Switch modes | `modes.js`, `HavenChat.js` | Insert or delete dead copy |

### P3

- Native date placeholders on admin filters (`styles/admin.css`, `AdminShell.js`).
- Register “Email already exists”.
- Empty `tests/unit/postLogin.test.js`.
- Deprecated gamification POSTs from primary UI.
- Possible dashboard first-paint flash.
- Accidental leftover Vercel project `josz/project-heart` from an unlinked CLI deploy (not aliased to parle.chat).

---

## I. Recommended action plan

### Before further user acquisition

1. **Strip client prompt injection** (P0) — small, high value.  
2. **Confirm Vercel cron** for guest emails **or** hide the feature until UI exists.  
3. **Set `OPENAI_MODEL`** in production env.  
4. **Founder manual pass:** journal create/delete, quote favorite, all six modes, memory off new chat, non-admin account 404.  
5. Keep **hidden-think off**.  
6. Do **not** run 0001/0002 or legacy cleanup.

### Can wait

- Redis rate limits (until traffic grows).  
- Chat memory index.  
- Admin query rewrite.  
- Health endpoint lockdown.  
- Email verification gate.  
- Moderation API.  
- Guest email UI.  
- Date-picker polish.  
- Delete unused `josz/project-heart` project.

### Suggested order

P0 prompt fields → env `OPENAI_MODEL` → onboarding/stream clash → memory column defaults → rate-limit design note in ops → coverage tests (admin API, injection) → eval re-run on a rehearsal key if quality changes.

---

## J. Verification limitations

- **No production deploy or schema change** this audit.  
- **36-scenario eval not re-run**; compared to `docs/eval/acceptance.json` (avg 9.89, Vent 9.58, `cross-done-talking` 8.5, `vent-stacked` 7.5).  
- **Playwright e2e and `test:api` not executed** here.  
- **Guest UI journey incomplete** because the Cursor browser already held a **founder** session. Guest **API** was tested separately.  
- **Non-admin authenticated** access not tested.  
- **Logout, register, journal write, quote save, thumbs, surveys, all modes, all memory combos** not fully live-tested.  
- **User detail page** not opened.  
- Conversations/Feedback/Retention pages: implemented and previously HTTP 200; this browser pass fully rendered Overview, Users, AI, Ops; others **PARTIAL** due to navigation races.  
- Performance n=3, production only, no DevTools profiles or bundle analysis.  
- Prompt-injection marked from **code inspection**, not a live jailbreak demonstration (avoided unsafe payloads on production).  
- Cron existence in Vercel dashboard **NOT TESTED**.  
- No private message/journal/summary/password content was read for the report.

---

## Appendix: reproduction — unauthenticated production

```
GET https://parle.chat/admin → 404
GET https://parle.chat/api/admin/overview Origin:https://parle.chat → 401
POST https://parle.chat/api/cron/guest-email-followups Authorization: Bearer rehearsal-unauth-probe → 401
POST https://parle.chat/api/chat/guest-send {"text":"hello","modeId":"cross","messages":[]} → 200
GET https://parle.chat/api/health → 200 configured flags
```

Founder (existing browser session, not a minted cookie): `/login` → `/admin`; Overview KPIs; Users 12; AI `not_recorded`; Ops events 41.

---

*End of audit. No product code was changed. Wait for approval before fixes.*
