# Mobile chat performance optimization (local)

**Date:** 22 October 2026 (UTC+8)  
**Scope:** approved P0/P1 frontend fixes from `docs/mobile-performance-audit.md`  
**Production:** not deployed. No schema, model, prompt, or privacy-control changes.

---

## 1. Root causes fixed

1. **Composer text lived on `HavenChat`**, so every keystroke re-rendered the message list and sidebar.
2. **Every SSE delta** cloned the full message array, `setMessages`, smooth-scrolled, and serialized the transcript.
3. **`scrollTo({ behavior: 'smooth' })` on every `messages` change** fought user scrolling.
4. **Guest `sessionStorage` and authed archives** were written on each token.
5. **`await checkRepeatSentiment(...)`** delayed the model request.
6. **Every historical bubble mounted copy/resend/edit/thumbs.**

---

## 2. Files changed

| File | Change |
|---|---|
| `lib/parle/chatUiPerf.js` | Stream batcher, near-bottom helper, throttled persist runner, last-message patch |
| `components/haven/ChatInputBar.js` | Shared `ChatComposerProvider` draft state; memoized input bar |
| `components/haven/HavenChat.js` | Isolated composer, rAF-batched streaming, follow-scroll, throttled persistence, non-blocking repeat-sentiment, compact older actions |
| `tests/unit/chatUiPerf.test.js` | Helper coverage |
| `tests/e2e/chat-perf.spec.js` | 5/20/60/100-message typing + scroll-up regression |
| `docs/mobile-performance-optimization.md` | This report |

No new npm dependencies.

---

## 3. Before-and-after measurements

**Environment (after):** local `next dev` on `http://localhost:3003`, Playwright Chromium/Edge + Pixel 5 emulation, **no 4× CPU throttle**, **no Slow 4G**.  
**Not tested:** real iPhone Safari, real Android Chrome.

**Before (same Playwright harness against then-current `/chat`, unthrottled):**

| Messages | avg keystroke | p95 | DOM nodes | buttons |
|---|---|---|---|---|
| 5 | 3.23 ms | 5.0 ms | 228 | 32 |
| 20 | 2.97 ms | 5.4 ms | 445 | 70 |
| 60 | **7.04 ms** | **10.5 ms** | **1005** | **170** |
| 100 | **7.13 ms** | **9.9 ms** | **1565** | **270** |

Audit lab (4× CPU, 60 messages) was **avg 28.1 ms / p95 34 ms**. That remains the low-power reference, not this unthrottled table.

**After (this change, unthrottled, Chromium):**

| Messages | avg keystroke | p95 | DOM nodes | buttons |
|---|---|---|---|---|
| 5 | 4.15 ms | 5.6 ms | 210 | 27 |
| 20 | 2.27 ms | 3.5 ms | 348 | 43 |
| 60 | **2.08 ms** | **3.4 ms** | **688** | **83** |
| 100 | **2.25 ms** | **4.5 ms** | **1028** | **123** |

Mobile (Pixel 5) matched: 60-message avg **2.16 ms**, p95 **2.8 ms**.

**Streaming / scroll / persist (code + unit, plus one Playwright check):**

- Stream UI now flushes **at most once per animation frame**, then immediately on `done` / abort.
- Unit tests: batcher keeps only the latest delta; patch keeps earlier message object identity.
- Playwright: scrolling a 60-message thread to `scrollTop = 40` did **not** get forced back down.
- Guest/authed transcripts persist on send, on a 2s throttle during stream, on stream complete/abort, and on `pagehide` / hidden tab.

**Time to first visible AI text** is still mostly backend/TTFB. Repeat-sentiment no longer blocks `fetch`. Onboarding Playwright stream still completed.

**Memory:** heap was not sampled in Playwright. Button/node counts dropped ~40–50% at 60–100 messages, which is the main client-side growth lever short of virtualization.

Virtualization was **not** added. 100-message typing is already ~2 ms/key.

---

## 4. Test results

| Suite | Result |
|---|---|
| `npm test` (unit) | **139 passed**, 1 skipped (rehearsal DB write) |
| Playwright `onboarding.spec.js` + `chat-perf.spec.js` against `:3003` | **14 passed** (chromium + mobile) |
| API against `:3003` | Guest crisis/forge/settings-unauth **passed**. Authed forge test **500** (login/seed, not chat UI). `guest-usage` assertion failed on an unexpected status in that process; guest chat Playwright still works. API against stale `:3000` returned mass 500s — wrong/unhealthy server, not this diff. |

---

## 5. Remaining limitations / regressions

- Older message actions are behind a **⋯** control so they stay available without staying mounted expanded.
- `useLayoutEffect` in `ChatInputBar` warns during SSR (composer is still client-driven after hydrate).
- iOS keyboard / `visualViewport` was **not** implemented in this pass (audit P1, not in the approved P0 list).
- Long threads still mount every bubble (no windowing). Fine at 100 messages in this lab.
- Authed archive persist still requires an existing archive row; live-session archive creation paths were not redesigned.

---

## 6. Is mobile chat measurably more responsive?

**Yes, for typing and chrome cost in long threads.** Unthrottled 60-message keystroke average went from **7.0 ms → 2.1 ms**; DOM nodes **1005 → 688**; buttons **170 → 83**. Streaming no longer smooth-scrolls or stringifies the transcript on every token.

---

## 7. Readiness for production

**Locally ready for a named production approval.** Do not deploy until you sign off.

Suggested smoke after deploy: guest 1-turn stream, crisis hotlines, New Chat, history open/close, thumbs on the latest reply, ⋯ on an older reply, refresh mid-guest thread.

---

## Manual checks still worth doing on a phone

1. Type in a long authed chat while a reply streams.
2. Scroll up during streaming — the thread should stay put.
3. Kill the tab mid-reply and reopen as guest — user turn should restore; partial assistant may be up to 2s stale then complete on next successful finish.
4. iPhone Safari keyboard covering the composer (still open).
