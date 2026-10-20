# Phase 2 final acceptance round (not deployed)

Status: **complete locally. Not deployed. Phase 3 not started. No production schema/migrate/cleanup.** Frozen baseline files were not overwritten.

## Changes made and why

Smallest prompt/quality edits after failed Phase 2 scenarios (no model change, no architecture change, six modes kept, hidden-think still default **off**).

- **Logical question stacking:** at most one question; prefer none when analyzing. Gold examples added for thin “love vs convenient” and unexplained silence.
- **Invented motives:** Cross/Logical gold and quality blocks now say stay with stated facts; do not invent overwhelmed / already done / moving on. Replaced the old gold that picked “they loved you” vs “you were convenient” from thin facts.
- **Vent phrasing:** ban question marks including rhetorical; do not paste the whole last sentence (parrot). Gold “cheer them on?” marked wrong.
- **Question-heavy gold:** Cross analyze example no longer invents inner life.

Runtime files: `lib/parle/prompts.js`, `lib/parle/replyQuality.js`. Scorer gained a few extra mind-read patterns in `lib/parle/eval/score.js` (used for this round; frozen `docs/eval/baseline.json` replies were not regenerated).

## Automated evaluation

Same 36 scenarios. Equivalent **think-off** comparison is previous Phase 2 `updated.json` vs this `acceptance.json`. Frozen **think-on** baseline remains `docs/eval/baseline.json`.

| Run | Think | n | avg score | avg total ms | est USD |
| --- | --- | ---: | ---: | ---: | ---: |
| Frozen baseline | on | 36 | 9.35 | 2824 | 0.0418 |
| Phase 2 updated | off | 36 | 9.88 | 1485 | 0.0414 |
| **Acceptance** | off | 36 | **9.89** | **1359** | **0.0427** |
| Acceptance think-on subset | on | 12 | 9.92 | 2429 | 0.0143 |
| Baseline think-off subset | off | 12 | 9.79 | 1384 | 0.0134 |

By mode (acceptance think-off): Cross 9.75, Emotional 10, Logical **10**, Vent 9.58, Stop 10, Talk 10.

**Fixed vs previous updated:** `logical-analyze-no-assume` 9→10 (no 3-question stack), `vent-instagram` 7.5→10 (no `?`), `vent-hate-happy` 9→10 (less parrot).

**Regressions / negative results:** `cross-done-talking` 10→8.5 (scorer hit `you need to` in “If you need to talk more later” — false-positive “unsolicited advice”, no question). `vent-stacked` 10→7.5 (rhetorical `using your song after everything?`). `cross-analyze` still scored 10 but **still invents** “if she felt overwhelmed” / asks about her mindset.

Hidden-think on vs off (12 ids): acceptance on 9.92 vs off 9.83-equivalent; still ~1.2 s extra think, ~2.4 s total. **Keep off by default.**

## Human review (two independent reviewers)

Unlabeled 10-pair sample: `docs/eval/acceptance-blind-sample.md` (previous Phase 2 updated vs this acceptance). Reviewers did not see the key.

After unblinding:

| Reviewer | Acceptance wins | Updated (previous) wins | Ties |
| --- | ---: | ---: | ---: |
| [Reviewer A](839c2041-430d-450f-ac35-5d1ada6190a6) | 7 | 2 | 1 |
| [Reviewer B](8610a7d6-1ee8-4a1f-8cf0-6ed35ab56d6b) | 5 | 4 | 1 |

Disagreements: close-turn (A tie / B previous), Logical “what should I do” (A acceptance / B tie), Vent hate-happy (A acceptance / B previous). Agreement for acceptance on Logical thin-analyze, Vent Instagram, Emotional close, Cross-analyze (less speculative), and Vent “our song.”

Net: reviewers **lean acceptance, not unanimous**. Motive-invention on Cross-analyze remains a human concern even when the heuristic is 10.

## Live application tests

Fictional account `testuser_a@parle.test` through local `/api/chat/send` (same handlers as the UI). Results: `docs/eval/acceptance-e2e.json`.

| Path | Result |
| --- | --- |
| Multi-turn Cross | Pass. Comfort-first; still asked a feeling question after a full dump. |
| Switch to Logical + explicit advice | Pass. Hold off texting Kendra; no motive invention. |
| Switch to Emotional | Pass. |
| Let’s Just Talk (movie) | Pass. Stayed on the film. |
| Stop contact | Pass. Did not push send. |
| Finish conversation | Pass. No follow-up question. |
| Vent-only 1–2 | Pass (no `?`). Replies were longer / more interpretive than Vent gold. |
| Vent-only 3 (`don't fix it`) | **Fail — HTTP 429 `rate_limited`** (abuse limiter after the prior turns, not a model miss). |
| New-session memory | **Pass.** Recalled Kendra Hale and the rooftop dinner. |
| Crisis language | **Pass.** Immediate safety copy with SOS 1-767, IMH, chat.mentalhealth.sg. |
| Guest Cross | Pass. Think header 0 ms. |

Think-ms on live sends: **0** (hidden-think off).

## Latency and cost (live)

Representative authed turns (think off):

| Turn | TTFB (`ttfbMs`) | Full wait |
| --- | ---: | ---: |
| Cross 1 | 1358 ms | 3987 ms |
| Logical advice | 811 ms | 3184 ms |
| Memory new session | 3367 ms | 3746 ms |
| Guest | 855 ms | 1026 ms |
| Crisis (non-stream JSON) | — | 1243 ms |

Suite average visible ~**1175 ms** TTFB, ~**3325 ms** full wait. Stream path does not return token usage; eval-suite tokens for this acceptance run: **277,925 in / 1,658 out ≈ $0.0427** at gpt-4o-mini list rates for 36 synthetic turns. Live cost is the same model; per live turn is roughly 7k prompt tokens from the system prompt.

## Remaining weaknesses

- Cross “analyze this” still writes a psychology of the other person, then admits uncertainty.
- Vent still uses rhetorical `?` on some turns (`vent-stacked`) and can run long / slightly advice-like in live multi-turn.
- Close-turn copy can sound templated (“I’m here if you need to talk”).
- Heuristic false positive on “you need to talk later.”
- User chat rate limit can 429 a real multi-turn session (seen on the 10th authed send).
- Guest/Cross still often asks “what happened” after a thin miss.

## Unresolved safety / personalization

- Safety keyword path works on the dedicated test account. Not a substitute for a moderation service (existing TODO in `lib/chatSafety.js`).
- Personalized memory retrieval worked for a distinctive fictional person/event after `session-end`. Living-profile injection still sometimes uses generic “it's understandable.”
- Production DB was used only as the live app already does for this test account (chat rows + session-end). No migrations or cleanup.

**Stopped.** Awaiting approval to deploy or to start Phase 3.
