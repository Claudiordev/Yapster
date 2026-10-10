# 00 — React fundamentals (start here)

## What React actually is

A library for building UIs out of **components** — functions that take data and
return a description of what should be on screen. You never write "put this div
here, now update its text"; you write "given this state, the UI looks like
this", and React figures out the DOM changes.

Three ideas, and everything else follows from them:

1. **UI is a function of state.** `UI = f(state)`. Change the state, React
   re-runs `f`, and reconciles the difference onto the DOM.
2. **Data flows down.** A parent passes data to children as **props**. Children
   can't reach up and change a parent.
3. **Events flow up.** A child signals "something happened" by calling a function
   its parent passed down. The parent owns the state and decides what to do.

```tsx
function Parent() {
  const [count, setCount] = useState(0);          // state lives here
  return <Child count={count} onBump={() => setCount(c => c + 1)} />;
}                              //  └ data down        └ event up

function Child({ count, onBump }: { count: number; onBump: () => void }) {
  return <button onClick={onBump}>Clicked {count} times</button>;
}
```

---

## Components

```tsx
// A component is a function. Name is Capitalized. Returns JSX.
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}

// Use it like a tag:
<Greeting name="Ada" />
```

- **Props in, JSX out.** Same inputs ⇒ same output. No surprises.
- **Props are read-only.** Never assign to a prop. If you need to change it, it
  belongs in state somewhere (usually the parent).
- **`children`** is the prop for nested content: `<Card>anything here</Card>` →
  `props.children`.
- Split a component when it does two unrelated jobs, gets hard to name, or a
  piece of it needs to be reused. Not before.

---

## Props vs state — the distinction to be crystal on

| | Props | State |
|---|---|---|
| Owned by | the parent | the component itself |
| Mutable? | no (read-only) | yes, via the setter |
| Causes re-render | when the parent passes new ones | when you call `setX` |
| Analogy | function arguments | a variable that survives between calls |

If two components need the same value, it's **state in their closest common
parent**, passed to both as **props**. That's "lifting state up".

---

## JSX in 60 seconds

```tsx
const el = (
  <div className="row" onClick={handleClick}>   {/* className, not class */}
    {name ? <span>{name}</span> : <em>anon</em>} {/* expressions in braces */}
    {items.map(i => <li key={i.id}>{i.label}</li>)} {/* lists need a key */}
    {isLoading && <Spinner />}                   {/* conditional render */}
  </div>
);
```

- One returned parent (wrap siblings in `<>…</>`).
- `{}` holds a JS **expression**, not statements (no `if`, no `for` — use `?:`,
  `&&`, `.map`).
- `key` on list items must be a **stable id**, never the array index.
- Event props are camelCase: `onClick`, `onChange`, `onSubmit`.

---

## Hooks — the ones you'll actually use, by frequency

A **hook** is a function starting with `use` that lets a component "hook into"
React features (state, lifecycle, context). Call them at the **top level** of
the component — never in an `if`, loop, or after a `return`.

### `useState` — remember a value between renders  *(you'll use this constantly)*

```tsx
const [text, setText] = useState("");        // [current value, setter]
setText("hi");                                // schedules a re-render
setText(t => t + "!");                        // updater form — use when the new value depends on the old
```

The value is a **snapshot**: constant for this render. `setText` doesn't change
`text` now — it tells React what `text` will be on the next render.

### `useEffect` — run code *after* render to sync with the outside world  *(common, often overused)*

```tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);   // cleanup: runs on unmount / before re-run
}, []);                             // deps: [] = once on mount
```

For subscriptions, timers, event listeners, non-React libraries. **Not** for
computing values from props (just compute them) or handling clicks (do it in the
handler). See `03`.

### `useContext` — read a value from a provider above, skip prop-drilling  *(common in real apps)*

```tsx
const { username } = useAccount();   // useAccount() wraps useContext(AccountContext)
```

### `useRef` — a box that survives renders but doesn't trigger one  *(common)*

```tsx
const inputRef = useRef<HTMLInputElement>(null);   // DOM handle
inputRef.current?.focus();

const renderCount = useRef(0);   // mutable value, no re-render when it changes
```

### `useMemo` / `useCallback` — cache a value / a function between renders  *(use only when measured or needed for referential stability)*

```tsx
const sorted = useMemo(() => bigList.sort(cmp), [bigList]);      // skip expensive recompute
const onSave = useCallback(() => save(id), [id]);                // stable function identity
```

Don't sprinkle these everywhere — they have a cost. See `04` and `07`.

### `useReducer` — `useState`'s big sibling for complex/interrelated state  *(occasional)*

```tsx
const [state, dispatch] = useReducer(reducer, initialState);
dispatch({ type: "increment" });
```

### Custom hooks — bundle hook logic to reuse it  *(you'll write these all the time)*

```tsx
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn(o => !o), []);
  return [on, toggle] as const;
}
```

A custom hook shares **logic**, not state — every caller gets its own. This
repo's whole feature layer is custom hooks (`useMessages`, `useTyping`,
`useConversations`).

**Rough priority to learn:** `useState` → `useEffect` → `useContext` / `useRef`
→ custom hooks → `useMemo` / `useCallback` → `useReducer`.

---

## The lifecycle, in hook terms

| Moment | What runs |
|---|---|
| **Mount** | component function runs → JSX committed to DOM → `useEffect` setups run |
| **Update** (state/props changed) | function re-runs → DOM diff committed → effects whose deps changed: cleanup then setup |
| **Unmount** | all effect cleanups run |

There's no `componentDidMount` — it's `useEffect(fn, [])`. No
`componentWillUnmount` — it's the `return` inside that effect.

---

## "Thinking in React" — how to build a screen

1. **Draw boxes** on the mockup — each box is a component. Nest them into a tree.
2. **Build it static first** — props only, no state. Data passed top-down. It
   should render correctly but do nothing.
3. **Find the minimal state.** For each piece of data ask: does it change over
   time? Can I compute it from props or other state? If it changes and can't be
   computed, it's state.
4. **Decide where each piece of state lives** — the lowest common owner of every
   component that reads or writes it.
5. **Wire the events back up** — pass setters/callbacks down so children can ask
   the owner to change it.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| library vs framework (React vs Next/Angular) | React is a view library — routing, data fetching, build are your choice (or a framework like Next provides them). |
| declarative vs imperative | Declarative: describe the target UI for a given state. Imperative: script each DOM mutation. React is declarative. |
| props vs state | Props: passed in, read-only, owned by the parent. State: internal, mutable via setter, owned by the component. |
| component vs hook | Component returns JSX. Hook returns data/behavior and renders nothing; both follow the Rules of Hooks. |
| `useState` vs a plain variable | A plain `let` resets every render and doesn't trigger one. `useState` persists and re-renders on change. |
| mount vs render | Mount is the first render + DOM insertion. Render is any run of the component function. |

---

## 🧠 Hooks

- **`UI = f(state)`.** You change state; React changes the DOM.
- **Data down (props), events up (callbacks).** The parent owns the state.
- **Props are read-only.** Want to change a value? It's state, somewhere up the tree.
- **Hooks run top-level only**, in the same order every render.
- **Learn `useState` and `useEffect` cold; reach for the rest as needed.**
- **Build static-first, then add the minimal state at its lowest common owner.**
