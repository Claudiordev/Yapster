# 06 — Data fetching (TanStack Query + RSC)

## Why not `useEffect` + `fetch`?

The naive version has to hand-roll: loading/error state, caching, dedup (two
components mounting the same request), refetch on focus/reconnect, pagination,
**and** the race-condition guard from `03`. TanStack Query does all of that,
keyed by a **query key**.

This app uses Query for HTTP-fetched server data and writes **live socket
events into the same cache**, so the UI reads one source of truth.

---

## The three pillars: key, `queryFn`, cache

```tsx
const messagesKey = (conversationId: string | null, myUserId: string | null) =>
  ["messages", conversationId, myUserId] as const;

useInfiniteQuery({
  queryKey: messagesKey(conversationId, myUserId),
  enabled: conversationId !== null,     // don't run until we have an id
  queryFn: async ({ pageParam }) => { /* fetch a page */ },
  initialPageParam: undefined,
  getNextPageParam: lastPage =>
    lastPage.length === PAGE_SIZE ? Math.min(...lastPage.map(m => m.seq)) : undefined,
});
```

- **Query key** = the cache identity. Same key across components → one shared
  cache entry, one request. Change any part of the key → a different entry
  (switching conversations loads that conversation's cache, instantly if warm).
- **`queryFn`** = how to get the data. Throws on failure → `isError`.
- **`enabled`** = gate. `useMessages`/`useTyping` take nullable ids and set
  `enabled: conversationId !== null` so the hook is always *called* (Rules of
  Hooks) but the query only *runs* when it makes sense.

---

## Stale-while-revalidate

Query serves **cached data immediately** (even if "stale"), then refetches in the
background and updates when fresh data lands. Re-opening a conversation shows the
old thread with no spinner, then reconciles. Knobs:

| Option | Meaning |
|---|---|
| `staleTime` | how long data is considered fresh (no background refetch). Default `0`. |
| `gcTime` (was `cacheTime`) | how long an unused cache entry survives before garbage collection. Default 5 min. |
| `refetchOnWindowFocus` | refetch when the tab regains focus. Default `true`. |

`useConversations` implements the same idea by hand for its non-Query list: only
the **first** load sets `isLoading` true; background refreshes (triggered by an
unknown incoming message) must not flash the skeleton.

---

## Optimistic updates — the headline pattern

`useMessages.sendMessage`, step by step:

```tsx
// 1. write an optimistic bubble into the cache with a temp id
const tempId = randomId();
queryClient.setQueryData(key, old => insert(old, { id: tempId, body, pending: true, seq: PENDING_SEQ }));

// 2. POST
const res = await fetch(`/api/chat/${conversationId}/message`, { method: "POST", body: … });

// 3a. success → swap temp id for the server's real id + seq
if (res.ok) {
  const saved = await res.json();
  queryClient.setQueryData(key, old => remap(old, tempId, { id: saved.id, seq: saved.seq, pending: false }));
}
// 3b. failure → clear the pending flag (bubble stays, shown as not-sent)
else queryClient.setQueryData(key, clearPending);
```

`PENDING_SEQ = Number.MAX_SAFE_INTEGER` makes the optimistic message sort as
newest and never become the paging cursor (which is the *oldest* loaded `seq`).

### The twist: the socket echo

The same message also arrives on the WebSocket. The `"MESSAGE"` subscription must
not draw a second bubble:

```tsx
subscribe("MESSAGE", event => {
  if (event.roomId !== conversationId) return;

  queryClient.setQueryData(key, old => {
    // already have this server id → dedupe echo/redelivery
    if (hasId(old, event.id)) return old;

    // my own message, echoed back before the POST resolved →
    // find the pending bubble with the same body, adopt the server id/seq
    if (event.senderId === myUserId) {
      const hit = findPending(old, event.body);
      if (hit) return adopt(old, hit, event);
    }

    // someone else's message → just prepend it
    return prepend(old, toMessage(event));
  });
});
```

Two async paths (HTTP response, socket frame) racing to update one bubble —
**dedupe by server id**, and reconcile "my pending send" by matching body.

---

## Invalidation vs manual cache writes

| Approach | When | Example here |
|---|---|---|
| `queryClient.invalidateQueries({ queryKey })` | after a mutation, when you want the server's authoritative version and a refetch is cheap | (would fit `startConversation` if the list were a query) |
| `queryClient.setQueryData(key, updater)` | you already know the new state and want it instantly (optimistic UI, live events) | every `useMessages` update |

`useMutation` wraps the write and gives you `onMutate` (optimistic),
`onError` (rollback), `onSettled` (invalidate). `useMessages` rolls its own
because the socket-echo reconciliation doesn't fit the standard `useMutation`
lifecycle.

---

## Infinite / keyset pagination

`useInfiniteQuery` stores `data.pages: Page[]` and `data.pageParams`.
`getNextPageParam(lastPage)` returns the cursor for the next page or `undefined`
(no more). Here the cursor is `beforeSeq` = the min `seq` of the last page —
**keyset pagination**, not offset, so new messages arriving don't shift a
page window. The hook flattens + de-dupes + sorts pages with `useMemo`:

```tsx
const messages = useMemo(() => {
  const byId = new Map<string, ThreadMessage>();
  for (const page of data?.pages ?? []) for (const m of page) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => a.seq - b.seq);
}, [data]);
```

---

## The other way: fetch on the server (RSC)

App Router Server Components can `await` directly — no Query, no effect, no
loading state on the client:

```tsx
// lib/get-account.ts — runs on the server only
export async function getAccount(): Promise<Account | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const res = await fetch(`${API_BASE_URL}/user`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",              // per-user, never cache
  });
  return res.ok ? shape(await res.json()) : null;
}
```

**When to use which:**

| Use the server (RSC / route handler) | Use TanStack Query (client) |
|---|---|
| data needed for first paint (the user, the initial page of a list) | data that changes after load and needs refetch/dedupe/optimism |
| secrets involved (API keys, raw tokens) | interactive, per-interaction data |
| SEO-relevant content | anything driven by client state (search-as-you-type, filters) |

This app does both: `getAccount()` seeds the context on the server; `useMessages`
runs the live thread on the client. The BFF route handlers (`app/api/**`) are the
server layer that attaches the cookie and proxies to Spring.

---

## `fetch` caching in Next.js (gotcha)

Next extends `fetch`. By default in the App Router, `fetch` responses can be
**cached and deduped**. For per-user or always-fresh data you must opt out:
`{ cache: "no-store" }` or `{ next: { revalidate: 0 } }`. `getAccount` uses
`no-store` — a cached `/user` would leak one user's data to another.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| `staleTime` vs `gcTime` | `staleTime`: how long before a background refetch. `gcTime`: how long an *unused* entry stays in memory. |
| `invalidateQueries` vs `setQueryData` | Invalidate = mark stale, trigger refetch (server is truth). setQueryData = write the value you already know (instant, optimistic). |
| `isLoading` vs `isFetching` | `isLoading`: first load, no data yet. `isFetching`: any fetch in flight, including background refetch with data already shown. |
| query key change vs `refetch()` | Changing the key switches to a *different* cache entry. `refetch()` re-runs the *same* one. |
| optimistic update vs pending UI | Optimistic: show the final state now, reconcile later. Pending: show a spinner/disabled state until the response. |
| offset vs keyset pagination | Offset (`page=3`) shifts when rows are inserted. Keyset (`beforeSeq=…`) is stable against inserts — used here. |
| RSC fetch vs client fetch | RSC: on the server, at render, no client JS, no loading state. Client: after hydration, interactive, cache-managed. |

---

## 🧠 Hooks

- **The query key is the cache identity.** Same key = shared cache + deduped request; change the key = different entry.
- **Stale-while-revalidate**: cached data now, fresh data when it arrives. Re-opening a thread is instant.
- **Optimistic update = write the result into the cache before the server confirms, reconcile on response, roll back on error.**
- **When the same data arrives twice (HTTP + socket), dedupe by a stable server id.**
- **Server state belongs in a query cache, not in Context/`useState`.**
- **Next.js caches `fetch` by default** — per-user requests need `cache: "no-store"`.
