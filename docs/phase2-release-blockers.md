# Phase 2 release blockers (not deployed)

No production deploy. No Phase 3. No new database migration. Frozen baseline files unchanged.

## 1. Authenticated HTTP 429

**Limiter:** in-memory `userChat` burst in `lib/rateLimiter.js` (`error: rate_limited`), applied by `runApiPipeline` on `POST /api/chat/send`. Not the guest daily cap, not `daily_limit_reached`.

**Why it fired in acceptance:** intended anti-abuse **plus** test accumulation **plus** a lock race.

1. Burst was **20 requests / 60 seconds** per authed user. A 12-turn support chat is normal; the first failed e2e already spent quota on fast follow-ups.
2. Burst ran **before** the processing lock, so `429 processing` retries still counted.
3. The processing lock stayed held **after the stream closed** while the assistant row was written, so the next user message in the same second could get `processing` even on a healthy conversation.

**Fix (rate limiting still on):**

- Guest burst remains **10 / 60s** plus the existing guest daily/window cap.
- Authed burst is **40 / 60s** (still stops scripts; allows a fast emotional conversation).
- Chat routes defer burst until after a processing-lock peek, so lock retries do not burn quota.
- Assistant persist / guest training log run **after** the lock is released so the client can send the next turn as soon as tokens finish.

Regression: `tests/unit/rateLimiter.test.js` (12-turn pass, 41st blocked, per-user keys, guest still 10, processing does not consume burst).

Live RC after the lock fix: 4 sequential authed turns including close-turn and crisis **no longer 429**.

## 2. Cross Mode motive speculation

Smallest prompt/quality change: facts vs labeled possibilities vs unknown; gold example for “space vs already done”; do not treat “asked for space” as a proven feeling. New eval cases `cross-analyze-unknown` and `cross-quiet-no-motive`.

Eval (`docs/eval/rc-cross.json`, think off):

| id | score | notes |
| --- | ---: | --- |
| cross-analyze | 10 | Distinguishes fact vs unknown; no “moving on in her own way” |
| cross-analyze-unknown | 10 | Uses possibility language; still sometimes infers “needed to process” |
| cross-quiet-no-motive | 10 | Does not invent a weekend cause |
| cross-done-talking | 8.5 | Scorer false positive on “I’m here whenever you need to talk” |

Live analyze reply named the action vs the unknown and labeled a possibility. It recalled **Kendra** from the earlier test session (personalization still on). Hidden-think header **0**. Crisis path still returned SOS 1-767.

## 3. Release candidate checks

- `npm test`: **95 passed**, 1 skipped (primary persistence guard).
- Hidden-think default **off**.
- Close-turn and safety live: pass.
- Migrations: still only `0001_keep_comments.sql` and `0002_archive_legacy.sql`. **None required for this release.**
- Rollback: code-only (prompts, limiter, send handlers). Revert the deploy; **do not** migrate or touch the production database. `lib/parle/baseline/` remains the conversational prompt snapshot from before Phase 2 edits.

Diff is limiter, chat send/guest-send, Cross prompts/quality, eval/tests. No UI rebuild, no new modes, no Phase 3.

## Remaining concerns

- Cross analysis can still offer a soft “needed time to process” reading. Better than presenting it as fact; not zero speculation.
- Close-turn heuristic still false-positives on “you need to talk later.”
- In-memory burst limiter resets per serverless instance; not a global quota.
- Guest `/chat` composer can still be disabled on first paint (UI), unrelated to these two blockers.

**Stopped for final deployment approval.**
