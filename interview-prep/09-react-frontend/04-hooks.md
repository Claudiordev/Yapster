# 04 — The hooks catalog + custom hooks

## The Rules of Hooks (and why they exist)

1. **Only call hooks at the top level** — never in a condition, loop, nested
   function, or after an early `return`.
2. **Only call hooks from React functions** — components or other hooks.

React tracks hooks **by call order**, not by name. First `useState` in this
component is slot 0, second is slot 1, etc. Put one behind an `if` and on the
render where it's skipped, every later hook reads the wrong slot — state
belonging to another hook.

```tsx
// ❌ hook order changes between renders
if (conversationId) {
  const { messages } = useMessages(conversationId, userId);
}

// ✅ always call it; let the hook handle the null
const { messages } = useMessages(conversationId, userId);  // enabled: conversationId !== null inside
```

`useMessages` and `useTyping` both take a nullable `conversationId` and guard
internally (`enabled:` on the query, `if (!conversationId) return` in effects) —
precisely so the caller never has to conditionally call them.

---

## `useState` — covered in `02`. 

Lazy init for expensive defaults: `useState(() => expensiveParse(raw))` — the
function runs once, not every render.

---

## `useRef` — a mutable box that doesn't re-render

Two uses:

**1. A handle to a DOM node.**
```tsx
const inputRef = useRef<HTMLInputElement>(null);
<input ref={inputRef} />
inputRef.current?.focus();
```

**2. Mutable value that persists across renders but must not trigger one.**
```tsx
// useTyping
const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
const lastSentAt = useRef(0);

const notifyTyping = useCallback(() => {
  const now = Date.now();
  if (now - lastSentAt.current < THROTTLE_MS) return;   // read
  lastSentAt.current = now;                              // write — no re-render
  send({ type: "TYPING", conversationId });
}, [conversationId, send]);
```

**The "ref to dodge stale closure / avoid resubscribe" pattern** — all over this codebase:

```tsx
// ChatProvider: the CALL_STARTED subscription needs the current activeCallId,
// but must NOT tear down & resubscribe every time a call starts/ends.
const activeCallIdRef = useRef(activeCallId);
useEffect(() => { activeCallIdRef.current = activeCallId; }, [activeCallId]);

useEffect(() => {
  const off = subscribe("CALL_STARTED", event => {
    if (activeCallIdRef.current === event.conversationId) return;  // reads latest
    setIncomingCallId(event.conversationId);
  });
  return off;
}, [subscribe, userId]);   // activeCallId deliberately NOT a dep
```

`useConversations` does the same with `conversationsRef` and `myUserIdRef` so its
`MESSAGE` subscription reads current data without re-subscribing per render.

**Rule:** state for things the UI shows; ref for things effects/handlers need to
*read* but shouldn't react to.

---

## `useMemo` — cache a computed value between renders

```tsx
// useMessages: flatten paginated pages → one sorted, de-duped array.
// Rebuilding this on every render (including unrelated re-renders) is wasteful.
const messages = useMemo(() => {
  const byId = new Map<string, ThreadMessage>();
  for (const page of data?.pages ?? []) {
    for (const m of page) byId.set(m.id, m);
  }
  return Array.from(byId.values()).sort((a, b) => a.seq - b.seq);
}, [data]);
```

Recomputes only when `data` changes. Two reasons to use it:
1. **Expensive computation** you don't want to repeat.
2. **Referential stability** — a downstream `useEffect`/`memo`/`useMemo` depends
   on this value and would churn if it were a new array/object each render.

Don't wrap cheap scalars (`const over = count > MAX`). The comparison + cache
costs more than the `>`.

---

## `useCallback` — `useMemo` for a function

```tsx
const loadMore = useCallback(() => { fetchNextPage(); }, [fetchNextPage]);
```

`useCallback(fn, deps)` ≡ `useMemo(() => fn, deps)`. It returns the **same
function reference** until a dep changes. Only matters when that function is:
- a dependency of an effect (`useTyping`'s `forget` is `useCallback`'d so the receive effect doesn't re-run every render),
- passed to a `React.memo`'d child as a prop,
- put into a context value.

Otherwise a fresh closure per render is free — don't `useCallback` reflexively.

---

## `useContext` — see `05`. 

`const ctx = useContext(ChatContext)` reads the nearest provider's value and
subscribes this component to it: **when the provider's value changes, every
consumer re-renders.**

---

## `useReducer` — state transitions as a function

When state updates are (a) complex, (b) interdependent, or (c) the "next state
from action + prev state" logic wants to be testable in isolation:

```tsx
type Action =
  | { type: "add"; msg: ThreadMessage }
  | { type: "reconcile"; tempId: string; saved: ChatMessageDto }
  | { type: "clearPending"; tempId: string };

function reducer(state: ThreadMessage[], action: Action): ThreadMessage[] {
  switch (action.type) {
    case "add": return [...state, action.msg];
    case "reconcile": return state.map(m => m.id === action.tempId ? { …m, id: action.saved.id } : m);
    case "clearPending": return state.map(m => m.id === action.tempId ? { …m, pending: false } : m);
  }
}

const [messages, dispatch] = useReducer(reducer, []);
dispatch({ type: "add", msg });
```

`useMessages` doesn't use `useReducer` because the "store" is actually the
TanStack Query cache — but the *shape* of its `setQueryData` updates (add /
reconcile / clearPending) is exactly a reducer's action set. Same idea, different
container.

`useState` vs `useReducer`: reach for the reducer when you catch yourself
calling several `setX` together, or when one event needs the previous value of
multiple pieces of state.

---

## Custom hooks — the main way to share *logic* in React

A custom hook is a function starting with `use` that calls other hooks. It shares
**stateful logic**, not state — each call site gets its own independent state.

This app is built almost entirely out of them:

| Hook | Owns | Subscribes to |
|---|---|---|
| `useRealtime()` | — (reads context) | — |
| `useMessages(convId, userId)` | `isSending`, the infinite query | `"MESSAGE"` |
| `useTyping(convId, userId)` | `typingIds`, timers, throttle stamp | `"TYPING"`, `"MESSAGE"` |
| `useConversations(userId)` | the list, `isLoading` | `"MESSAGE"`, `"USER_STATUS_EVENT"`, `"CALL_STATUS"` |
| `useAccount()` | — (reads context) | — |

Anatomy (`useTyping`, trimmed):

```tsx
export function useTyping(conversationId: string | null, myUserId: string | null) {
  const { subscribe, send } = useRealtime();
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const timers = useRef(new Map());
  const lastSentAt = useRef(0);

  useEffect(() => { /* subscribe, expire on timer, cleanup */ }, [conversationId, myUserId, subscribe, forget]);

  const notifyTyping = useCallback(() => { /* throttled send */ }, [conversationId, send]);

  return { typingIds, notifyTyping };   // a small, purpose-built API
}
```

Guidelines:
- Name it `use…` (lint + Rules of Hooks depend on the prefix).
- Return an object (named fields) once you have >2 values; a tuple for 1–2 like `useState`.
- It's not magic reuse — extract a hook when the *logic* (effect + state + cleanup) repeats or is worth naming, not just to move lines.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| `useMemo` vs `useCallback` | `useMemo` caches a *value*; `useCallback` caches a *function*. `useCallback(fn,d)` === `useMemo(()=>fn,d)`. |
| `useRef` vs `useState` | Both persist. Ref mutation is synchronous and silent (no re-render); state is async-ish and re-renders. |
| `useState` vs `useReducer` | Reducer centralizes transition logic and is better when updates are interdependent or you dispatch typed actions. |
| custom hook vs component | Hook returns data/handlers and renders nothing. Component returns JSX. Hooks can't be called from non-React code. |
| custom hook vs util function | A util is pure and callable anywhere. A hook calls hooks, so it obeys the Rules of Hooks and is tied to a component's lifecycle. |
| `useMemo` vs a module-level constant | If it doesn't depend on props/state, hoist it out of the component entirely — no hook needed. |

---

## 🧠 Hooks

- **Hooks are matched by call order.** No hooks in conditions, loops, or after an early return — ever.
- **Custom hooks share logic, not state.** Two components calling `useTyping` get two separate `typingIds`.
- **`useRef` is the escape hatch for "effects need to read this, but it shouldn't cause a re-subscribe"** — the `xRef` + sync-effect pattern is everywhere here.
- **`useCallback`/`useMemo` earn their keep only when something downstream compares references** (effect deps, `memo`, context value). Otherwise they're noise.
- **A pile of `setX` calls that always fire together is a `useReducer` asking to exist.**
