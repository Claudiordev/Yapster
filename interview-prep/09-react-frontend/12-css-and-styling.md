# 12 — CSS and styling in React

## The landscape

| Approach | What it is | Scoping | Runtime cost | Used when |
|---|---|---|---|---|
| **Plain CSS / global stylesheet** | one `.css` file, `className="row"` | none — global namespace | zero | tiny apps, resets, base tokens |
| **CSS Modules** | `Foo.module.css`, `import s from …; className={s.row}` | per-file (compiler hashes names) | zero | the "just CSS but safe" default; framework-built-in |
| **Utility CSS (Tailwind)** | compose pre-made classes: `className="flex gap-3 p-4"` | n/a (atomic classes) | zero (build-time) | fast iteration, design-system consistency — **this repo** |
| **CSS-in-JS runtime** (styled-components, Emotion) | write CSS in JS, styles injected at runtime | per-component | some (runtime injection); SSR friction | dynamic theming-heavy apps; falling out of favor for RSC |
| **CSS-in-JS zero-runtime** (vanilla-extract, Panda, Linaria) | CSS in TS, extracted to `.css` at build | per-file, typed | zero | want CSS-in-JS DX without the runtime |
| **Inline `style={{}}`** | a style object prop | element only | new object each render | truly dynamic values (a computed `width`, `transform`) only |

**The mid-level answer to "which one":** CSS Modules or Tailwind for 90% of
apps — both are zero-runtime and scoped/consistent. Runtime CSS-in-JS is a
liability in React Server Components (it needs a client boundary). Inline styles
only for values you compute at runtime.

---

## How this repo does it: Tailwind 4 + design tokens + HeroUI

```css
/* styles/globals.css */
@import "tailwindcss";
@import "./colors.css";
@plugin '../hero.ts';                       /* HeroUI's Tailwind plugin */
@custom-variant dark (&:is(.dark *));       /* .dark ancestor → dark: variant */

@theme {
  --font-sans: "font", sans-serif;
}
```

```css
/* styles/colors.css — design tokens become utilities automatically */
@theme {
  --color-brand: #ff3b47;          /* → bg-brand, text-brand, ring-brand … */
  --color-brand-hover: #e62d3a;    /* → hover:bg-brand-hover */
  --color-surface-sidebar: #2b2d31;
}
```

Tailwind 4 is **config-in-CSS** (no `tailwind.config.js`). You define tokens in
an `@theme` block and every token turns into utilities. This is the key idea:
**you don't write raw hex in components — you write `bg-brand`**, and the palette
is changed in one file.

### Composing classes in a component

`ChatList` shows the real pattern — conditional classes via template literals:

```tsx
<button
  className={`group flex items-center gap-3 rounded-medium border-2 border-transparent p-3 text-left transition-[background-color] ${
    isActive ? "chat-conversation-active text-white" : "text-foreground hover:bg-default-100"
  }`}
/>
```

Once conditionals stack up, use a helper instead of nested template strings:

```tsx
import clsx from "clsx";   // this repo has it in package.json

className={clsx(
  "flex items-center gap-3 p-3 rounded-medium",
  isActive && "bg-brand-deep text-white",
  unread && "font-semibold",
  className,                        // always fold in the caller's override last
)}
```

For components with **variants**, `tailwind-variants` (also a dependency here):

```tsx
import { tv } from "tailwind-variants";

const button = tv({
  base: "rounded-medium font-medium transition",
  variants: {
    color: { brand: "bg-brand text-white", ghost: "bg-transparent text-foreground" },
    size:  { sm: "px-2 py-1 text-sm", md: "px-4 py-2" },
  },
  defaultVariants: { color: "brand", size: "md" },
});

<button className={button({ color: "ghost", size: "sm" })} />
```

### HeroUI

A component library built on Tailwind + React Aria. `ChatList` imports
`Avatar`, `Button`, `Skeleton` from `@heroui/*`. It gives you accessible,
themed primitives; you still style layout with Tailwind classes and pass
`classNames={{ base: …, inputWrapper: … }}` to reach inner parts (see
`MessageComposer`'s `<Input>`).

---

## Dark mode

Two mechanisms, and this repo uses the class strategy:

```css
@custom-variant dark (&:is(.dark *));
```

A `.dark` class on `<html>` (toggled by `next-themes`) flips every `dark:`
utility. Tokens can also be redefined under `.dark` so `bg-content1` resolves to
a different value per theme without touching components.

The alternative — `@media (prefers-color-scheme: dark)` — follows the OS with no
toggle. Class strategy wins when you want a user-controlled switch.

---

## Responsive

Tailwind is mobile-first: an unprefixed utility applies everywhere, a
`sm:`/`md:`/`lg:` prefix applies **at that breakpoint and up**.

```tsx
<div className="flex flex-col gap-2 md:flex-row md:gap-4">
  {/* column on phones, row on tablet+ */}
</div>
```

Prefer flexbox/grid + relative units over fixed pixel widths. `ChatList` uses
`flex-grow`, `min-w-0` (lets a flex child shrink so `truncate` works),
`overflow-y-auto` — layout that adapts without media queries at all.

---

## The `Icon` trick worth knowing

This repo renders monochrome SVGs via a **CSS mask** so the glyph inherits
`currentColor`:

```tsx
// components/icon.tsx
const style = {
  width: size, height: size,
  backgroundColor: "currentColor",          // the glyph takes the text color
  maskImage: `url(/icons/${name}.svg)`,
  maskSize: "contain",
};
return <span style={style} className={className} />;
```

Now `<Icon name="plus" className="text-brand hover:text-white" />` themes the
icon with the same utilities as text — a plain `<img>` couldn't do that.
(Inline `style` is justified here: `size` and the per-name URL are runtime values.)

---

## Styling rules of thumb

- **Tokens, not literals.** `bg-brand`, not `bg-[#ff3b47]`. One source of truth.
- **Layout with fl/grid + relative units.** Fixed `px` widths break on small screens.
- **`className` prop last** in `clsx`/`tv` so callers can override.
- **Inline `style` only for computed values** (a dragged element's `transform`, a
  progress bar's `width`). Never for static styling.
- **Don't fight the DOM in JS.** Positioning, show/hide, transitions — CSS does
  it faster and survives re-renders. Reach for JS only to *measure*.
- **Co-locate styles with components.** `Foo.module.css` next to `Foo.tsx`; or,
  with Tailwind, the classes are already in the component.

---

## Terms you will be asked to distinguish

| Pair | Answer |
|---|---|
| CSS Modules vs Tailwind | Modules: real CSS, per-file scoping via hashed names. Tailwind: atomic utility classes composed in markup. Both zero-runtime. |
| runtime vs zero-runtime CSS-in-JS | Runtime (styled-components) injects styles in the browser — RSC-hostile. Zero-runtime (vanilla-extract) extracts to `.css` at build. |
| `className` vs `style` | `className` → CSS classes (cacheable, pseudo-classes, media queries). `style` → inline object, only for dynamic values, no `:hover`. |
| design token vs hard-coded value | Token (`--color-brand`) = one definition, themeable. Hard-coded hex scattered = a refactor waiting to happen. |
| class dark mode vs `prefers-color-scheme` | Class = user toggle (`.dark` on root). Media query = follows the OS, no toggle. |
| mobile-first vs desktop-first | Tailwind is mobile-first: base styles are smallest screen, `md:` etc. add *upward*. |
| CSS specificity vs utility classes | Specificity conflicts (which rule wins) largely disappear with single-purpose atomic classes. |

---

## 🧠 Hooks

- **Default to CSS Modules or Tailwind** — both scoped and zero-runtime. Runtime CSS-in-JS is a poor fit for Server Components.
- **Define colors/spacing as tokens once** (`@theme` / `colors.css`); components reference `bg-brand`, never raw hex.
- **`clsx` for conditional classes, `tailwind-variants` for component variants** — stop nesting template-literal ternaries.
- **Inline `style={{}}` only for values computed at runtime.**
- **Layout with flex/grid + relative units + `min-w-0`/`truncate`** beats media queries for most components.
- **Dark mode via a `.dark` root class** when you want a user toggle; redefine tokens per theme, not per component.
