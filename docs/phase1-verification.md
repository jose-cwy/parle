# Phase 1 stability check — pass/fail

**Date:** 2026-10-20  
**Primary:** not migrated (`0001`/`0002` not applied). Phase 2/3 not started.

## Results

| Check | Verdict | Notes |
|-------|---------|--------|
| Primary tables/columns unchanged | **PASS** | No archive schema, no `schema_migrations` on `br-morning-sun-apghun9g` |
| Vercel Production `DATABASE_URL` = project `little-truth-88273418` / branch `br-morning-sun-apghun9g` | **FAIL (unverified)** | No Vercel token/login in this environment. Could not read Production env without printing secrets |
| Local `DATABASE_URL` identity | **PASS** | Same project/branch as audited primary |
| `docs/database.md` catalog | **PASS** | KEEP / SOAK / ARCHIVE, columns, FKs, writers |
| Auth login + `/api/auth/me` (`testuser_a@parle.test`) | **PASS** | |
| Chat send (SSE) + encrypted history reload | **PASS** | History 4 rows after two sends |
| Personalization `session-end` | **PASS** | Requires UUID `sessionId` (product already sends `crypto.randomUUID()`) |
| Guest send + usage headers | **PASS** | limit 30, remaining decreased 29 then 28 |
| Feedback POST | **PASS** | |
| Cron fail-closed on production | **PASS** (earlier) | Dummy bearer **401** — `CRON_SECRET` is set |

## Latency (localhost, one dedicated authed turn + one guest turn)

| Turn | Hidden think (`X-Parle-Think-Ms`) | Time to first stream token (`ttfbMs`) | Think + first token | Full response wait |
|------|----------------------------------:|--------------------------------------:|--------------------:|-------------------:|
| Authed (1st this session) | 2192 ms | 2618 ms | **4810 ms** | 9862 ms |
| Authed (2nd) | 1703 ms | 893 ms | **2596 ms** | 5351 ms |
| Guest | 1021 ms | 976 ms | **1997 ms** | (stream complete) |

`timeToFirstVisibleMs` ≈ hidden-think duration + time to first visible reply token after think.

## Critical failures

None in the Phase 1 product paths above.

## Unresolved risks

1. **Production Neon identity still not certified from Vercel.** Local primary is the audited branch; Production env was not independently selected. Need `vercel login` / `VERCEL_TOKEN` or a dashboard confirmation.
2. Session-end **500s if `sessionId` is not a UUID** (test fixture mistake). UI already sends UUIDs.
3. Production cleanup still **not approved**.
4. One due `guest_emails` row may send on legitimate cron now that `CRON_SECRET` exists.
5. Soak APIs (`/api/memory`, gamification) still write.
6. Dedicated account `testuser_a@parle.test` remains on the primary (intentional).

**Stopped.** No primary `0001`/`0002`. Awaiting approval for any production schema work and for a Vercel identity confirmation method.
