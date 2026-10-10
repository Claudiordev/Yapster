# 07 — Performance

## First: measure, don't guess

React DevTools **Profiler** → record an interaction → look at the flamegraph.
It shows which components rendered, why ("props changed", "hook changed",
"parent rendered"), and how long each took. Optimize what's actually slow.
"Highlight updates when components render" (DevTools settings) is a fast visual
check for renders you didn't expect.

---

## What causes a re-render

1. Its own `setState` / `useReducer` dispatch.
2. Its parent re-rendered (default: children re-render too).
3. A context it consumes got a new value.
4. Its `key` changed → it re-mounts (worse than a re-render).

Note **#2**: a parent re-rendering re-renders all children *even if their props
didn't change*, unless the child is `React.memo`'d. Usually fine — render is
cheap. It's a problem when the child is expensive or there are thousands.

---

## The cheap wins (do these first, always)

**Keep state low.** `MessageComposer` owns its draft text. If that state were in
the parent, every keystroke would re-render the whole thread. Colocation *is* a
performance strategy.

**Stable keys.** Index keys on a reordering list (this app's lists reorder on
every message) cause React to update the wrong DOM nodes and blow away child
state — slow *and* buggy. Use `c.id`.

**Don't put fast-changing values in a wide context.** A context that updates 60×/s
re-renders its whole subtree. Keep that state local.

**Lazy-load routes/heavy components.** `React.lazy(() => import("./Heavy"))` +
`<Suspense>`, or Next's `next/dynamic`. The call panel / screen-share view are
good candidates — most sessions never open them.

---

## `React.memo` — skip re-render when props are shallow-equal

```tsx
const ChatListRow = React.memo(function ChatListRow({ conversation }: Props) {
  // re-renders only when `conversation` (the object reference) changes
});
```

`useConversations` already produces a **new object only for the row that
changed** (`prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c)`) — the
other rows keep their reference, so memo'd rows skip rendering. The immutable
update pattern and `memo` are designed to work together.

**`memo` does nothing if:**
- you pass a fresh object/array/function literal as a prop each render
  (`style={{…}}`, `onClick={() => …}`, `items={[…]}`) — shallow-equal fails every time,
- `children` is fresh JSX each render (it usually is),
- the component re-renders from its own state or context anyway.

So `memo` on a child almost always comes **with** `useCallback`/`useMemo` on the
props the parent passes it. If you're not willing to do both, don't bother.

---

## `useMemo` / `useCallback` for referential stability

Covered in `04`. Two legitimate uses:
1. an actually expensive computation (`useMessages`' flatten/sort of all pages),
2. a value/function that feeds an effect dep array, a `memo`'d child, or a
   context value — where a new reference each render causes downstream churn
   (`ChatProvider` memoizes its whole context value).

**Not** for `const total = a + b`. The hook's own bookkeeping costs more.

React Compiler (React 19+) auto-memoizes and makes most manual `useMemo`/
`useCallback` unnecessary — but this app is on React 18, so they're still hand-written.

---

## Long lists → virtualization

Rendering 10,000 message DOM nodes is slow to mount and janky to scroll.
**Windowing** (`@tanstack/react-virtual`, `react-window`) renders only the ~20
rows in view + a small buffer, and translates them as you scroll. `useMessages`
sidesteps this today by **paginating** (20 per page, load older on demand) so the
DOM never gets huge — pagination and virtualization solve the same problem from
different ends. A very active thread would want both.

---

## `useTransition` / `useDeferredValue` (concurrent features)

For updates that are correct-but-slow (filtering a big list as you type), mark
them low-priority so typing stays responsive:

```tsx
const [isPending, startTransition] = useTransition();
startTransition(() => setQuery(input));   // this state update won't block the keystroke
```

`useDeferredValue(value)` is the same idea for a value you receive rather than set.

---

## Debounce / throttle expensive work

`useTyping` throttles the "still typing" socket send to once per 3 s
(`THROTTLE_MS`) via a `lastSentAt` ref — one request per keystroke would be one
per character. Search-as-you-type wants a debounce (wait for a pause) before
firing the request. Neither is a React feature — plain timers/timestamps — but
they're the highest-leverage perf fix for input-driven work.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| re-render vs DOM update | A re-render recomputes JSX; React commits only the diff. Identical output = zero DOM writes. Skipping *render* is the optimization. |
| `React.memo` vs `useMemo` | `memo` wraps a *component* (skip re-render on equal props). `useMemo` caches a *value* inside a component. |
| `useMemo` vs `useCallback` | value vs function. `useCallback(fn,d) === useMemo(()=>fn,d)`. |
| virtualization vs pagination | Both cap DOM size. Virtualization renders a moving window of a full dataset; pagination loads the dataset in chunks. |
| debounce vs throttle | Debounce: run once after activity *stops*. Throttle: run at most once per interval *during* activity. |
| `useTransition` vs `useDeferredValue` | Transition wraps a state *setter* you control; deferred value wraps a value you *receive*. Both deprioritize the resulting render. |
| CSR vs SSR vs RSC for perf | SSR/RSC cut time-to-first-content and JS shipped; CSR is snappier after load. App Router mixes them. |

---

## 🧠 Hooks

- **Profile first.** DevTools tells you what rendered and why; optimize that, not your guess.
- **Keep state as low as it goes** — the cheapest perf fix there is (`MessageComposer` owns its draft).
- **`React.memo` needs stable props to do anything** — it comes packaged with `useCallback`/`useMemo` or not at all.
- **Immutable updates that only replace the changed row make `memo` effective for free.**
- **Huge list → window it (or paginate).** Don't mount 10k nodes.
- **Input-driven expensive work → debounce/throttle** before you reach for anything React-specific.
