# 01 — JSX, components, and the render model

## JSX is `React.createElement` with nicer syntax

```tsx
<MessageComposer placeholder="Message" isDisabled={false} />
// compiles (roughly) to:
React.createElement(MessageComposer, { placeholder: "Message", isDisabled: false })
```

That call returns a **plain object** — a description of what you want on screen
(`{ type, props, key }`), *not* DOM. React reads that tree and decides what to
do with the real DOM. This is why:

- **You return one tree.** Multiple siblings need a wrapper or a `<>…</>` fragment.
- **`className`, not `class`**; `htmlFor`, not `for` — JSX attributes map to DOM properties.
- **`{}` embeds an expression**, not a statement. `{cond ? <A/> : <B/>}` works; `{if (cond) …}` doesn't.
- **Components must be Capitalized.** `<input>` → DOM element; `<Input>` → your component. Lowercase = string type = HTML tag.

---

## A component is a function: props in, JSX out

```tsx
interface MessageComposerProps {
  placeholder: string;
  isDisabled: boolean;
  onSend: (body: string) => void;
}

export function MessageComposer({ placeholder, isDisabled, onSend }: MessageComposerProps) {
  const [text, setText] = useState("");
  return <input value={text} placeholder={placeholder} disabled={isDisabled}
                onChange={e => setText(e.target.value)} />;
}
```

Rules that come up in interviews:

- **Props are read-only.** A component never mutates its own props. Data flows *down*.
- **Same props + same state ⇒ same output.** Rendering must be pure — no fetches, no `document.*`, no mutating outside variables *during render*. Side effects go in event handlers or effects.
- **`children` is just a prop.** `<Card>hi</Card>` passes `"hi"` as `props.children`. That's how `ChatProvider`, `RealtimeProvider` etc. wrap a subtree.

---

## Render → commit → (maybe) paint

| Phase | What happens | Cost |
|---|---|---|
| **Trigger** | Initial mount, or a `setState` (yours or an ancestor's) | — |
| **Render** | React calls your component functions, builds a new element tree, diffs it against the previous one (**reconciliation**) | CPU, pure, can be thrown away |
| **Commit** | React applies the *minimum* DOM mutations to match, runs `useLayoutEffect`, then refs | DOM writes |
| **Paint** | Browser repaints pixels; `useEffect` fires after this | — |

**Key consequence:** a re-render does **not** mean a DOM update. If your
component renders the same output, React reconciles and writes nothing. "Re-render"
is cheap-ish; "commit" is the expensive part. Optimization is mostly about
skipping *render*, not skipping *commit*.

---

## Reconciliation, and why `key` matters

When React diffs two trees at the same position:

- **Same type** (`<div>` → `<div>`, `<Foo>` → `<Foo>`): reuse the DOM node / component instance, update changed props. **State is preserved.**
- **Different type** (`<div>` → `<span>`, `<Foo>` → `<Bar>`): destroy the old subtree (unmount, lose state), build the new one.

For **lists**, position isn't enough — items reorder, insert, delete. `key`
gives each item a stable identity so React can match "this element now" to "this
element last time".

```tsx
// useConversations returns conversations already sorted by recency —
// the order changes every time a message lands.
{conversations.map(c => (
  <ChatListRow key={c.id} conversation={c} />   // ✅ c.id — stable identity
))}
```

```tsx
{conversations.map((c, i) => <ChatListRow key={i} … />)}  // ❌ index
```

With index keys: a new message bumps a conversation to the top, every row
shifts, React thinks row 0's *content* changed rather than that it *moved* —
so a half-typed reply in one row, `useState` inside a row, an open menu, all
attach to the wrong conversation. **Key = identity, not position.**

---

## Conditional rendering patterns

```tsx
{isLoading && <Spinner />}                    // render or nothing
{typingIds.length > 0 ? <TypingIndicator /> : null}
{error && <Alert>{error}</Alert>}

{/* trap: 0 is falsy but renders as "0" */}
{messages.length && <List />}   // ❌ renders literal 0 when empty
{messages.length > 0 && <List />}  // ✅
```

Switching between two component *types* at one position unmounts the first
(losing its state). If you want to keep state across a toggle, render both and
hide one with CSS, or hoist the state up.

---

## Fragments, `React.Fragment`, and keys on fragments

```tsx
return (
  <>
    <Header />
    <Body />
  </>
);

// need a key in a list? use the long form:
{rows.map(r => (
  <React.Fragment key={r.id}>
    <dt>{r.term}</dt>
    <dd>{r.def}</dd>
  </React.Fragment>
))}
```

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| element vs component | Component = the function. Element = the object it returns (`{type, props}`). `<Foo/>` is an element; `Foo` is a component. |
| render vs commit | Render = compute JSX + diff (pure, in memory). Commit = write the diff to the DOM. |
| re-render vs re-mount | Re-render = same instance, new props/state, state kept. Re-mount = instance destroyed and recreated, state lost (happens on type change or a changed `key`). |
| `key` vs `id` prop | `key` is a React hint for reconciliation — it's **not** readable as a prop. Pass `id` separately if the child needs it. |
| controlled vs uncontrolled | Controlled: React state is the source of truth (`value` + `onChange`). Uncontrolled: the DOM holds it, you read via a `ref` / `defaultValue`. |
| `props.children` vs a render prop | `children` is the nested JSX. A render prop is a *function* prop the component calls with data (`{rows => …}`). |

---

## 🧠 Hooks

- **JSX is data.** `<Foo/>` builds an object; nothing renders until React walks the tree.
- **Rendering must be pure.** No I/O, no DOM reads, no mutation during render — React may call your function twice (StrictMode) or bail out.
- **A re-render that produces identical output writes zero DOM.** Reconciliation is the point.
- **`key` is identity.** Index keys break the moment the list reorders — and this app's lists reorder constantly.
- **Changing a component's `key` is the deliberate way to reset its state** (e.g. remount a form when the edited entity changes).
