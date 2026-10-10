# 10 — Well-built components

What separates a junior component from a mid-level one isn't cleverness — it's
that the **props are a good API**, the component does **one job**, and it's
**accessible** without being asked.

---

## 1. Design the props like a public API

`StatusDot` from this repo — small, but every decision is deliberate:

```tsx
interface StatusDotProps {
  /** Absent or unknown renders as offline. */
  status?: UserStatus;
  /** Used for the accessible label, e.g. "Alice is online". */
  name?: string;
  className?: string;
}

export function StatusDot({ status, name, className = "" }: StatusDotProps) {
  const { dot, label } = STYLES[status ?? "offline"];
  return (
    <span
      aria-label={name ? `${name} is ${label}` : label}
      className={`block h-3 w-3 rounded-full ring-2 ring-content1 ${dot} ${className}`}
      role="img"
      title={label}
    />
  );
}
```

Rules it follows:

- **Minimal surface.** Three props. Not `color`, `size`, `showLabel`,
  `pulse`, … — just what a caller actually varies.
- **Sensible defaults.** `status` omitted ⇒ offline. `className` defaults to `""`
  so callers can skip it and template literals don't print `undefined`.
- **Accept `className`** (or a `classNames` map for multi-part components) so the
  parent can nudge layout — margins, positioning — without new props.
- **Document the non-obvious props** with a one-line JSDoc — it shows in editor
  tooltips.
- **Model the domain, not the styling.** The prop is `status: "online" | "busy"`,
  not `dotColor: string`. The color lookup is an implementation detail (`STYLES`).

### Booleans: name them for the true state

`isLoading`, `isDisabled`, `isActive`, `hasError` — a reader should know what
`true` means without checking. Avoid `hidden={false}` double-negatives.

### Don't take a prop you can derive

`<Message text={m.body} isMine={m.senderId === myId} />` — fine. But
`<Message message={m} isMine={...} count={...} formatted={...} />` where three of
those come from `m` — just pass `m` and derive inside.

---

## 2. One component, one job

`ChatList` (this repo) is really **three** components in one file, each with a
single responsibility:

```tsx
function ChatListSkeleton() { … }   // loading placeholder — pure presentation
function timeLabel(iso) { … }        // a formatting helper, not even a component
export function ChatList({ … }) {    // orchestration: loading? empty? map rows
  return (
    <aside>
      {isLoading      ? <ChatListSkeleton />
      : conversations.length === 0 ? <EmptyState />
      : conversations.map(c => <ChatListRow key={c.id} … />)}
    </aside>
  );
}
```

**Split when:** a chunk of JSX has its own name in your head ("the skeleton",
"the row"), it's reused, it has its own state, or the parent's return statement
no longer fits on a screen. **Don't split** a 5-line component into 4 files for
the sake of it.

### The three-state rule for anything async

Every component that shows fetched data handles **loading / empty / error /
data** explicitly. `ChatList` shows a skeleton, an "No conversations yet"
message, or the rows. Forgetting the empty state is the most common review
comment.

---

## 3. Presentational vs container (a useful lens, not a law)

| | Presentational | Container / "smart" |
|---|---|---|
| Cares about | how things look | how things work |
| Data source | props only | hooks, context, fetching |
| Reusable? | very | tied to a feature |
| Example here | `StatusDot`, `ChatListSkeleton`, `MessageComposer` | `ConversationView`, anything calling `useChat()` |

`MessageComposer` is a good middle case: it owns *local* draft state (`useState`)
but takes `onSend`/`onType` as props — it doesn't know *what* sending a message
does. The container (`ConversationView`) wires `onSend` to `useMessages`.

The modern take: don't force every component into one bucket, but **keep the
data-fetching / business-logic components thin and push the pixels into dumb
components you can test with just props**.

---

## 4. Composition over configuration

When a component grows a pile of boolean/render props, reach for **composition**:
let the caller pass JSX instead of flags.

```tsx
// configuration — every variation is a new prop
<Card title="Hi" subtitle="…" icon={<X/>} footerButton="Save" showClose … />

// composition — the caller assembles it
<Card>
  <Card.Header><X/> Hi</Card.Header>
  <Card.Body>…</Card.Body>
  <Card.Footer><Button>Save</Button></Card.Footer>
</Card>
```

`children` is the primitive. `ChatProvider`, `RealtimeProvider`, `ChatShell` all
take `children` and wrap it — they compose, they don't configure.

**Compound components** (the `Card.Header` style) share state via context between
a parent and its named sub-components — how HeroUI's `<Dropdown>` / `<Table>`
work. You consume these constantly; you'll build one occasionally.

**Slots**: a component takes named JSX props — `<Modal header={…} body={…}
footer={…}/>`. `IncomingCallModal` is close to this shape.

---

## 5. Accessibility is part of "well-built"

From `ChatList` / `StatusDot`, none of it optional:

- **Semantic elements**: `<aside>`, `<button type="button">`, `<p>` — not
  `<div onClick>`. A real `<button>` gets keyboard, focus, and role for free.
- **`aria-label`** where the visible content isn't descriptive: the icon-only
  "New chat" button, the unread count badge.
- **`aria-pressed` / `aria-busy`** to expose state: which row is active, whether
  the list is loading.
- **`role="img"` + label** on the purely-decorative-but-meaningful status dot.
- Every `<input>` has a label (or `aria-label`).

Rule of thumb: if you're adding `onClick` to a non-button, stop and use a button.

---

## 6. Keep side effects at the edges

A component body computes JSX. Anything else:

- **User-triggered** (POST, navigate, toast) → the event handler.
- **Synchronize-while-mounted** (subscribe, timer) → `useEffect` with cleanup.
- **Derive from props/state** → just compute it in the body (memoize if costly).

`ChatList` computes `isActive`, `isGroup`, `unread`, `preview` inline per row —
no state, no effects, just derivation. That's the target.

---

## 7. Error boundaries

A thrown error during render unmounts the whole tree unless a **class**
`componentDidCatch` / `static getDerivedStateFromError` boundary (or
`react-error-boundary`) catches it. Wrap feature areas so one broken panel shows
a fallback instead of blanking the app. In Next App Router, `error.tsx` per route
segment is this.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| presentational vs container | Presentational: props → pixels, reusable. Container: hooks/data/logic, feature-bound. Keep containers thin. |
| configuration vs composition | Configuration: many props toggle variants. Composition: caller passes `children`/slots. Prefer composition as variants multiply. |
| compound component vs render prop | Compound: named sub-components (`Tabs.Tab`) sharing context. Render prop: a function child the component calls with data. |
| controlled vs uncontrolled component | Controlled: parent owns the value via props. Uncontrolled: component owns it internally (`MessageComposer`'s draft). |
| `children` vs a named JSX prop (slot) | `children` = the one main nested area. Slots = multiple labelled areas (`header`, `footer`). |
| splitting for reuse vs for readability | Reuse: extract when a second caller appears. Readability: extract when the return statement stops fitting on screen or a chunk has a name. |

---

## 🧠 Hooks

- **Props are an API.** Minimal, well-named booleans, good defaults, always accept `className`, model the domain not the CSS.
- **One component, one job.** Split when a chunk has a name, is reused, or has its own state.
- **Every async component handles loading / empty / error / data** — the empty state is the one people forget.
- **Keep data/logic components thin; push pixels into prop-only components** you can test trivially.
- **`children` and slots beat a wall of boolean props** once variants multiply.
- **`onClick` on a `<div>` is a bug** — use a `<button>`; a11y (roles, labels, state) is part of the job.
