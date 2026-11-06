# Parlé V2-D.0 recovery gate

Authorization: test-environment recovery and D.0 only. D.1–D.2 not started.

## Environment

Stopped leftover rehearsal Next on 3075 (start-server 16332 / next 11568) and 3076 (start-server 22576 / next 24972), plus a leftover Playwright mint tree on 3075.

Started one Next: `127.0.0.1:3075`, start-server PID 1424. `REHEARSAL_IDENTITY=br-square-unit-apbswjj3`. `/api/health` 200. `/chat` 200.

Readiness probe: session cookie login, `/chat` navigation complete, New Chat visible/enabled, composer enabled, no pending document/XHR/fetch.

## Focused gates

- Desktop journey A: **passed** (34.8s)
- Mobile Archive G, no `force:`: **passed** (27.4s)

## Full suite (once, after mint Neon timeout)

First full-suite launch died at session mint: `Connection terminated due to connection timeout`. Playwright never started.

Second launch (DB reachable): **16 passed / 2 failed** (7.1m)

1. Chromium F: Send click intercepted by `parle-onboarding__backdrop` after the first stub reply. Composer had text; overlay stayed open.
2. Mobile D: after mid-stream reload, URL still had a conversation UUID, transcript showed the **previous** journey C marker, Send disabled, D marker absent.

## Decision

**NO-GO for D.1.** No schema, migration, or production changes.
