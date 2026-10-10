# CRAM — read this on the way to the interview

## The render model (say this precisely)

- **Render** = React calls your component function, gets JSX, diffs it against
  the previous tree (**reconciliation**). Pure, in memory, throwaway.
- **Commit** = React applies the *minimum* DOM changes to match. Then layout
  effects, then refs, then paint, then `useEffect`.
- A re-render that produces identical JSX **writes zero DOM**. Optimization =
  skipping *render*, not commit.
- Re-render triggers: own `setState`, parent re-rendered, consumed context value
  changed, `key` changed (→ remount, state lost).

## State

- **State is a snapshot** — constant within a render. `setX` schedules the next
  render; it doesn't mutate your variable.
- `setX(v)` twice = uses one snapshot = net one update. `setX(c => …)` twice =
  each gets the pending value = both apply.
- **Never mutate.** New reference every update: `[...a]`, `a.map`, `{...o}`.
  React compares by reference.
- **Not state if:** you can derive it during render (`const canSend = …`); the
  parent has it (lift up); the UI doesn't react to it (`ref`).

## Effects

- An effect **synchronizes with an external system** (socket, timer, listener).
  Nothing external? Not an effect.
- **Dep array = every reactive value the effect reads.** Missing dep → stale
  closure. Fix noisy deps with `useCallback`/`useMemo`, never by deleting them.
- **Every subscribe/timer/listener needs cleanup** — `return () => …`.
- **Don't use an effect to:** derive state (compute it), handle a click (do it in
  the handler), fetch server data (TanStack Query / RSC), reset state on prop
  change (use `key`).
- StrictMode runs effects setup→cleanup→setup in dev to catch missing cleanup.

## Hooks

- **Rules:** top level only, React functions only. Matched by call order.
- `useMemo` caches a value; `useCallback` caches a function. Worth it only when
  something compares the reference (effect dep, `memo`'d child, context value).
- `useRef` = mutable box, no re-render. DOM handle, or latest-value ref to avoid
  re-subscribing (`xRef` + sync effect + leave `x` out of deps).
- **Custom hook** shares stateful *logic*; each call site gets its own state.
- `useReducer` when updates are interdependent / you call several setters together.

## Context

- Fixes **prop drilling**. Not a store. Every consumer re-renders on a new value.
- **`useMemo` the provider value + `useCallback` its functions**, or it re-renders
  all consumers every time.
- Shape: `createContext(null)` + `<Provider value>` + `useX()` that throws if
  `null`.
- **Server state → TanStack Query. Client state → context/`useState`.** Different
  problems.

## Data fetching

- **Query key = cache identity.** Same key = shared cache + deduped fetch.
- **Stale-while-revalidate**: cached data instantly, background refetch, update
  on arrival.
- **Optimistic update**: write the final state now → request → reconcile on
  success (swap temp id → real id) / roll back on error.
- Two sources for one item (HTTP + socket): **dedupe by stable server id**.
- `isLoading` = no data yet; `isFetching` = any fetch in flight.
- Keyset pagination (stable cursor), not offset (shifts on insert).

## Performance

- **Profile first** (React DevTools — what rendered, why).
- Cheapest win: **keep state low** (colocate).
- `React.memo` needs **stable props** — pair it with `useCallback`/`useMemo` or skip it.
- Immutable update that replaces only the changed row → `memo` works for free.
- 10k rows → **virtualize / paginate**. Input-driven work → **debounce/throttle**.

## Next.js App Router

- **Everything is a Server Component until `"use client"`.** That's where hooks,
  state, effects, `onClick` turn on.
- `"use client"` is an **entry point** — its import graph is all client code.
- **Fetch on the server, pass data as props into a client provider**
  (`getAccount` → `AccountProvider`) — correct first paint, no loading flash.
- Client Component can't *import* a Server Component but can take one as
  `children`.
- `layout.tsx` doesn't unmount between child routes — long-lived state (sockets)
  lives there.
- **Hydration mismatch** = server HTML ≠ first client render. Non-deterministic
  stuff goes in `useEffect`.

## TypeScript

- `children: ReactNode`. Props as `interface`. Annotate `useState` only when the
  initial value hides the type (`null`, `[]`).
- **Discriminated union** tagged by `type` → `switch` narrows each branch;
  `Extract<Union, {type: T}>` gives the exact payload. Makes
  `subscribe("MESSAGE", e => …)` fully typed.
- `as const` for query keys / literal constants.
- `unknown` not `any` at data boundaries.

## Well-built components

- **Props are an API**: minimal surface, booleans named for the true state
  (`isLoading`), good defaults, always accept `className`, model the domain not
  the CSS (`status="online"`, not `dotColor`).
- **One component, one job.** Split when a chunk has a name / is reused / has its
  own state.
- **Every async component handles loading / empty / error / data** — empty is the
  one people forget.
- **Thin containers (hooks, data), dumb presentational components (props → pixels).**
- **Composition (`children`, slots) over a wall of boolean props.**
- **`onClick` on a `<div>` is a bug** — real `<button>`, plus `aria-label` /
  `aria-pressed` / `aria-busy` for state.

## Project structure

- **By feature, not by file type.** A feature = one folder you can read or delete
  whole.
- **Colocate, then promote**: code sits by its only consumer; moves up when a
  second appears.
- Next App Router: `_Components/` (underscore) = private folder, never a route;
  `(group)` = shared layout, no URL segment.
- `lib/` = logic/types/providers · `components/` = shared UI · `styles/` = tokens.
- Set up the `@/` path alias. Skip barrel files by default.

## CSS

- **Default to CSS Modules or Tailwind** — both scoped, both zero-runtime.
  Runtime CSS-in-JS fights Server Components.
- **Design tokens once** (`@theme` / `colors.css`); components use `bg-brand`,
  never raw hex.
- **`clsx`** for conditional classes, **`tailwind-variants`** for component
  variants. `className` prop folded in last so callers can override.
- **Inline `style={{}}` only for runtime-computed values** (transform, width).
- Layout with flex/grid + relative units + `min-w-0`/`truncate` beats media
  queries. Dark mode via a `.dark` root class when you want a user toggle.

---

## One-liners to land

- "A re-render isn't a DOM write — reconciliation decides that."
- "State is a snapshot; the updater function is how you escape it."
- "The dependency array isn't a trigger list, it's a correctness assertion."
- "Most effects that call `setState` shouldn't be effects."
- "`key` is identity, not position."
- "Server state and client state are different problems — Query for one, `useState` for the other."
- "`React.memo` does nothing if the parent hands it a fresh object every render."
- "`\"use client\"` is a boundary, not a file-level nuisance — everything below it ships to the browser."
