# 02 — State and events

## `useState`: the one rule that trips people up

```tsx
const [text, setText] = useState("");
```

`text` is a **snapshot**. For the whole duration of one render, it is a constant.
`setText` does two things: schedules a re-render, and tells React what `text`
will be *next time*. It does **not** change the `text` variable you're holding.

```tsx
function submit(e) {
  e.preventDefault();
  onSend(text.trim());
  setText("");          // schedules re-render with text = ""
  console.log(text);    // still the OLD value — this render's snapshot
}
```

### Batching

Multiple `setState` calls in the same event handler (and, since React 18, in
timeouts, promises, and native handlers too) are **batched** into one re-render.

```tsx
setIsSending(true);
setError(null);
setText("");
// ONE re-render, not three
```

### Updater functions — when you need the previous value

```tsx
// ❌ both read the same snapshot — net effect is +1
setCount(count + 1);
setCount(count + 1);

// ✅ each gets the pending value — net effect is +2
setCount(c => c + 1);
setCount(c => c + 1);
```

Real example — `useTyping` adds a sender to the list without stomping a
concurrent update:

```tsx
setTypingIds(prev =>
  prev.includes(event.senderId) ? prev : [...prev, event.senderId],
);
```

**Rule:** if the next state depends on the current state, pass a function. This
also matters inside effects and socket callbacks that close over a stale value.

---

## State must be immutable

React decides whether to re-render by comparing the **reference** (`Object.is`).
Mutating in place keeps the same reference → no re-render, or a re-render with
torn state.

```tsx
// ❌ mutation — same array reference, React may not re-render
conversations.push(newConvo);
setConversations(conversations);

// ✅ new reference every time (from useConversations)
setConversations(prev => [full, ...prev]);

setConversations(prev =>
  prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c),  // new obj for the changed row only
);
```

The patterns: `[...arr, x]`, `arr.filter`, `arr.map`, `{ ...obj, k: v }`. For
deep nesting, spread at each level you change (or use `useReducer` / Immer).

---

## Choosing state — the checklist

Before adding `useState`, ask:

1. **Can I derive it during render?** Then don't store it.
   ```tsx
   const count = text.length;              // not useState + useEffect
   const over = count > MAX_MESSAGE_LENGTH;
   const canSend = text.trim().length > 0 && !over && !isDisabled;
   ```
2. **Does the parent already have it?** Then take it as a prop (lift it up).
3. **Is it the same thing stored twice?** Store the id, look up the object.
   `ChatProvider` holds `incomingCallId` (a string) and derives the
   conversation: `conversations.find(c => c.id === incomingCallId)`.
4. **Does the UI need to react to it?** If not (a throttle timestamp, a timer
   handle), it's a `ref`, not state. `useTyping` keeps `lastSentAt` and the
   per-sender timers in refs — changing them must not re-render.

---

## Where does the state live? (altitude)

| State | Lives in | Why there |
|---|---|---|
| draft message text | `MessageComposer` (local `useState`) | only the composer cares; keeping it low means typing doesn't re-render the thread |
| typing indicator ids | `useTyping` hook, mounted in the thread | one conversation's concern |
| conversation list | `ChatProvider` (context) | sidebar **and** thread route both read it |
| logged-in user | `AccountProvider` (context) | app-wide |
| server data (messages) | TanStack Query cache | shared, cached, refetchable — not really "component state" |

**Lifting state up:** when two siblings need the same state, move it to their
closest common parent and pass it down + pass setters/callbacks down. **Colocating:**
the opposite — push state as low as it'll go. Both are the same principle: state
lives exactly where it's used, no higher.

---

## Events

```tsx
<Input
  value={text}
  onValueChange={v => {           // HeroUI's callback; DOM equivalent is onChange
    setText(v);
    if (v.length > 0) onType?.();
  }}
/>
<Form onSubmit={submit}>          // synthetic event, cross-browser normalized
```

- **Synthetic events**: React wraps native events in a `SyntheticEvent` for
  consistency. `e.preventDefault()` / `e.stopPropagation()` work as normal.
- **Handlers are props.** `onSend`, `onType`, `onAccept` — a parent passes a
  function down, the child calls it. This *is* "events flow up".
- **Naming:** the prop that *takes* a handler is `onX`; the function that *is*
  the handler is often `handleX`.
- **Passing args:** `onClick={() => remove(id)}` — wrap in an arrow. `onClick={remove(id)}`
  calls it during render.
- **`e.target` vs `e.currentTarget`:** `target` is what was clicked;
  `currentTarget` is what the handler is attached to.

---

## Controlled inputs

```tsx
const [text, setText] = useState("");
<input value={text} onChange={e => setText(e.target.value)} />
```

React state drives the input; every keystroke round-trips through state. This is
what lets `MessageComposer` compute `count`, `over`, `canSend` and clear the
field with `setText("")`. Uncontrolled alternative — `defaultValue` + a `ref`,
read only on submit — is fine for big forms where you don't need per-keystroke
reactivity.

**Trap:** `value={undefined}` → React treats the input as uncontrolled and warns
when it later becomes controlled. Initialize to `""`.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| state snapshot vs live variable | Within a render, state is frozen. `setX` affects the *next* render, not this one's variable. |
| `setX(v)` vs `setX(fn)` | Value form uses this render's snapshot. Function form receives the latest pending value — use it when the update depends on the previous state. |
| state vs ref | Both persist across renders. Changing state re-renders; changing `ref.current` doesn't and isn't visible until the next render for another reason. |
| derived state vs stored state | Derived = computed from props/other state during render (preferred). Stored = its own `useState` (only when it can't be derived). |
| controlled vs uncontrolled | Controlled = React state is truth. Uncontrolled = the DOM is truth, read via ref. |
| lifting state up vs prop drilling | Lifting = deliberately moving state to a common ancestor. Prop drilling = the *symptom* of passing it through many layers that don't use it (fix with context or composition). |

---

## 🧠 Hooks

- **State is a snapshot; setters schedule.** `console.log` right after `setX` shows the old value — that's correct, not a bug.
- **Depends on the previous state? Use the updater function.** Especially in socket handlers and effects, which close over stale values.
- **Never mutate.** React compares references; `arr.push` + `setArr(arr)` is a no-op or a tear.
- **If you can compute it during render, it's not state.** `count`, `canSend`, "the selected conversation object" — all derived.
- **No UI reaction needed? It's a ref.** Timers, throttle timestamps, previous values.
