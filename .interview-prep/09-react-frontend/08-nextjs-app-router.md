# 08 — Next.js App Router (what a React dev must know)

Mid-level React interviews increasingly assume a framework. This app is
**Next.js 15, App Router**. The React concepts that matter:

---

## Server Components vs Client Components

In the `app/` directory, **every component is a Server Component by default.**
It renders on the server, ships zero JS for itself, and can `await` data
directly.

```tsx
// app/(protected)/sms/layout.tsx — a Server Component
import { ChatProvider } from "./_Components/ChatProvider";
import { ChatShell } from "./_Components/ChatShell";

export default function SmsLayout({ children }: { children: React.ReactNode }) {
  return <ChatProvider><ChatShell>{children}</ChatShell></ChatProvider>;
}
```

A **Client Component** opts in with `"use client"` at the top of the file. It
hydrates in the browser and is the only place you can use:

- `useState`, `useEffect`, `useRef`, `useReducer`, `useContext`, custom hooks
- event handlers (`onClick`, `onChange`)
- browser APIs (`window`, `localStorage`, `WebSocket`)
- Context providers/consumers

Every stateful file in this app starts with `"use client"`: `useRealtime.tsx`,
`use-account.tsx`, `ChatProvider.tsx`, `useMessages.ts`, `MessageComposer.tsx`, …

| | Server Component | Client Component (`"use client"`) |
|---|---|---|
| Runs | on the server (build/request) | server (SSR pass) **then** browser (hydration) |
| Hooks/state/effects | ❌ | ✅ |
| Event handlers | ❌ | ✅ |
| `async`/`await` in the body | ✅ | ❌ (use a hook / Query) |
| Direct DB / secret access | ✅ | ❌ ships to the browser |
| Bundle cost | 0 | its code + deps |

**The boundary rule:** `"use client"` marks an *entry point*. Everything it
imports becomes client code too. A Server Component can render a Client
Component, but not vice-versa — a Client Component can only receive Server
Components as `children`/props (already-rendered), not import them.

**Pattern used here:** keep pages/layouts as Server Components, do the server
data fetch there (`getAccount()`), and pass the result as props into a
`"use client"` provider that owns the interactivity.

---

## The composition trick: Server Components as `children`

```tsx
// (protected)/layout.tsx  (server)
const account = await getAccount();
return (
  <AccountProvider initialUsername={account?.username ?? null} …>
    <RealtimeProvider>
      {children}      {/* server-rendered pages pass THROUGH the client providers */}
    </RealtimeProvider>
  </AccountProvider>
);
```

`AccountProvider` is a Client Component, but `{children}` (the actual pages)
stay server-rendered — they're passed in, not imported. This is how you get
client-side context without turning your whole page tree into client code.

---

## Hydration

SSR sends HTML (fast first paint, non-interactive). Then the JS loads and React
**hydrates** — attaches event listeners and takes over the existing DOM.

**Hydration mismatch** = the server HTML and the first client render differ.
Causes: `Date.now()`, `Math.random()`, `typeof window` branches, `localStorage`
reads, locale-dependent formatting — anything that isn't identical on both sides.
React throws a warning and re-renders. Fix: render the same thing on both, then
adjust in a `useEffect` (which only runs on the client).

`resolveWsBase()` in `useRealtime` guards this: `if (typeof window === "undefined")
return null` — the server pass gets `null` (status `"disabled"`), the socket only
opens client-side inside the effect.

---

## Routing: file-system based

```
app/(protected)/sms/page.tsx                 → /sms
app/(protected)/sms/[conversationId]/page.tsx → /sms/:conversationId   (dynamic)
app/(protected)/sms/layout.tsx               → wraps both, persists across nav
app/(auth)/ , app/(protected)/               → route groups: () = not in the URL, just for layout grouping
app/api/chat/[conversationId]/route.ts       → an API endpoint (the BFF)
```

- **`layout.tsx`** wraps its segment and **does not unmount** when you navigate
  between child routes — which is why `ChatProvider`'s socket and conversation
  list survive moving between conversations.
- **`page.tsx`** is the route's leaf UI.
- **`loading.tsx`** / **`error.tsx`** — automatic Suspense / error boundaries per segment.
- Navigation: `<Link href>` or `useRouter()` (`router.push`, `router.refresh`).
  `ChatProvider` uses `router.push(\`/sms/\${id}\`)` after creating a conversation.

---

## Route handlers — the BFF

`app/api/**/route.ts` files export `GET`, `POST`, etc. They run **only on the
server**. This app's browser code never calls Spring directly — it calls these:

```tsx
// the browser does:
await fetch(`/api/chat/${conversationId}/message`, { method: "POST", body });
// the route handler attaches the auth cookie and proxies to the chat service
```

Why: the JWT lives in an **httpOnly cookie** the browser JS can't read; the
handler can. It's also where you'd add rate limiting, response shaping, and
schema validation.

---

## Middleware

`middleware.ts` runs **before** every matched request (Edge runtime). Here it
validates the JWT and renews it if near expiry, redirecting to `/login` if
absent. By the time a page's Server Component runs, auth is already settled —
`getAccount()` just reads the (now-valid) cookie and notes it *cannot* refresh
(Server Components can't set cookies; middleware already did).

---

## Streaming & Suspense

A Server Component can `<Suspense fallback={…}>` around a slow async child; Next
streams the shell immediately and flushes the child's HTML when it resolves.
`loading.tsx` is sugar for wrapping the whole page segment this way.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| Server Component vs SSR | SSR = render a *client* component to HTML on the server, then hydrate. RSC = a component that runs *only* on the server and ships no JS. App Router does both. |
| `"use client"` vs `"use server"` | `"use client"` marks a client entry point. `"use server"` marks a Server Action (server function callable from the client) — different thing. |
| layout vs page vs template | Layout persists across child navigations (state kept). Page is the leaf. Template re-mounts on every navigation. |
| route handler vs Server Action | Handler = an HTTP endpoint (`fetch` it). Action = an RPC-style server function you call directly and Next wires up. |
| middleware vs layout auth check | Middleware runs at the edge before rendering, can redirect cheaply. A layout check runs after some rendering already happened. |
| hydration vs render | Render = produce DOM. Hydration = adopt server-rendered DOM and attach interactivity. |
| `router.push` vs `router.refresh` | `push` navigates (client-side). `refresh` re-fetches the current route's Server Components without losing client state. |

---

## 🧠 Hooks

- **Everything is a Server Component until `"use client"`.** That directive is where hooks, state, effects, and `onClick` turn on.
- **`"use client"` is an entry point** — its whole import graph becomes client code. Keep it at the leaves.
- **Fetch on the server, pass data as props into a client provider** (`getAccount` → `AccountProvider`) — no loading flash, no client round-trip.
- **A Client Component can't import a Server Component, but can receive one as `children`.** That's how pages stay server-rendered inside client providers.
- **`layout.tsx` doesn't unmount between child routes** — long-lived things (sockets, lists) live there.
- **Hydration mismatch = server HTML ≠ first client render.** Anything non-deterministic goes in a `useEffect`.
