# 11 — Structuring a React project

There's no official layout. There are two that scale and one that doesn't.

| Layout | Scales? | Why |
|---|---|---|
| **By type** — `components/`, `hooks/`, `utils/`, `contexts/` all flat | ✗ past ~20 components | one feature's files scattered across five folders; every change touches the whole tree |
| **By feature** — everything for a feature in one folder | ✓ | a feature is one directory you can read, move, or delete as a unit |
| **Hybrid** — feature folders + a shared/ common layer | ✓✓ | features own their code; genuinely cross-cutting bits live in one shared place |

This repo is the hybrid, done with Next's App Router conventions.

---

## How this repo lays it out

```
web/
├── app/                              ← routes (App Router: folders = URL segments)
│   ├── (auth)/                       route group — login/register, public
│   │   ├── login/
│   │   │   ├── page.tsx              the /login route
│   │   │   └── _Components/          components used ONLY by login
│   │   └── _Components/              shared across the auth group
│   ├── (protected)/
│   │   ├── layout.tsx                mounts app-wide providers
│   │   └── sms/
│   │       ├── layout.tsx            mounts ChatProvider
│   │       ├── page.tsx              /sms
│   │       ├── [conversationId]/page.tsx
│   │       └── _Components/          ← the whole chat feature
│   │           ├── ChatProvider.tsx
│   │           ├── ChatShell.tsx
│   │           ├── chatTypes.ts
│   │           ├── _Chat/            sub-feature: conversation list
│   │           │   ├── ChatList.tsx
│   │           │   ├── ChatListRow.tsx
│   │           │   ├── useConversations.ts
│   │           │   └── StatusDot.tsx
│   │           ├── _Message/         sub-feature: the thread
│   │           │   ├── MessageComposer.tsx
│   │           │   ├── useMessages.ts
│   │           │   └── useTyping.ts
│   │           ├── _Call/            sub-feature: voice
│   │           ├── _GameServers/
│   │           └── _Panels/
│   └── api/                          ← the BFF: route handlers, server-only
│       └── chat/[conversationId]/message/route.ts
├── components/                       ← genuinely app-wide UI (Icon, ThemeSwitch, TopBar)
├── lib/                              ← app-wide non-UI: useRealtime, use-account,
│                                        get-account, chat.ts (types), constants.ts
├── styles/                           ← globals.css, colors.css (design tokens)
├── config/  types/  hooks/           ← misc shared
└── middleware.ts
```

### The conventions doing the work

- **`_Components/` (underscore prefix)** — in the App Router, a folder starting
  with `_` is a *private folder*: it's never treated as a route. This is how a
  feature keeps its components next to the `page.tsx` that uses them without
  Next trying to route `/sms/_Components`.
- **Colocation.** `useMessages.ts` lives beside `MessageComposer.tsx` because
  only the message feature uses it. If the call feature needed it too, it'd move
  up to `_Components/` or `lib/`. **Code lives as close as possible to where it's
  used, and moves up only when a second consumer appears.**
- **Sub-feature folders** (`_Chat/`, `_Message/`, `_Call/`) — the chat feature
  is big, so it's split again by concern. Same rule, one level down.
- **`lib/` vs `components/`** — `lib/` is logic/types/config (no JSX, or
  context providers); `components/` is reusable UI. `useRealtime.tsx` is in
  `lib/` because it's a provider + hook, not a visual component.
- **The route group `(auth)` / `(protected)`** — parens mean "group these for a
  shared `layout.tsx` but don't put the folder name in the URL". Auth pages get
  the sunset background; protected pages get the providers.

---

## Naming

- **Components**: `PascalCase.tsx`, file name = export name (`ChatList.tsx` →
  `export function ChatList`). One main component per file.
- **Hooks**: `useThing.ts`, camelCase, `use` prefix (lint depends on it).
- **Non-component modules**: this repo mixes `kebab-case.ts` (`use-account.tsx`,
  `get-account.ts`) and `camelCase.ts` (`useRealtime.tsx`, `randomId.ts`) — pick
  one and be consistent; kebab is the more common convention.
- **Types**: colocate in the feature (`chatTypes.ts`) or beside the code that
  owns them; shared DTOs in `lib/chat.ts`.
- **Tests**: `Thing.test.tsx` next to `Thing.tsx`.

---

## Barrel files (`index.ts` re-exports)

```ts
// _Chat/index.ts
export { ChatList } from "./ChatList";
export { useConversations } from "./useConversations";
```

Lets consumers write `import { ChatList } from "@/…/_Chat"`. **Upside:** tidy
imports. **Downside:** circular-import hazards, and bundlers sometimes can't
tree-shake them, pulling in the whole barrel. This repo mostly **doesn't** use
them — it imports files directly (`import { StatusDot } from "./StatusDot"`).
That's a fine default; add a barrel only at a stable public boundary.

---

## Path aliases

`tsconfig.json` maps `@/*` → the project root, so imports are
`@/lib/useRealtime` instead of `../../../../lib/useRealtime`. Set this up on day
one. Relative imports (`./StatusDot`) stay relative *within* a feature folder;
cross-feature and shared imports use `@/`.

---

## What goes where — decision table

| You're adding… | Put it in… |
|---|---|
| a component only this page uses | `<page>/_Components/` |
| a hook only this feature uses | beside the components that use it |
| a component two features use | `components/` (or a shared feature folder) |
| a pure helper (formatting, math) | `lib/` (or `lib/utils/`) |
| a type used across features | `lib/<domain>.ts` |
| a context provider | `lib/` if app-wide, feature folder if feature-wide |
| an API call | a route handler in `app/api/` (this repo's BFF pattern) + a hook that calls it |
| a design token (color, spacing) | `styles/colors.css` |

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| by-type vs by-feature structure | By-type groups `components/`, `hooks/` etc.; breaks down at scale. By-feature groups everything for a feature; scales. Hybrid adds a shared layer. |
| colocation vs premature sharing | Keep code next to its one user; promote to shared only when a second user appears. |
| `_folder` (private) vs route folder | In Next App Router, `_`-prefixed folders are never routes — used to colocate components inside `app/`. |
| route group `(name)` vs normal folder | Parens = shared layout without adding a URL segment. |
| barrel file vs direct import | Barrel = one `index.ts` re-exporting a folder (tidy imports, tree-shaking/circular risks). Direct = import the file. |
| `lib/` vs `components/` | `lib/` = logic, types, config, providers. `components/` = reusable visual UI. |

---

## 🧠 Hooks

- **Structure by feature, not by file type.** A feature should be one folder you can read or delete whole.
- **Colocate, then promote.** Code sits next to its only consumer; it moves up only when a second consumer shows up.
- **`_Components/` (underscore) keeps a feature's components inside `app/` without becoming routes.**
- **`lib/` = logic & providers, `components/` = shared UI, `styles/` = tokens.**
- **Set up the `@/` path alias immediately** — no `../../../..`.
- **Skip barrel files by default**; add one only at a deliberate public boundary.
