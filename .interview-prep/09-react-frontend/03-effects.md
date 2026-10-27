# 03 — Effects (`useEffect`)

## What an effect is for

An effect **synchronizes your component with an external system** — something
outside React's world: a WebSocket, a timer, a browser API, an event listener, a
non-React widget. That's it. If it's not synchronizing with an external system,
it probably shouldn't be an effect.

```tsx
useEffect(() => {
  // 1. setup — runs after the render is committed & painted
  const off = subscribe("MESSAGE", handleMessage);

  // 2. cleanup — runs before the NEXT setup, and on unmount
  return () => off();
}, [subscribe]);   // 3. dependencies
```

Lifecycle, precisely:

1. Mount → run setup.
2. A dependency changed → run **cleanup** (with the *old* values), then setup (with the new).
3. Unmount → run cleanup.
4. In React 18 **StrictMode (dev only)**: mount → setup → cleanup → setup. This is a deliberate stress test — if your cleanup is correct, it's harmless.

---

## The dependency array is a correctness assertion

It is **not** "run the effect when these change". It's: *"this effect reads
exactly these reactive values, and must re-run whenever any of them changes so
it never operates on stale data."*

```tsx
// useTyping — receive side
useEffect(() => {
  if (!conversationId) return;

  const offTyping = subscribe("TYPING", event => {
    if (event.senderId === myUserId) return;
    if (event.conversationId !== conversationId) return;
    // …
  });

  return () => {
    offTyping();
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setTypingIds([]);
  };
}, [conversationId, myUserId, subscribe, forget]);
```

Every value from component scope used inside (`conversationId`, `myUserId`,
`subscribe`, `forget`) is in the array. If you omit `conversationId`, the
subscription keeps filtering against the conversation that was active when the
effect first ran — a stale closure. The `exhaustive-deps` lint rule enforces this.

**Don't "fix" a re-running effect by deleting deps.** Fix the dependency:
wrap functions in `useCallback`, objects in `useMemo`, or move the value out.

---

## Cleanup is not optional

Every subscription, timer, and listener an effect creates, its cleanup must
destroy. The pattern is visible everywhere in this codebase:

```tsx
// useConversations — subscribe returns its own unsubscribe; return it directly
useEffect(() => {
  return subscribe("USER_STATUS_EVENT", event => { /* patch members */ });
}, [subscribe]);
```

```tsx
// RealtimeProvider — the socket itself
useEffect(() => {
  const socket = new ReconnectingWebSocket(nextUrl, [], { … });
  socketRef.current = socket;
  socket.onmessage = e => { /* dispatch */ };

  return () => {
    socketRef.current = null;
    socket.close();          // ← without this, every remount leaks a socket
  };
}, []);
```

Miss the cleanup and you get: duplicate handlers firing N times, timers
outliving the component, memory leaks, "setState on unmounted component" style
bugs, and — with sockets — a new connection per navigation.

---

## `[]` vs `[deps]` vs no array

| Second arg | Runs setup | Typical use |
|---|---|---|
| *omitted* | after **every** render | almost never what you want |
| `[]` | once on mount, cleanup on unmount | subscribe to a stable external system (the socket) |
| `[a, b]` | on mount + whenever `a` or `b` changes | re-subscribe when the conversation changes |

`[]` is a promise that the effect body reads nothing reactive. `RealtimeProvider`
gets away with `[]` because `resolveWsBase()` and `fetch` are not component
state. `useTyping` cannot — it reads `conversationId`.

---

## When NOT to use an effect (the mid-level filter question)

| Instead of an effect… | Do this |
|---|---|
| `useEffect(() => setFullName(first + " " + last), [first, last])` | derive during render: `const fullName = first + " " + last` |
| effect that resets state when a prop changes | pass a `key` to the component so it remounts, or adjust state during render |
| effect to handle a button click (POST, toast, navigate) | do it in the `onClick` handler — that's an *event*, not a synchronization |
| effect to transform props into display data | compute it (memoize if expensive) |
| `useEffect(() => { fetch(...) }, [])` for server data | use TanStack Query / an RSC — see `06` |

`ChatProvider.startConversation` is the counter-example done right: POST, seed
the cache, navigate — all in the **callback**, triggered by a user action. No
effect, because nothing is being *synchronized*; something *happened*.

---

## Effect vs event

- **Event**: happened because the user did something. "Sent a message" → POST in the handler.
- **Effect**: needs to be true as long as the component is mounted / a dep holds. "While this conversation is open, I'm subscribed to its typing events."

`useTyping` has both: `notifyTyping` (event — called on keystroke, throttled) and
the `subscribe` effect (synchronization — active while the conversation is open).

---

## Race conditions in data-fetching effects

If you *do* fetch in an effect, the response can arrive after the input changed:

```tsx
useEffect(() => {
  let cancelled = false;
  fetch(`/api/users/search?q=${query}`)
    .then(r => r.json())
    .then(data => { if (!cancelled) setResults(data); });   // guard
  return () => { cancelled = true; };   // supersede the in-flight request
}, [query]);
```

Type "ab" then "abc": two requests fly, "ab"'s may land last and overwrite
"abc"'s results. The cleanup sets `cancelled = true` for the stale one. TanStack
Query handles this for you (keyed by `["users", query]`), which is one reason
this app uses it instead of raw effects.

---

## `useEffect` vs `useLayoutEffect`

| | fires | blocks paint? | use for |
|---|---|---|---|
| `useEffect` | after paint | no | 99% of things — subscriptions, fetches, logging |
| `useLayoutEffect` | after commit, **before** paint | yes | reading layout (`getBoundingClientRect`) and synchronously re-styling to avoid a visible flicker (e.g. measuring a tooltip before positioning it) |

Reach for `useLayoutEffect` only when you'd otherwise see a flash. It runs on the
server as a warning-worthy no-op — Next.js SSR code should guard it.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| dependency array vs trigger list | It declares what the effect *reads*, so React re-syncs on change. Framing it as "triggers" leads to omitting deps and stale bugs. |
| effect vs event handler | Effect synchronizes with an external system for as long as a condition holds. Handler responds to one user action. |
| cleanup on unmount vs cleanup on re-run | Same function. It runs before *every* re-execution of setup, not only unmount. |
| `useEffect` vs `useMemo` | Effect runs *after* render for side effects. `useMemo` runs *during* render to cache a computed value — no side effects allowed. |
| `[]` vs no array | `[]` = mount/unmount only. No array = after every render. |
| StrictMode double-invoke | Dev-only. Surfaces missing cleanup by running setup→cleanup→setup. Not a bug to suppress. |

---

## 🧠 Hooks

- **An effect synchronizes with an external system.** No external system? Probably not an effect.
- **The dep array says what the effect reads.** Lint-complete it; fix noisy deps at the source (`useCallback`/`useMemo`), never by deleting them.
- **Every subscribe/timer/listener gets a matching cleanup** — return it from the effect.
- **Button did it → event handler. Must stay true while mounted → effect.**
- **Fetching in an effect needs a `cancelled` guard**; or just use TanStack Query.
- **StrictMode runs effects twice in dev on purpose** — to catch the missing cleanup.
