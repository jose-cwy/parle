# Parlé V2 — production readiness plan

**Status:** Isolated planning. No production deploy, primary migration, or genuine wrap.

Production SHA remains `badd746b1ec8dda4c912760376fca25a475a9c8b`. Branch `v2/b1-conversations`. Rehearsal Neon `br-square-unit-apbswjj3`.

`PARLE_V2_TEST_STUB` and `PARLE_V2_RECOVERY` are **inert in `NODE_ENV=production`**. They are not operational controls.

---

## 1. Journey H evidence (what was proven where)

### Production-like `next start` (NODE_ENV=production)

Validated on rehearsal with live OpenAI, stubs **off**:

- Mobile and desktop A–G, two-tab, archive/restore, Chat 2 POST/URL/GET identity, mid-stream refresh user-row survival.
- Journey H Playwright **cannot inject** fail/timeout: the server correctly ignores stubs. Live OpenAI succeeded; the fail notice never appeared. That is a **test-environment restriction**, not a green H gate.

### Controlled harness (this milestone)

`tests/unit/journeyH.providerHarness.int.test.js` injects `streamFn` into `sendConversationMessage`. It does not start Next and cannot be enabled on a production deployment.

| Case | Result |
| --- | --- |
| Error before first token | User row kept; request `failed` / `provider_error`; no assistant row; recoverable SSE `error` |
| Mid-stream throw | Partial tokens **not** persisted as complete; user kept; request `failed` |
| Timeout stub | Same as fail: user kept, no assistant |
| Client abort (`req.aborted`) | Request `cancelled`; no assistant |
| Retry same idempotency key after fail | Completes once; one user row; second completed send replays |
| Expired lease | Another worker can acquire a new `lease_token` |

Client mapping (code, not Playwright H): `consumeChatStream` throws on SSE `error` without a reply; HavenChat shows “Your message is saved — try again.” and re-enables the composer.

**Do not claim the production-mode browser gate is fully green for H.**

---

## 2. Migration sequence (not executed)

All steps require a **separate production authorization**. Rehearsal identity must be printed and refused if not `br-square-unit-apbswjj3` during rehearsal; production identity must match the **primary** Neon branch recorded at freeze (`br-morning-sun-apghun9g` in prior ops docs — **re-verify at execution**, do not trust this file alone).

1. **Freeze production SHA** still serving `/api/chat/send` (`badd746` until cutover).
2. **Additive schema on primary only after branch checksum match:** 0005 conversations → 0006 lease_token → 0007 wrap → 0008 wrap origin triggers → 0009 `timeline_revision`. Stop on wrong project/branch. Never DROP. Never delete `chat_memory`.
3. **Deploy V2 read APIs** (list, GET `?c=`, legacy wrap, archive/restore) **without** cutting HavenChat send to V2.
4. **Legacy-write quiescence:** stop new `chat_memory` inserts from `/api/chat/send` for a named window **after** wrap job is ready. `/api/chat/clear` stays forbidden as a timeline wipe.
5. **Wrap-copy** eligible accounts (`origin=legacy_timeline`) in batches; catch-up until `writesQuiesced`.
6. **Reconcile** (counts and ownership only, no plaintext):
   - source `chat_memory` count per user vs wrap `conversation_messages`
   - every wrap `user_id` equals source `user_id`
   - no foreign UUID readable across users
   - `legacy_import_key` uniqueness
7. **Every eligible legacy account** (`chat_memory` rows > 0) has an accessible wrap (`pending_quiesce` or `migrated`). **Hard stop** if any remain `legacy_only`.
8. **Controlled V2 activation:** HavenChat send → `POST /api/conversations/:id/messages`. Keep `chat_memory` rows.
9. **Authenticated production smoke** on staff/synth only first: New Chat, switch, refresh, archive/restore, wrap read-only, cross-user 404.
10. **Monitor:** send 5xx, wrap 403, migration `interrupted`, lease busy 429, Neon errors. No body logs.
11. **Rollback of generation** uses the production recovery control below — **not** a `badd746` redeploy after live V2 chats exist.

### Stop conditions

| Condition | Action |
| --- | --- |
| Unmapped source rows or dest extras | Halt wrap; do not mark `migrated` |
| Incomplete wrap (`interrupted` / remaining pages) | Halt cutover; keep send on legacy |
| Ownership mismatch | Halt; incident |
| Duplicate dest messages for one source key | Halt; do not catch-up |
| Wrap inaccessible (404/empty for eligible user) | Halt cutover |
| `migrated` without quiescence | Treat as invalid; do not cut over |
| Foreign UUID 200 | Halt; incident |
| Primary migration on the wrong Neon branch | Abort immediately |

---

## 3. Production recovery design (not implemented)

`PARLE_V2_RECOVERY=1` is **rehearsal-only** and ignored in production. It must not be used as the production switch.

**Proposed control:** additive `parle_ops_controls` row `v2_generation` = `live` | `read_only` (see `docs/v2-d5-production.md`). Default missing row → `live` (do not mute the product on a control-table outage).

| While `read_only` | Preserved |
| --- | --- |
| New V2 streams 503 `generation_unavailable` | GET list, GET `?c=`, wrap Earlier conversations, archive list, Restore (still cannot send until `live`) |
| Wrap send/restore-writable stays 403 | Auth, ownership, encryption |
| Completed idempotent requests may replay | Tables `conversations`, `conversation_messages`, `conversation_requests`, wrap maps |

**Authority:** `ADMIN_EMAILS` only. `POST /api/admin/ops/v2-generation` with `{ value, reason, confirm }`. Audit `ops_control_changed` (actor, old/new, reason, request id). No transcripts. No client header.

**Monitoring:** `generation_unavailable` count, send 5xx, admin audit.

**Restore:** set `live` with `confirm: "LIVE"`; one staff/synth send; watch the 503 count drop.

**Forbidden:** redeploy `badd746` as rollback after V2 chats exist; DROP V2 tables; delete `chat_memory` or wrap rows; env-only production mute.

---

## 4. Release-gate checklist

- [ ] Cross-user: account B never 200s A’s UUID or markers
- [ ] New Chat POST UUID = Send POST UUID = DB `conversation_id` = GET
- [ ] Switch and refresh keep `?c=` and the committed user row
- [ ] Archive/Restore of the **same** UUID; wrap not writable
- [ ] Interrupted stream: user persisted; assistant not completed; retry idempotent
- [ ] Encryption: `text_enc` only; decrypt failures do not rewrite plaintext
- [ ] Ownership: `user_id` on conversation, message, request
- [ ] Provider fail/timeout/abort proven in the **injection harness** (Playwright H on `next start` remains stub-blocked)
- [ ] Migration complete: no eligible `legacy_only`; reconcile green
- [ ] Earlier conversations accessible and read-only
- [ ] Mobile New Chat/send/archive on production-like `next start` (not only `next dev`)
- [ ] Restore/Archive hit targets keyboard-accessible
- [ ] Authenticated production smoke on staff after cutover
- [ ] Recovery control implemented, default `live`, dual-confirm, audited — **separate approval to activate `read_only`**

---

## 5. Deployment prerequisites (before any rollout proposal)

1. Primary identity script green (project + branch).
2. Additive 0005–0009 authorized and applied.
3. Production ops control **implemented** (still default `live`).
4. Wrap authorized for genuine accounts and finished with quiescence.
5. Rehearsal A–G green on `next start`; H green on the harness.
6. No `PARLE_V2_TEST_STUB` / `PARLE_V2_RECOVERY` in production env.
7. Explicit cutover approval distinct from this planning document.
