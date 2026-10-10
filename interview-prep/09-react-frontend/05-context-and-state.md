# 05 — Context and state management

## The problem context solves

Passing a prop through five components that don't use it, just to reach the sixth,
is **prop drilling**. Context lets a provider publish a value and any descendant
read it directly with `useContext`, skipping the middle.

Context is for **low-frequency, widely-read** data: the current user, theme,
locale, a socket handle, the conversation list. It is *not* a general state
manager and not built for values that change many times a second.

---

## The provider pattern, as built in this repo

Every context here follows the same four-part shape. `useRealtime` is the
cleanest example:

```tsx
// 1. the context object — null default forces "must be inside a provider"
const RealtimeContext = createContext<Realtime | null>(null);

// 2. the provider component — owns the state, exposes a stable API
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const handlers = useRef(new Map());
  const socketRef = useRef<ReconnectingWebSocket | null>(null);

  const subscribe = useCallback(<T,>(type: T, handler) => { /* … */ }, []);
  const send      = useCallback((event) => { /* … */ }, []);

  useEffect(() => { /* open socket, dispatch messages, close on unmount */ }, []);

  return (
    <RealtimeContext.Provider value={{ status, subscribe, send }}>
      {children}
    </RealtimeContext.Provider>
  );
}

// 3. the consumer hook — one place that throws the "outside provider" error
export function useRealtime(): Realtime {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within a RealtimeProvider");
  return ctx;
}
```

```tsx
// 4. mounted once, high in the tree — here, the protected layout
<AccountProvider …>
  <RealtimeProvider>
    <ChatProvider>{children}</ChatProvider>
  </RealtimeProvider>
</AccountProvider>
```

Consumers just call `const { subscribe } = useRealtime()` — they never touch
`useContext` or the context object directly, and they get a clear error if
they're mounted outside the provider.

---

## Context re-renders every consumer when the value changes

`useContext(C)` subscribes the component to `C`. When the provider re-renders
with a **new `value` reference**, *every* consumer re-renders — React does not
diff the fields.

### Trap: a fresh object literal every render

```tsx
// ❌ new object identity every provider render → every consumer re-renders always
return <Ctx.Provider value={{ conversations, markRead, startConversation }}>…</Ctx.Provider>;
```

### Fix: `useMemo` the value, `useCallback` the functions

`ChatProvider` does exactly this:

```tsx
const value = useMemo<ChatContextValue>(
  () => ({
    conversations, isLoading, markRead,
    startConversation, createGroup, addMember, removeMember, deleteGroup,
    setActiveCall,
    account: { userId, username, avatarUrl, roles },
  }),
  [conversations, isLoading, markRead, startConversation, createGroup,
   addMember, removeMember, deleteGroup, setActiveCall,
   userId, username, avatarUrl, roles],
);

return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
```

and each of `startConversation`, `createGroup`, … is a `useCallback`, so the memo
only produces a new value when the *data* (`conversations`, `userId`, …) actually
changes — not on every keystroke somewhere in the tree.

### Splitting contexts

If part of a context changes often and part rarely, split them so a fast-changing
slice doesn't re-render consumers that only read the slow one. A common split:
`StateContext` (the data) and `DispatchContext` (the setters — stable forever).
This app keeps contexts small instead (`useRealtime` = socket, `useAccount` =
user, `useChat` = conversations) which achieves the same separation.

---

## Server-seeded context (the pattern worth explaining)

`AccountProvider` doesn't fetch on mount. The **server** runs `getAccount()`
(reads the cookie, calls `/user`), and the page passes the result in as props:

```tsx
// server component
const account = await getAccount();
<AccountProvider
  initialUserId={account?.userId ?? null}
  initialUsername={account?.username ?? null}
  initialBalance={account?.balance ?? null}
  … >

// client provider
const [username, setUsername] = useState<string | null>(initialUsername);
// first paint already has the real name — no spinner, no client request
const needsClientFetch = !initialUsername;
useEffect(() => { if (needsClientFetch) refresh(); }, [needsClientFetch, refresh]);
```

The effect is a **fallback** for the rare case the server couldn't seed it.
Normal path: zero client fetches for the user's identity.

---

## When context is *not* the answer

| Situation | Better tool |
|---|---|
| Server data (lists, entities) that needs caching, refetch, dedupe, pagination | **TanStack Query** — see `06`. It *is* the state manager for server state. |
| Value changes many times per second (mouse position, scroll, animation) | keep it local, or a ref + subscription; context would re-render the subtree constantly |
| Deeply interdependent client state, time-travel, middleware, many writers | a store: Zustand / Redux Toolkit. This app doesn't need one. |
| Just two components, one common parent | lift state up — no context |

**The mid-level talking point:** "server state" and "client state" are different
problems. Context + `useState` is fine for client state (UI toggles, the current
user, which modal is open). Server state wants a cache with invalidation — that's
Query's job, and mixing the two into one Context reducer is the usual mistake.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| context vs prop drilling | Context is the fix; drilling is the symptom. Don't reach for context until drilling actually hurts. |
| context vs a state library | Context is a *transport* (get a value down the tree). Redux/Zustand add a store, selectors, and re-render optimization. Context alone re-renders all consumers. |
| `createContext` default value vs provider value | The default is used only when there's **no** provider above. Passing `null` + throwing in the hook turns "no provider" into a loud error. |
| server state vs client state | Server state is a cache of someone else's data (stale-able, refetchable). Client state is owned by the UI. Different tools. |
| one big context vs many small | Many small = a fast-changing slice re-renders fewer consumers. This repo picks many small. |

---

## 🧠 Hooks

- **Context = createContext + Provider + a `useX` hook that throws if there's no provider.** Follow the four-part shape.
- **A new `value` reference re-renders every consumer.** `useMemo` the value, `useCallback` its functions — or split the context.
- **Seed context on the server when you can** (`AccountProvider`) — first paint is correct, no loading flash.
- **Server state ≠ client state.** Lists/entities → TanStack Query. Toggles/identity/theme → context + `useState`.
- **Reach for Redux/Zustand only when interdependent client state with many writers actually shows up.** This app never needed one.
