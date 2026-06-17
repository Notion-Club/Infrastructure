# NotionClub design system — how to build with these components

This library is the real component set of **NotionClub**, a French Notion-training
community app (Next.js 16 + React 19 + Tailwind v4). Every component is imported
from the shipped bundle and styled by the bundled stylesheet. Build on-brand by
reusing the tokens and class vocabulary below — do **not** invent new color/spacing
systems.

## Setup & wrapping
- Components are styled entirely by the bundled CSS (tokens + utilities + the `nc-*`
  layer). Most render correctly with **no wrapper**.
- **Light/dark theme**: wrap the tree in `ThemeProvider` (exported). It toggles a
  `.dark` class on `<html>`; every token has a dark value, so theming is automatic.
  `ThemeToggle` is the ready-made Light / Système / Dark control.
- **Nav/identity components** (`Topbar`, `MobileTopActions`, `BottomNav`,
  `ProfileHero`, `ProfileRecapCard`) read the current user from
  `ProfileIdentityProvider` — wrap them in it (`initialIdentity={…}`) so they show a
  user. In a Next app they also use `next/navigation` (router/usePathname).
- The page background is `nc-page-halo` (warm `#f5f2f2` + a soft brand radial halo);
  put page content inside it.

## Styling idiom — THIS system's vocabulary
Three layers, used together: **Tailwind v4 utilities**, **CSS-variable design tokens**,
and a **custom `nc-*` class layer**. Prefer tokens + `nc-*` for anything brand-specific.

**Design tokens** (CSS custom properties — use as `var(--…)` in styles, or the matching
Tailwind semantic utility):

| Token | Use | Tailwind semantic utility |
|---|---|---|
| `--color-brand` (`#e0625a`) | the signature red — accents, active states, progress | (use `var()` directly) |
| `--color-surface-page` / `--color-surface-raised` / `--color-surface-card` | page bg / inputs & pills / cards & modals | — |
| `--color-text-primary` / `--color-text-secondary` / `--color-text-muted` | body / secondary / hints | `text-foreground`, `text-muted-foreground` |
| `--color-border-default` | hairline borders | `border-border` |
| `--background` `--primary` `--secondary` `--muted` `--accent` `--destructive` | shadcn semantic colors | `bg-background` `bg-primary` `bg-secondary` `bg-muted` `bg-accent` `bg-destructive` (+ `text-*-foreground`) |
| `--nc-radius-xs|sm|md|xl` (12 / 16 / 24 / 100px) | corner radii | — |
| `--nc-shadow-2` / `--nc-shadow-3` | card / dropdown elevation | — |
| `--nc-ease` (`cubic-bezier(.22,1,.36,1)`) | standard easing | — |

**`nc-*` component classes** (verified in the stylesheet): `nc-page-halo` (page bg+halo),
`nc-topbar-pill`, `nc-dropdown-panel`, `nc-input` (the branded text input), `nc-shine-card`
(animated brand border), `nc-btn-shine`, `nc-blink-dot`. These encode the brand look —
reuse them rather than re-styling from scratch.

**Layout/spacing**: standard Tailwind v4 utilities (`flex`, `grid`, `gap-*`, `px-*`,
`rounded-*`, `text-sm`, etc.). Font is **SF Pro Display** (shipped) — applied on `body`,
so text inherits it; no font class needed.

## Where the truth lives
- The bundled stylesheet `_ds/<folder>/styles.css` and its `@import` closure hold every
  token, the full `nc-*` layer, and the compiled utilities — read it before styling.
- Each component's `<Name>.prompt.md` (usage) and `<Name>.d.ts` (props) are the per-
  component contract.

## One idiomatic example
```tsx
import { ProfilWidget, ProgressBar, Button } from "<this-library>";

function DashboardCard() {
  return (
    <div className="nc-page-halo" style={{ padding: 24 }}>
      <div style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: "var(--nc-radius-sm)",
        boxShadow: "var(--nc-shadow-3)",
        padding: 20, display: "flex", flexDirection: "column", gap: 16,
      }}>
        <h3 style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Ma formation</h3>
        <ProgressBar percent={58} from="5 / 12 modules" to="58 %" />
        <Button>Reprendre</Button>
      </div>
    </div>
  );
}
```
