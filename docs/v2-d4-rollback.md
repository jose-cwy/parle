# Parlé V2-D.4 — synthetic rollback and recovery

**Status:** Rehearsal only. D.5+ and production are not authorized.

Production SHA remains `badd746`. Branch `v2/b1-conversations`. Rehearsal Neon `br-square-unit-apbswjj3`.

Preserving database rows is **not** a rollback. Users still need authenticated list, UUID open, and wrap read APIs.

## A / B / C

| Kind | Meaning | This rehearsal |
| --- | --- | --- |
| **A. Generation path** | Disable V2 message generation (`POST .../messages` streams). Keep GET/list/archive/restore. | Implemented as `PARLE_V2_RECOVERY=1` (ignored in `NODE_ENV=production`). |
| **B. User interface** | Stop shipping HavenChat / V2 sidebar. | **Not rehearsed as the recovery.** That hide post-cutover chats even if rows remain. |
| **C. Database schema** | Drop V2 tables or restore `chat_memory` as the only store. | **Forbidden.** Do not drop V2 objects or delete transcripts. |

Recovery mode is **A**: the current chat UI stays, composer/generation is server-blocked, reads keep working.

## Per-user recovery

| User | What they can read after A | Limitation |
| --- | --- | --- |
| Legacy-only (no wrap) | No invented Earlier conversations. Old `/api/chat/history` is not the product UI. | They cannot see `chat_memory` in V2 until wrap-copy exists. |
| Incomplete wrap | Earlier conversations + honest incomplete/pending copy. Live V2 chats if any. | End of list ≠ complete migration. |
| Fully migrated | Wrap + live V2 chats. | Wrap stays read-only. |
| Post-cutover V2 | Listed by UUID (`?c=`), messages via GET. | Generation 503 until flag off. |
| Archived V2 | Archived list + Restore to active (still cannot send until A ends). | Wrap cannot be restored writable. |
| Interrupted stream | User row remains; GET exposes `incompleteStream`. | Retry is unavailable while generation is disabled. Re-enable does not duplicate completed requests. |

## Re-enable

Unset `PARLE_V2_RECOVERY`. Completed idempotent requests still replay. New sends use the existing lease/stream path. Wrap catch-up is unchanged and still requires `writesQuiesced` to mark `migrated`.

## Pagination

Wrap pages use `conversations.timeline_revision` (monotonic, rehearsal 0009), not `updated_at` milliseconds. Live V2 GET still does not cursor-paginate. A stale wrap cursor returns the first page with `stale: true`.
