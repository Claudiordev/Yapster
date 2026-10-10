# React interview questions — with answers

~55 questions, grouped. Answers are short on purpose — enough to say out loud.

---

## Rendering & JSX

**1. What does JSX compile to?**
`React.createElement(type, props, ...children)` calls that return plain element
objects (`{type, props, key}`). Nothing touches the DOM until React renders the tree.

**2. Difference between an element and a component?**
Component = the function. Element = the object it produces. `<Foo/>` is an element;
`Foo` is a component.

**3. Walk through what happens after `setState`.**
Trigger → **render** (React calls the component, builds a new tree, diffs it
against the old one — reconciliation) → **commit** (apply the minimal DOM
mutations, run layout effects, refs) → browser paints → passive effects
(`useEffect`) run.

**4. Does a re-render always update the DOM?**
No. If reconciliation finds identical output, React commits nothing. Re-render =
recompute JSX; commit = write the diff.

**5. Why does React need `key` on lists?**
To match "this item now" to "this item last render" by identity, so it can move
DOM nodes instead of recreating them and can keep each item's state attached to
the right item.

**6. Why is the array index a bad key?**
If the list reorders/inserts/deletes, indices stay `0,1,2…` while the data moved.
React then updates the wrong nodes and mismatches child state (a half-typed
input, an open menu) to the wrong row.

**7. How do you reset a component's state?**
Give it a different `key`. React unmounts the old instance and mounts a fresh one.

**8. What makes a component "pure"?**
Same props + state ⇒ same JSX, and no side effects during render (no fetch, no
DOM mutation, no mutating external variables).

**9. `{count && <List/>}` renders "0" when count is 0. Why, and the fix?**
`0` is falsy so `&&` returns `0`, and React renders the number `0`. Use
`count > 0 && <List/>`.

---

## State & events

**10. Why does `console.log(count)` right after `setCount(count+1)` show the old value?**
State is a snapshot — constant for the whole render. `setCount` schedules the
next render; it doesn't reassign the variable.

**11. `setCount(count+1)` twice vs `setCount(c => c+1)` twice?**
First: both read the same snapshot → net `+1`. Second: each updater gets the
latest pending value → net `+2`.

**12. What is batching?**
React groups multiple state updates in the same tick (events, and since React 18
also promises/timeouts) into a single re-render.

**13. Why must state be immutable?**
React compares references (`Object.is`) to decide whether to re-render and to let
`memo` bail out. Mutating in place keeps the reference, so updates are missed or
torn.

**14. How do you update one item in an array in state?**
`setItems(prev => prev.map(x => x.id === id ? { ...x, done: true } : x))` — new
array, new object only for the changed item.

**15. Controlled vs uncontrolled input?**
Controlled: `value` + `onChange`, React state is the source of truth.
Uncontrolled: DOM holds the value, read via `ref`/`defaultValue`. Controlled when
you need per-keystroke reactivity (validation, a char counter).

**16. When is something a `ref` instead of `state`?**
When the UI doesn't need to react to it: timers, a throttle timestamp, a
previous value, a DOM node handle. Changing a ref doesn't re-render.

**17. "Lifting state up" — what and when?**
Move state to the closest common ancestor of the components that need it, pass it
down as props plus callbacks up. Do it when two siblings must share state.

**18. Synthetic events?**
React's cross-browser wrapper around native DOM events. Same `preventDefault` /
`stopPropagation` API.

**19. Why `onClick={() => remove(id)}` and not `onClick={remove(id)}`?**
The second calls `remove` during render and passes its return value as the handler.

---

## Effects

**20. What is `useEffect` for?**
Synchronizing a component with an external system — subscriptions, timers,
browser APIs, non-React widgets. Not for deriving data.

**21. Explain the dependency array.**
It declares every reactive value the effect reads, so React re-runs the effect
(after cleanup) whenever one changes — keeping it from operating on stale values.
It's a correctness assertion, not a trigger list.

**22. What breaks if you omit a dependency?**
Stale closure: the effect keeps using the value from the render where it last
ran. E.g. a socket filter still matching the previously-open conversation.

**23. When does cleanup run?**
Before every re-execution of the effect, and on unmount. Every subscription/
timer/listener the effect creates must be torn down there.

**24. Why does my effect run twice on mount in dev?**
StrictMode intentionally does setup → cleanup → setup to surface missing cleanup.
Dev only. If cleanup is correct it's harmless.

**25. Give three cases where you should NOT use an effect.**
(a) Deriving state from props — compute during render. (b) Responding to a user
event — do it in the handler. (c) Fetching server data — use TanStack Query / an
RSC. Also: resetting state on prop change — use `key`.

**26. `useEffect` vs `useLayoutEffect`?**
`useEffect` fires after paint (default). `useLayoutEffect` fires after commit
before paint, blocking it — only for measuring layout and re-styling to avoid a
visible flicker.

**27. How do you handle a race condition in a fetching effect?**
A `let cancelled = false` flag, set to `true` in cleanup, checked before
`setState`. Or use a keyed query cache (TanStack Query) which does it for you.

**28. Effect vs event handler — the distinction?**
Handler: reacts to one user action ("sent a message"). Effect: keeps something
true for as long as the component is mounted / a condition holds ("subscribed
while this chat is open").

---

## Hooks

**29. The Rules of Hooks, and why?**
Call hooks only at the top level (no conditions/loops/early returns) and only
from React functions. React matches hooks to state by call order; a conditional
hook shifts every later hook to the wrong slot.

**30. `useMemo` vs `useCallback`?**
`useMemo` caches a computed value; `useCallback` caches a function.
`useCallback(fn, d)` is `useMemo(() => fn, d)`.

**31. When is `useCallback` actually worth it?**
Only when the function is an effect dependency, a prop to a `React.memo`'d child,
or part of a context value — i.e. when something compares its reference.

**32. `useRef` — two uses?**
(a) A handle to a DOM node (`ref={inputRef}`). (b) A mutable value that persists
across renders without causing one — timers, latest-value refs to dodge stale
closures.

**33. Custom hook — what does it share?**
Stateful *logic*, not state. Each call site gets its own independent state.
Must start with `use`.

**34. `useState` vs `useReducer`?**
Reducer when updates are interdependent or you find yourself calling several
setters together — it centralizes the transition logic and is easy to test.

**35. How do you avoid a stale value in a long-lived subscription without re-subscribing?**
Keep the value in a ref, sync it in a small effect (`useEffect(() => {
ref.current = value }, [value])`), read `ref.current` inside the subscription,
and leave `value` out of the subscription effect's deps. (`ChatProvider`'s
`activeCallIdRef`.)

---

## Context & state management

**36. What problem does Context solve, and what does it not?**
Solves prop drilling — get a value to deep descendants without threading props.
It does not optimize re-renders (every consumer re-renders on a new value) and
isn't a store.

**37. Why wrap a context's value in `useMemo`?**
A fresh object literal each provider render is a new reference, so every consumer
re-renders every time. `useMemo` + `useCallback` on the functions keeps the value
stable until the data changes.

**38. Server state vs client state?**
Server state = a cache of data owned elsewhere (needs refetch, dedupe,
invalidation) → TanStack Query. Client state = owned by the UI (toggles, current
user, open modal) → `useState`/context.

**39. When would you add Redux/Zustand?**
Interdependent client state with many writers, cross-cutting updates, devtools/
time-travel needs. Not for server data, not "just in case".

**40. How do you make "no provider mounted" a clear error?**
`createContext(null)` and have the `useX` hook throw if `useContext` returns
`null`.

---

## Data fetching

**41. Why TanStack Query over `useEffect` + `fetch`?**
It gives caching, request dedup, background refetch, retries, pagination, and
race-condition handling keyed by a query key — all the boilerplate you'd
otherwise hand-roll and get subtly wrong.

**42. `staleTime` vs `gcTime`?**
`staleTime`: how long data is fresh before a background refetch. `gcTime`: how
long an *unused* cache entry stays in memory before collection.

**43. `isLoading` vs `isFetching`?**
`isLoading`: first fetch, no data yet. `isFetching`: any fetch in flight,
including a background refetch while data is already displayed.

**44. Describe an optimistic update.**
Write the expected final state into the cache immediately, fire the request, then
on success reconcile with the server's response (e.g. swap a temp id for the real
one), on error roll back.

**45. Two async sources update the same item (HTTP response + WebSocket echo). How do you avoid duplicates?**
Dedupe by a stable server id; for your own optimistic item, match it (by
body/temp id) and adopt the server id rather than inserting a second copy.

**46. Offset vs keyset pagination?**
Offset (`page=N`/`skip`) shifts results when rows are inserted. Keyset
(`beforeSeq=…`, a stable cursor) is immune to inserts — used for the message
history here.

**47. When fetch on the server vs the client?**
Server (RSC/route handler): first-paint data, secrets, SEO. Client (Query):
data that changes after load, driven by interaction, needs cache management.

**48. Next.js caches `fetch` by default — what's the risk?**
A per-user response (like `/user`) could be served to another user. Opt out with
`cache: "no-store"`.

---

## Performance

**49. What triggers a re-render?**
Own `setState`, parent re-rendered, a consumed context's value changed, or `key`
changed (remount).

**50. When does `React.memo` do nothing?**
When the parent passes a fresh object/array/function literal each render (shallow
equality fails), or `children` is new JSX, or the component re-renders from its
own state/context anyway.

**51. First thing you do about a perf complaint?**
Profile with React DevTools — see which components rendered and why. Optimize the
measured hot path, not a guess.

**52. Cheapest perf win?**
Keep state as low as possible (colocate). A draft-text `useState` in a leaf
component means typing doesn't re-render its siblings.

**53. Rendering 10,000 rows is janky. Options?**
Virtualize (render only the visible window — `react-window`/`@tanstack/react-virtual`)
and/or paginate so the dataset never fully loads.

**54. Debounce vs throttle?**
Debounce: run once after activity stops (search-as-you-type). Throttle: at most
once per interval during activity (a "still typing" ping).

**55. `useTransition` — what's it for?**
Marking a state update as low-priority so an expensive resulting render doesn't
block urgent updates like keystrokes.

---

## Next.js / React 18+

**56. Server Component vs Client Component?**
Server: renders on the server, ships no JS, can `await` data, no hooks/state/
events. Client (`"use client"`): hydrates in the browser, can use hooks/state/
events/browser APIs. Default is Server.

**57. What does `"use client"` actually do?**
Marks a client entry point — that module and everything it imports become part
of the client bundle. Keep it at the leaves.

**58. Can a Client Component render a Server Component?**
Not by importing it. It can receive one as `children`/props (already rendered on
the server). That's how pages stay server-rendered inside client providers.

**59. What is hydration, and what's a hydration mismatch?**
Hydration = client React adopts the server HTML and attaches interactivity.
Mismatch = server HTML ≠ first client render (from `Date.now()`, `localStorage`,
`typeof window`…). Fix: render identically, adjust in `useEffect`.

**60. Why does the chat socket survive navigating between conversations?**
It's created in a `layout.tsx` provider, and layouts don't unmount when you
navigate between their child routes.

---

## Testing (React Testing Library)

**61. RTL's core philosophy?**
Test behavior the way a user experiences it — query by role/label/text, interact,
assert on visible output. Don't assert on state, props, or component internals.

**62. `getBy` vs `queryBy` vs `findBy`?**
`getBy` throws if not found (assert presence). `queryBy` returns `null` (assert
absence). `findBy` returns a promise, retries (assert something that appears
async).

**63. How do you test a custom hook like `useTyping`?**
`renderHook` from RTL, `act()` around updates, assert on the returned value.
Mock `useRealtime` (or wrap in a fake provider) so you control `subscribe`.

**64. How do you handle `fetch` in a component test?**
Mock it (MSW is the common choice — intercepts at the network layer), or inject a
fake. With TanStack Query, wrap the component in a `QueryClientProvider` with
retries off.

**65. Why `userEvent` over `fireEvent`?**
`userEvent` simulates a real interaction sequence (focus, keydown, keyup, input
events) — closer to what a user does; `fireEvent` dispatches one raw event.

---

## Components, structure & CSS

**66. What makes a component's props a good API?**
Minimal surface (only what callers vary), booleans named for the true state
(`isLoading`), sensible defaults, always accept `className`, and model the domain
(`status="online"`) not the styling (`dotColor="green"`).

**67. When do you split a component?**
When a chunk of JSX has its own name in your head, is reused, has its own state,
or the return statement no longer fits on screen. Not to hit a line count.

**68. Presentational vs container components?**
Presentational: props in, pixels out, no data fetching — reusable and easily
tested. Container: uses hooks/context/fetching, feature-specific. Keep containers
thin, push visuals into presentational components.

**69. Composition vs configuration — when do you switch?**
When a component sprouts many boolean/variant props, stop adding props and let
the caller pass `children` or named slots (`<Card><Card.Header>…`). `children` is
the primitive.

**70. What's a compound component?**
A parent plus named sub-components (`<Tabs><Tabs.Tab/>`) that share state via an
internal context — e.g. HeroUI's `Dropdown`, `Table`.

**71. Every component showing fetched data must handle which states?**
Loading, empty, error, and data. The empty state is the most commonly forgotten.

**72. How should a React project be structured?**
By feature, not by file type — everything for a feature in one folder. Add a
shared layer (`lib/`, `components/`) only for genuinely cross-cutting code.
Colocate code with its consumer; promote it up only when a second consumer
appears.

**73. In Next's App Router, how do you keep components inside `app/` without them becoming routes?**
Put them in a folder starting with `_` (a private folder), e.g. `_Components/`.
`(parens)` folders group routes under a shared layout without adding a URL
segment.

**74. `lib/` vs `components/`?**
`lib/` = logic, types, config, context providers (little or no JSX).
`components/` = reusable visual UI.

**75. Which styling approach for a new app, and why?**
CSS Modules or Tailwind — both are scoped and zero-runtime. Avoid runtime
CSS-in-JS (styled-components) in App Router apps: it needs a client boundary and
adds runtime cost.

**76. `className` vs inline `style`?**
`className` for everything static — it supports pseudo-classes, media queries,
and is cacheable. Inline `style` only for values computed at runtime (a dragged
element's `transform`, a progress bar's `width`); it can't do `:hover` and
allocates a new object each render.

**77. What's a design token and why bother?**
A named value (`--color-brand: #ff3b47`) referenced everywhere instead of a raw
hex. One place to change the palette, and it makes theming/dark-mode a
token-swap rather than a component-wide edit.

**78. How do you conditionally apply classes cleanly?**
`clsx`/`classnames` for on/off classes; `tailwind-variants` (or CVA) for
components with `size`/`color` variants. Fold the caller's `className` in last so
it can override.

**79. Class-based dark mode vs `prefers-color-scheme`?**
A `.dark` class on the root element gives a user-controlled toggle (via
`next-themes`); `@media (prefers-color-scheme)` just follows the OS. Use the
class strategy when you want a switch.

**80. How do you make layout responsive without a pile of media queries?**
Flexbox/grid + relative units, `min-w-0` so flex children can shrink (enabling
`truncate`), `overflow-y-auto` on scroll regions. Tailwind's `md:` prefixes are
mobile-first — base styles target the smallest screen, prefixes add upward.
