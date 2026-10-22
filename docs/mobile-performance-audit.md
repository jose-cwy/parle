# Parlé mobile performance audit

**Date:** 22 October 2026 (UTC+8)  
**Target:** production `https://parle.chat` (same tree as `3913dea`)  
**Scope:** investigation only. No product, schema, AI, or environment changes. No production user data was edited. One guest synthetic send was used after signing the lab browser out of the founder account.  
**Status:** audit complete. **Stop for approval before implementing fixes.**

---

## Verdict

Parlé is **not yet genuinely responsive enough on mobile** for the chatbot to be the product people live in for long sessions.

A short, empty chat (greeting + composer) is usable. A long thread is not: at **60 messages**, the composer spent **~28 ms per keystroke** in a 4× CPU lab, the document held **~1,000 DOM nodes and 170 buttons**, and every streamed token is wired to **rebuild the full message list**, **smooth-scroll the thread**, and **serialize the transcript to `sessionStorage`**. That matches “freezes, ignores taps, typing lag” far better than layout-only issues from the V1 audit.

**Fix before expanding usage:** stream + scroll + composer isolation (P0), then persistence-on-every-token and per-message action chrome (P1). Landing, quotes chips, and admin tabs are secondary.

---

## Testing environment (limitations)

| Item | What was used |
|---|---|
| Browser | Cursor IDE Chromium (`cursor-ide-browser`), not iOS Safari and not Android Chrome |
| Viewport | `Emulation.setDeviceMetricsOverride` **390×844**, `deviceScaleFactor: 3`, `mobile: true` (iPhone 14-class CSS pixels) |
| CPU | `Emulation.setCPUThrottlingRate` **4×** for chat typing / send |
| Network | **Not** Slow-4G shaped. Resource sizes below are from a **warm cache** (many `transferSize: 0`) |
| Touch | `Emulation.setTouchEmulationEnabled` on; this is still a desktop Chromium input pipeline |
| Real devices | **None.** Do not treat these numbers as iPhone Safari or low-end Android field data |
| Runs | Landing reload ×2 (cached); chat empty + 60-message guest thread ×1; one guest send ×1; dashboard / journal / quotes / login / admin overview ×1 each |
| WebKit | Unavailable in this lab (same constraint as Playwright: Edge/Chromium only) |

INP from the Chrome UX Report was not collected. Per-keystroke `input` handler duration is the interaction proxy. LCP Performance entries were empty because observers were attached after first paint; FCP/DCL from Navigation Timing are reported instead.

Frontend lag is separated from API/AI latency in the chat send section.

---

## What feels slow vs what is the network

| Symptom | Class | Evidence |
|---|---|---|
| Typing lag in a long thread | **Frontend** | 49 synthetic `input` events on a 60-message thread: **1378 ms total, avg 28.1 ms, p95 34 ms, max 42 ms** (4× CPU) |
| Taps feeling dead while the model is talking | **Frontend** | Stream path calls `setMessages` on every SSE delta; parent `HavenChat` re-renders the whole tree including 170 buttons |
| First assistant words appearing late | **Mostly backend/AI** | After send, first assistant text ~**2.3 s** after the user bubble (see send timeline). That wait is model/TTFB, not the 28 ms keystroke cost |
| Extra delay before the stream even starts | **Frontend + extra API** | `send()` `await`s `/api/chat/repeat-sentiment` **before** `requestAssistantReply` |
| Smooth jumping while tokens arrive | **Frontend** | `scrollTo({ behavior: 'smooth' })` on every `messages` change; **10 `scrollTo` calls** during one short reply |
| Landing / quotes / admin “heavy but tappable” | **Frontend paint/DOM** | Global **397 KB decoded CSS**; testimonial carousel clones; chapter chips clip |

---

## Confirmed problems

### P0 — Streaming re-renders the entire chat on every token

**How to reproduce:** Open `/chat` with a long transcript (guest draft or a real session). Send a message and watch the assistant stream.

**Measured / profiler-adjacent evidence:**

- Code: `consumeChatStream` → `onUpdate(reply)` → `commitMessages` → `(prev).map(...)` → `setMessages(next)` for **every SSE delta**.
- For signed-in users, the same path also `JSON.stringify`s **all local archives** via `saveChatArchive` and bumps `archivesRevision` (sidebar rebuild).
- For guests, a `useEffect` on `[messages]` writes the **full transcript** to `sessionStorage` on each update (18.3 KB at 60 messages, 18.6 KB after the extra turn).
- Lab: 60-message thread → **1003 nodes, 170 buttons, 16.7 MB JS heap** before send. One short stream: **9 DOM mutation batches, 10 `scrollTo` calls**.

**Root cause / files:**

- `components/haven/HavenChat.js` (`commitMessages`, `consumeChatStream` callback ~1531–1540, guest draft effect ~1146–1157, sidebar effect ~1193–1208)
- `lib/parle/chatArchives.js` (`saveChatArchive`)
- `lib/parle/guestChatDraft.js` (`saveGuestChatDraft`)
- `Bubble` / `AssistantBody` are **not memoized**; `parseBoldSegments` runs for the streaming bubble every token. Markdown is bold-only, so markdown itself is cheap; **recreating the whole list** is not.

**Expected improvement:** Tokens should paint without the thread going inert. Main-thread work per delta should drop from “O(n messages + stringify transcript)” to “update one node, maybe rAF-batched”.

**Safest fix:** Keep a ref for the streaming assistant text. Batch UI updates with `requestAnimationFrame` (or ~50–80 ms). Persist archives/drafts **once on `done`**, not per delta. Do not `map` the entire array when only the last message text changed.

---

### P0 — Smooth auto-scroll fights the user during streaming

**How to reproduce:** Send a message. While tokens arrive, try to scroll up. Or just watch the thread on a 60-message list.

**Evidence:**

```1189:1191:components/haven/HavenChat.js
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])
```

Lab: first user-bubble mutation and first `scrollTo` were recorded **together**; **10 smooth scrolls** during one reply.

`behavior: 'smooth'` starts a new animation on every token. On mobile this queues compositor work, steals touch, and feels like the page is ignoring fingers.

**Expected improvement:** Follow-the-stream without jank; scrolling up should stick.

**Safest fix:** During stream, `scrollTop = scrollHeight` (instant) only if the user is already near the bottom. Disable follow when `scrollHeight - scrollTop - clientHeight` exceeds a threshold. Never use `smooth` in the token loop.

---

### P0 — Composer state lives in `HavenChat`, so typing re-renders the thread

**How to reproduce:** In a 60-message guest chat, type in the composer.

**Evidence:** `const [text, setText] = useState('')` in `HavenChat`; `ChatInputBar` is `text` / `onTextChange={setText}`. Each character re-renders sidebar, all bubbles, feedback buttons, and `useLayoutEffect` height resize in `ChatInputBar`.

Lab (4× CPU, 60 messages): **avg 28.1 ms / keystroke**, **1378 ms** for 49 characters. Empty/short chats were not similarly expensive in code (same path, far fewer children).

**Root cause / files:** `components/haven/HavenChat.js`, `components/haven/ChatInputBar.js`.

**Expected improvement:** Typing should stay near 1–8 ms per key even with a long transcript.

**Safest fix:** Hold draft text inside `ChatInputBar` (uncontrolled or local state). Read it on send. Optionally `memo` `Bubble` with a stable `id` key (today’s fallback `m.text.slice(0, 8)` is a landmine if `id` is missing).

---

### P1 — Long threads mount every action control (no virtualization)

**How to reproduce:** Load 60 messages. Inspect the accessibility tree / query `button`.

**Evidence:** 60 bubbles → **170 buttons** (copy / resend / edit on every user turn, thumbs on every assistant turn), **~1,000 DOM nodes**. All stay in the document; nothing is windowed.

That is the progressive-lag mechanism: more history → more nodes → every stream/token/keystroke is more expensive.

**Files:** `HavenChat.js` (`UserMessageBubble`, `MessageFeedbackActions`).

**Expected improvement:** 60–200 message sessions stay in the same performance class as a 10-message session for typing and streaming.

**Safest fix:** Render actions on the last few messages, or on long-press. Later: window the list (architectural). Do not add a virtualization library until the P0 stream/composer path is fixed — windowing on a still-re-rendering parent will not be enough.

---

### P1 — Send path does extra work before the model stream

**How to reproduce:** Send any chat message.

**Evidence:** `send()` calls `setMessages` (good), then **`await checkRepeatSentiment`** (POST `/api/chat/repeat-sentiment` with the last six messages), then starts loading and `requestAssistantReply`. User bubble can appear, but the network stream is delayed by a whole extra round trip.

**Files:** `components/haven/HavenChat.js` (`send`, `checkRepeatSentiment`).

**Expected improvement:** Time-to-first-token closer to raw API TTFB.

**Safest fix:** Fire repeat-sentiment in parallel (or after stream start). Do not await it before `fetch` of `/api/chat/guest-send` or `/send`.

---

### P1 — Mobile keyboard / viewport is not handled

**How to reproduce:** On a real phone, focus the composer. (Lab cannot open the OS keyboard.)

**Evidence (code, not device):**

- Viewport meta is `width=device-width, initial-scale=1` only — no `interactive-widget`, no `viewport-fit=cover`.
- Composer is `position: fixed; bottom: var(--parle-mobile-nav-inset)`.
- **No `visualViewport` listeners** in chat.
- Layout uses `100dvh` plus a fixed bottom nav (~64px) for signed-in users.

This is the standard iOS Safari failure mode: keyboard covers the field, or the visual viewport resizes and the thread jumps. Classified **P1 suspected on iOS**, **confirmed structurally**.

**Files:** `pages/_app.js`, `styles/parle-chat.css` (`.parle-chat-main__bottom-fixed`).

**Safest fix:** Subscribe to `visualViewport` and offset the composer by `window.innerHeight - visualViewport.height`. Confirm on a real iPhone before calling it done.

---

### P1 — Global CSS + JS payload on every route

**Evidence (landing, cached):**

- One stylesheet **397,355 bytes decoded** (`530db4ebf7f7eb88.css`)
- JS decoded on `/`: **~835 KB** including `_app` 234 KB, framework 141 KB, main 116 KB, plus prefetched `chat` / `journal` / `dashboard` / `register` chunks (`pages/_app.js` prefetches those paths)
- Chat route adds `chat-*.js` **82,544 bytes decoded** — reasonable, but it sits on top of the global CSS parse

`pages/_app.js` imports tokens, theme, globals (**181 KB source**), marketing, parler-landing, quotes-book, admin, mobile-app, etc. for **every page**.

**Expected improvement:** Faster first paint and less parse/TBT on mid-tier phones, especially landing → chat.

**Safest fix:** Stop prefetching every app route on first load. Split admin/quotes/marketing CSS so `/chat` does not parse them. No new dependencies required.

---

### P2 — Landing testimonials: triple DOM + CSS animation

**How to reproduce:** Open `/` at 390px width.

**Evidence:** 108 `<article>` nodes earlier in the session; `VerticalTestimonialsSpin` mounts **desktop lanes + mobile duplicated tracks + static grid**. CSS `display: none` hides unused variants, but they still hydrate. Mobile tracks use `will-change: transform` and infinite `translateX` animations (`styles/parler-landing.css`).

Not the chat freeze, but it is main-thread/GPU cost before the user ever reaches chat.

**Safest fix:** Mount only the mobile rows on small viewports (media in JS, not only CSS).

---

### P2 — Horizontal clipping on dashboard, quotes, admin nav

**How to reproduce:** 390px viewport.

**Evidence (screenshots):**

- Dashboard feature cards: third tile (“find a line”) clipped
- Quotes chapter pills: “Letting Go” / “Moving On” clipped (inner scroller, `document.scrollWidth === 390`)
- Admin overview tabs: “Conversations” cut off

**Safest fix:** Horizontal snap/scroll with peek padding; do not shrink tap targets below 44px.

---

### P2 — Guest consent overlay blocks first interaction

**How to reproduce:** Signed-out `/chat`.

**Evidence:** Composer, send, mode, mic, and empty-state prompts are `disabled` until **Got it**. That is product-correct, but the first tap “does nothing” if the user aims at the field instead of the banner.

**Safest fix:** Autofocus **Got it**; do not leave a focused-but-disabled textarea.

---

### P3 — Admin charts are light

Custom SVG bars (`components/admin/AdminCharts.js`), **2 charts, 191 nodes, 10.5 MB heap** on overview. Not a mobile-user blocker. Nav overflow is the real admin mobile issue (P2).

---

## Suspected (not lab-proven)

| Item | Why suspected | What would confirm |
|---|---|---|
| iOS Safari keyboard covering composer | Fixed bottom UI, no `visualViewport` | Real iPhone Safari |
| Ignored taps from sidebar hit-testing | Off-canvas sidebar is still in the tree (`transform: translateX(-100%)`, 260×844) | Pointer hit-test on device |
| Authed `localStorage` archive stringify per token | Code path is definite; this lab send was **guest** | Repeat stream while signed in on a test account |
| Memory leak from listeners | Feedback `pointerdown` is cleaned up; stream abort looks sound | Heap timeline over 10 sends on-device |
| Heavy markdown | Only `**bold**` parsing | N/A — not a full markdown renderer |

---

## Page-by-page (mobile width)

| Route | Nodes (approx.) | Notes |
|---|---|---|
| `/` | ~210 layout nodes; 108 testimonial articles when counted | FCP **348–532 ms** cached; CSS 397 KB decoded |
| `/login` | 99 | Simple form; no overflow |
| `/dashboard` | — | Feature row clips; fine otherwise |
| `/chat` empty | ~214 | Consent disables composer |
| `/chat` 60 msgs | **1003 nodes, 170 buttons** | Core lag surface |
| `/journal` | Calendar + privacy modal | Overlay is expected; did not type (would write account data) |
| `/quotes` | 276 nodes, 93 quote-like | Chapter chips clip; list is acceptable |
| `/admin` | 191 | Tab overflow; SVG charts cheap |

Journal, quotes, dashboard, and admin were exercised only as the signed-in founder **read-only** (privacy modal dismissed; no journal text; no admin mutations). Chat long-thread work was **guest + synthetic sessionStorage**.

---

## Chat send timeline (60-message guest thread, 4× CPU)

Observers were armed, then Send was clicked. Absolute times are from arm, so the ~3.9 s until the user bubble includes tool/click delay. The **gaps** are the useful numbers:

| Event | Time |
|---|---|
| First extra message + first `scrollTo` | same moment (UI ack ≈ scroll) |
| First assistant text | **~2.3 s after** user bubble |
| `scrollTo` count during reply | **10** |
| Mutation batches | **9** |
| Final guest draft size | 18,556 bytes |

The 2.3 s to first visible AI text is **backend/AI**. The 10 smooth scrolls and full-list re-renders during that window are **frontend**.

---

## Quick wins (do these first)

1. Instant stick-to-bottom scroll during stream; cancel if the user scrolls up.
2. rAF-batch streaming `setMessages`; patch last message only.
3. Persist guest draft / archives on stream **complete**, not per token.
4. Move composer text state into `ChatInputBar`.
5. Do not await `repeat-sentiment` before starting the chat request.
6. Hide copy/resend/edit/feedback except on the latest messages (or long-press).

No new dependencies.

---

## Architectural (after the wins)

1. Virtualize the message list.
2. Split global CSS; drop blanket `router.prefetch` of every app route.
3. `visualViewport` composer offset; verify on iPhone Safari and Android Chrome.
4. Conditionally mount landing testimonial variants.
5. Memoize `Bubble` only after measuring (the parent stream `setMessages` is the larger bug).

---

## What we should not do

- Do not add Redis, a new animation library, or a markdown engine for this.
- Do not change the model or prompts to “make it feel faster”.
- Do not treat a resized desktop window as a substitute for the iPhone Safari pass this audit could not run.

---

## Approval gate

Implement **P0 items 1–3** (stream batching, instant scroll, composer isolation) only after named approval. Re-measure the 60-message typing loop and one guest stream on this lab, then schedule a real-device Safari/Chrome pass before calling mobile “good enough” for broader usage.
