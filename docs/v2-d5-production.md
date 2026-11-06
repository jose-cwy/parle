# Parlé V2-D.5 — production recovery design and rollout plan

**Status:** Design only. No production switch, primary migration, or genuine wrap in this milestone.

Production SHA remains `badd746`. Branch `v2/b1-conversations`. Rehearsal Neon `br-square-unit-apbswjj3`.

`PARLE_V2_RECOVERY` is a rehearsal env flag and **must stay inert in production**. It is not an operational control.

## Why shipping `badd746` again is not a V2 rollback

Once any user has `origin=live` conversations, those messages live in `conversations` / `conversation_messages`, not in `chat_memory`.

Redeploying `badd746` restores `/api/chat/send` and the account-wide timeline UI. It does **not**:

- list V2 conversations
- open `?c=` UUIDs
- show Earlier conversations
- keep archive/restore

Users would see only `chat_memory` (if wrap-copy never deleted it) and would **lose access** to every post-cutover V2 chat even though the rows still exist. Rollback of the **app SHA** without keeping V2 read APIs is data-hiding, not recovery.

## Production recovery mechanism

**Rehearsal (V2-F):** implemented behind `PARLE_V2_OPS_CONTROL=1` on `br-square-unit-apbswjj3` only. **Production:** not exposed, not activated, 0010 not applied to primary.

**Name:** generation control `v2_generation`  
**Default:** `live` when the row is missing and nothing has confirmed `read_only`. A confirmed `read_only` must not revert to `live` because a later control read failed.

### Shape

Store one row in an additive ops table (future authorized primary migration, not 0009):

```text
parle_ops_controls (
  key TEXT PRIMARY KEY,          -- 'v2_generation'
  value TEXT NOT NULL,           -- 'live' | 'read_only'
  updated_by UUID NOT NULL,      -- admin user id
  updated_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL
)
```

Read path: `authorizeConversationSend` and `POST /api/conversations/:id/messages` consult this row (short in-process cache, 8s TTL, because Vercel lambdas have no shared memory). GET list/legacy/`?c=` remain readable. New sends are rejected **before** inserting request or message rows.

Missing row (never confirmed `read_only`) → **`live`**. Unreadable DB after confirmed `read_only` → **stay `read_only`**. Cold process with no confirmed value and a failed read → fail-closed `read_only`. Log `ops_control_read_failed` with code only, never message bodies. See `docs/v2-f-ops-control.md`.

### Activation

1. Admin allowlisted in `ADMIN_EMAILS`.
2. Authenticated `POST /api/admin/ops/v2-generation` with `{ value, reason, confirm: "READ_ONLY" | "LIVE" }`.
3. Audit `admin_access` + a new `ops_control_changed` event: actor id, old/new value, reason, request id. No transcripts.
4. Dual confirmation string prevents a stray click.

There is no client header, query param, or `PARLE_V2_*` env that can enable this in `NODE_ENV=production`.

### While `read_only`

- Server returns 503 `generation_unavailable` on new V2 sends (same contract as rehearsal).
- Completed idempotent requests may replay.
- Wrap stays 403 on send/restore-to-writable.
- UI uses the existing read-only banner.
- `/api/chat/send` must already be off for cut-over users; do not re-open account-wide clear.

### Resume

Admin sets `live` with `confirm: "LIVE"` and a reason. Smoke: one synth or staff send on a throwaway conversation. Watch error rate and `generation_unavailable` count drop to zero.

### Vercel

Env-only toggles require redeploy and cannot be urgent. A DB-backed control is visible to every lambda on the next request after TTL. No sticky disk. Do not put the switch in `vercel.json`.

## Rollout sequence (not executed)

1. **Code** on `v2/b1-conversations` with V2 APIs, wrap UI, restore hit-target, ops control **implemented and default live** (future approval).
2. **Schema on primary** as separately authorized additive migrations: 0005 → 0006 → 0007 → 0008 → 0009. Stop if checksum/branch mismatch.
3. **Do not cut over send yet.** Production still `badd746` `/api/chat/send` until wrap exists for every account that has `chat_memory`.
4. **Quiesce** new `chat_memory` writers for a named window (feature freeze of `/api/chat/send` inserts) **after** wrap job is ready.
5. **Wrap-copy** all eligible users; catch-up until `writesQuiesced` and reconcile counts (no plaintext logs).
6. **Hard stop if any eligible user remains `legacy_only` with `chat_memory` rows and no wrap.** Those users would silently lose V2 history access.
7. **Read-only smoke:** staff accounts open wrap + a live V2 chat.
8. **Cut over** HavenChat to V2 send. Keep `chat_memory` rows.
9. **Authenticated smoke:** New Chat, switch, refresh `?c=`, archive/restore, wrap read-only, cross-user 404.
10. **Monitor:** send 5xx, `generation_unavailable`, wrap 403, migration `interrupted` counts, Neon errors. No body logs.
11. **Phased exposure:** staff → internal → 100% only after smoke and reconcile stay green.
12. **Recovery:** set `v2_generation=read_only` (not a `badd746` redeploy). Resume with `live`.

### Stop conditions

- Reconcile mismatch (unmapped, extra dest, owner mismatch)
- Any wrap marked `migrated` without quiescence
- Cross-user 200 on a foreign UUID
- Primary migration targeting the wrong Neon branch
- Restore/Archive failing the A–H gate
- Decision to “just redeploy badd746” after V2 chats exist

### Dependencies that block staged rollout today

- Genuine-user wrap is **not authorized**
- Primary 0005–0009 are **not authorized**
- Production ops control is **not implemented**
- Legacy-only accounts cannot see `chat_memory` in V2 until wrapped (**P0**)
- Full A–H gate must stay green on rehearsal after Restore fix
