# 09 — TypeScript with React

Mid-level frontend is TypeScript by default now. What you actually need:

---

## Typing props

```tsx
interface MessageComposerProps {
  placeholder: string;
  isDisabled: boolean;
  isSending: boolean;
  onSend: (body: string) => void;
  onType?: () => void;               // optional
}

export function MessageComposer({ placeholder, onSend, onType }: MessageComposerProps) { … }
```

- `interface` or `type` — both fine for props. `type` for unions/intersections,
  `interface` when you might want declaration merging. Be consistent.
- Optional prop → `?`. Callers can omit it; inside, it's `T | undefined`, so
  `onType?.()`.
- Default values: destructure them — `function C({ variant = "flat" }: Props)`.

## Typing `children`

```tsx
import type { ReactNode } from "react";

export function ChatProvider({ children }: { children: ReactNode }) { … }
```

`ReactNode` = anything renderable (elements, strings, numbers, arrays, `null`).
Use it. Avoid `JSX.Element` (too narrow — excludes strings/null) and
`React.FC` (implicit `children`, some other footguns — the community moved off it).

## Typing events

```tsx
function submit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  onSend(text.trim());
}

onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
onClick={(e: React.MouseEvent<HTMLButtonElement>) => …}
```

Often you don't need to annotate — if the handler is written inline on a typed
element, TS infers `e`. You annotate when the handler is a named function
declared separately.

---

## Typing hooks

```tsx
const [text, setText] = useState("");                       // inferred string
const [user, setUser] = useState<User | null>(null);        // annotate when initial value is null
const [ids, setIds] = useState<string[]>([]);               // annotate empty array

const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
const inputRef = useRef<HTMLInputElement>(null);            // DOM ref: | null
```

`ReturnType<typeof setTimeout>` — because it's `number` in the browser but
`NodeJS.Timeout` in Node; this expression is correct in both. `useTyping` uses it.

---

## Discriminated unions — the pattern this codebase leans on

The socket event model (`lib/chat.ts`) is a union tagged by a literal `type`
field:

```tsx
export type EventType = "MESSAGE" | "TYPING" | "USER_STATUS_EVENT"
  | "CALL_STARTED" | "CALL_ENDED" | "CALL_STATUS";

export interface MessageEvent { type: "MESSAGE"; id: string; seq: number; roomId: string; body: string; senderId: string; sentAt: string; }
export interface TypeEvent    { type: "TYPING"; conversationId: string; senderId: string; }
// …

export type ServerEvent = MessageEvent | TypeEvent | UserStatusServerEvent
  | CallStartedEvent | CallEndedEvent | CallStatusEvent;
```

Now `switch (event.type)` **narrows** the type in each branch:

```tsx
function handle(event: ServerEvent) {
  switch (event.type) {
    case "MESSAGE":
      return event.body;          // ✅ TS knows event is MessageEvent here
    case "TYPING":
      return event.conversationId; // ✅ TypeEvent; event.body would be a compile error
  }
}
```

`useRealtime` makes `subscribe` generic over the tag so the handler gets the
**one** narrowed event type:

```tsx
type Handler<T extends EventType> = (event: Extract<ServerEvent, { type: T }>) => void;

subscribe: <T extends EventType>(type: T, handler: Handler<T>) => () => void;

// call site — `e` is MessageEvent, fully typed, no cast:
subscribe("MESSAGE", e => { queryClient.setQueryData(key, old => insert(old, e.body)); });
```

`Extract<ServerEvent, { type: "MESSAGE" }>` → `MessageEvent`. This is the payoff
of discriminated unions: exhaustive, cast-free event handling.

---

## `as const`

```tsx
const messagesKey = (id: string | null, uid: string | null) =>
  ["messages", id, uid] as const;
// type: readonly ["messages", string | null, string | null]
// without `as const`: (string | null)[]  — TanStack Query wants the tuple
```

`as const` freezes a literal to its narrowest type (readonly tuple, literal
strings). Used for query keys, action-type constants, config objects.

---

## Utility types you'll reach for

| Type | Does |
|---|---|
| `Partial<T>` | all props optional — `addConversation(conversation: Partial<Conversation>)` |
| `Pick<T, K>` / `Omit<T, K>` | subset / everything-except |
| `Record<K, V>` | object with known key type — `Record<string, Handler>` |
| `ReturnType<typeof fn>` | the type a function returns |
| `Extract<U, V>` / `Exclude<U, V>` | filter a union in / out |
| `NonNullable<T>` | strip `null | undefined` |
| `T["field"]` | indexed access — `Conversation["members"][number]` = one member's type |

`useConversations` uses `Conversation["members"][number]` to type a single
member without declaring a separate `Member` type.

---

## `unknown` vs `any`

```tsx
const event = JSON.parse(e.data) as ServerEvent;   // asserting shape at the boundary
```

`any` disables checking and spreads. `unknown` forces you to narrow before use.
At trust boundaries (JSON from a socket, `res.json()`), you either validate
(Zod) or `as`-assert deliberately — this app `as`-asserts DTOs because the types
mirror the backend's contract.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| `interface` vs `type` | Interface merges & extends cleanly; `type` does unions/intersections/mapped types. Props: either. |
| `ReactNode` vs `JSX.Element` | `ReactNode` = anything renderable (incl. string, null, array). `JSX.Element` = one element only. Use `ReactNode` for `children`. |
| `any` vs `unknown` | `any` opts out of checking. `unknown` requires narrowing before use — safe. |
| `as` vs a type guard / Zod | `as` asserts with no runtime check. A guard/schema actually verifies. Assert only where you own the contract. |
| discriminated union vs a bag of optionals | Union with a literal tag → exhaustive `switch`, TS narrows each branch. Optionals → every field is `T | undefined` everywhere. |
| `as const` vs no assertion | `as const` = narrowest literal/readonly-tuple type. Needed for query keys, literal-typed constants. |

---

## 🧠 Hooks

- **`children: ReactNode`**, props as an `interface`, and let TS infer inline event handlers.
- **Annotate `useState` only when the initial value doesn't reveal the type** (`null`, `[]`).
- **Model events as a discriminated union tagged by `type`** — `switch` narrows, and `Extract<Union, {type:T}>` gives you the exact payload. That's what makes `subscribe("MESSAGE", e => …)` fully typed.
- **`as const` for query keys and literal constants.**
- **`unknown`, not `any`, at data boundaries** — then narrow or schema-validate.
