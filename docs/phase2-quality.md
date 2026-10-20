# Phase 2 — AI Conversation Quality (not deployed)

Status: **complete locally. Not deployed. Phase 3 not started. Production database untouched.**

Objective: make Parlé more natural, emotionally understanding, and useful for relationship problems, while keeping all six modes, safety, and Phase 1 memory/session history.

## What was frozen first

Before prompt edits, conversational modules were copied to `lib/parle/baseline/` (do not import at runtime). Restore by copying those files back over `lib/parle/{prompts,replyQuality,hiddenThink,chatComplete}.js`.

Frozen eval (gpt-4o-mini, temperature 0.65, 36 synthetic scenarios):

| Run | Think | n | avg heuristic | avg think ms | avg reply ms | avg total ms | est USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `docs/eval/baseline.json` | on | 36 | **9.35** | 1498 | 1326 | 2824 | 0.0418 |
| `docs/eval/baseline-think-off.json` | off | 12 | **9.79** | 0 | 1384 | 1384 | 0.0134 |

Baseline Vent average: **7.25** (unsolicited questions). Cross close-turns often kept interviewing.

## What changed (incremental)

Contradictions resolved: Vent and conversation-ending no longer inherit “gather the story / keep asking.” Cross/Emotional lead with comfort, then at most one situation question. Logical is instructed not to invent the other person’s inner life. Hidden-think is **off by default** (`PARLE_HIDDEN_THINK=on` restores it) and is skipped in Vent and Let’s Just Talk even when on.

## Previous vs updated (same 36 scenarios)

Updated run: `docs/eval/updated.json` (think **off**, matching the new default).

| | Baseline think-on | Updated think-off |
| --- | ---: | ---: |
| avg heuristic | 9.35 | **9.88** |
| Cross | 9.50 | **10.00** |
| Emotional | 9.75 | **10.00** |
| Logical | 9.58 | **9.83** |
| Vent | 7.25 | **9.42** |
| Stop contact | 10.00 | 10.00 |
| Let’s Just Talk | 10.00 | 10.00 |
| avg total latency | 2824 ms | **1485 ms** |
| est USD / 36 | 0.0418 | 0.0414 |

Largest lifts: Vent questions, Cross/Emotional close-turns (`cross-done-talking`, `emotional-closing`), Logical banned opener on “what should I do.”

Still deducted on updated: `logical-analyze-no-assume` (question stack), `vent-instagram` (rhetorical `?` counted as a question), `vent-hate-happy` (parrot overlap).

## Hidden-think on vs off

Comparable 12-id subset (`THINK_COMPARE_IDS`):

| | Baseline on | Baseline off | Updated off (same 12 ids) | Updated on |
| --- | ---: | ---: | ---: | ---: |
| avg heuristic | 9.25 | **9.79** | **9.83** | **9.79** |
| avg think ms | ~1500 | 0 | 0 | 1254 (0 on vent/talk) |
| avg total ms | ~2800 | 1384 | ~1485 | 2565 |

Hidden-think did **not** improve heuristic quality on the frozen baseline (off 9.79 vs on ~9.42). After prompt fixes, think-on matched or slightly trailed think-off on the subset and added ~1.3–1.5 s plus a second model call.

**Recommendation: keep the module, disable by default, skip Vent/Talk.** Do not delete it. Do not turn it back on solely for quality — measured quality was equal or worse, latency roughly doubled, cost slightly higher. Re-enable with `PARLE_HIDDEN_THINK=on` if a later human eval shows a mode-specific gain.

Model **not** changed (`gpt-4o-mini`). No request to switch models.

## Blind review

Unlabeled pack: `docs/eval/blind-review.md` (key: `docs/eval/blind-review-key.json`).

Reviewer scored a 12-item sample covering Cross dump/close, Emotional close, Logical analysis/plan, and all Vent stress cases **before** applying the key:

| Scenario | Winner | Was updated |
| --- | --- | --- |
| cross-thin-miss | slight R | yes |
| cross-fight-dump | L (one follow-up, less interview) | yes |
| cross-done-talking | L (no extra question) | yes |
| emotional-closing | L (lets them sleep) | yes |
| logical-analyze-no-assume | L (fewer stacked questions) | yes |
| logical-what-should-i-do | R (shorter, concrete) | yes |
| vent-hate-happy | R (no question) | yes |
| vent-instagram | L (no interview) | yes |
| vent-left-on-read | R | yes |
| vent-stacked | L | yes |
| vent-done | R | yes |
| vent-no-fix | L | yes |

Updated won **12 / 12** of this sample. Ties on Stop-contact openers (hardcoded first line). Cross analyze remains somewhat speculative on both sides; Logical unknown-motive still sometimes guesses a “significant” weekend event.

This is an operator review of synthetic text, not a separate blinded panel.

## Tests

`npm test`: **89 passed**, 1 skipped (primary-branch persistence guard). New coverage: Vent ignore-gather, close-turn, Logical no-mind-read, hidden-think default off, 36-scenario suite shape.

Eval runner: `npm run eval:phase2 -- --label=updated --think=off`

## Affected files

Runtime: `lib/parle/prompts.js`, `lib/parle/replyQuality.js`, `lib/parle/hiddenThink.js`, `pages/api/chat/send.js`, `pages/api/chat/guest-send.js`

Eval/docs: `lib/parle/eval/scenarios.js`, `lib/parle/eval/score.js`, `scripts/phase2-eval-run.js`, `scripts/phase2-blind.js`, `docs/eval/*`, this file

Tests: `tests/unit/replyQuality.test.js`, `tests/unit/hiddenThink.test.js`, `tests/unit/phase2Eval.test.js`

Config: `.env.example` (`PARLE_HIDDEN_THINK`), `package.json` (`eval:phase2`)

Reversible snapshot: `lib/parle/baseline/`

Unchanged on purpose: production DB, UI, new modes, Phase 3 analytics, `OPENAI_MODEL`, living-profile / session-history wiring in `send.js`.

## Remaining weaknesses

- Vent still slips rhetorical questions (`cheer them on?`) which the scorer treats as questions.
- Logical analysis can still stack 3+ questions and lean on generic “love vs convenience” language.
- Cross analyze can still speculate about the other person’s motives when asked to analyze.
- Gold examples still end with questions; the model copies that habit on thin Cross turns (`i miss them`).
- Heuristic 0–10 is a proxy. Sampling variance showed up (same settings, Vent `no-fix` 10 vs 8.5 across two updated runs).
- No live logged-in browser pass of memory injection in this phase (Phase 1 coverage retained; prompt path still injects living profile).

## Verdict

**Yes — the updated AI is genuinely better** on the Phase 2 contract: Vent no longer interviews by default, close-turns stop asking, Cross is comfort-first, Logical is less assumptive, latency is about half with think off, cost is similar or slightly lower. It is **not** production-ready without a human product pass on real chats.

**Do not deploy. Do not start Phase 3** until explicitly approved.
