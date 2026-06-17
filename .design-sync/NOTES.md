# design-sync notes — NotionClub DS

This repo is a **Next.js 16 app**, not a packaged design system. The sync coerces
`src/shared/components/**` into a browser DS bundle via synth-entry. Several
quirks below were load-bearing to get a clean build + render.

## Build entry point
- **Canonical build: `node .design-sync/build.mjs`** (from repo root). It:
  1. `node .ds-sync/gen.mjs` — introspects the *current* `src/shared/components`
     and rewrites `.design-sync/entry.mjs` + `cfg.componentSrcMap`. The repo is
     edited in parallel (Théo pushes to `main`), so the component set is
     re-derived every build — do NOT hand-maintain the entry/map.
  2. Compiles Tailwind v4 → `.design-sync/styles.compiled.css` (the `cssEntry`).
  3. Runs `package-build.mjs`.
  4. Escapes non-ASCII in `_ds_bundle.js` and re-stamps the anchor `bundleSha12`.
- `cfg.buildCmd` only covers the Tailwind compile; the **driver/resync does NOT
  run steps 1 and 4** — after any `resync.mjs` run, re-run `node .design-sync/build.mjs`
  (or at least gen + escape) before uploading.

## Why a custom entry (`cfg.entry = .design-sync/entry.mjs`)
- No `dist/`; `node_modules/notionclub-infra` doesn't exist (repo can't self-install),
  so `--entry` is required to make PKG_DIR resolve to the repo root.
- The entry explicitly re-exports each component (named + 3 defaults) so we control
  the bundle graph and can stub the server/node boundary.

## Stubs (via `.design-sync/tsconfig.build.json` paths)
Client components statically import server actions / node-only SDKs that Next strips
at its server boundary but esbuild would bundle. Aliased to local stubs:
- `web-push`, `server-only` → `stubs/empty.ts`; `resend` → `stubs/resend.ts`
  (node builtins crypto/tls/… would fail the build; `server-only` throws at eval).
- `@/modules/auth`, `@/modules/settings` → their real `index.ts` (the `@/*` wildcard
  otherwise resolves the bare barrel to a *directory* → esbuild error). Ordered
  before `@/*` in the paths map.
- `stubs/process-shim.mjs` is imported FIRST in entry.mjs: components read
  `process.env.NEXT_PUBLIC_*` at module scope; without the shim the whole IIFE
  throws "process is not defined" at eval.

## Fonts
- SF Pro Display (.otf ×4, ~9MB) shipped via `cfg.extraFonts` → `fonts/`, and forced
  on `body` in `tw-input.css`. On macOS the `-apple-system` fallback already *is* SF,
  but shipping the font keeps the uploaded DS on-brand in the render env too.

## Render check
- No Playwright browser installed; uses the homebrew Chromium 149 via
  `DS_CHROMIUM_PATH=/opt/homebrew/bin/chromium`. `playwright` lib installed in
  `.ds-sync` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.

## Server-coupled components (render as floor cards / shells)
These reach Supabase/server actions and won't render meaningfully statically; expect
floor cards or partial shells: AdminPushDevCard/Registrar (push admin, cookies error),
EmailConfirmBanner(+Actions), settings/* (ProfileHero, ProfileSection, SecuritySection,
NotificationsSection, DangerZone, AvatarPicker, SubscriptionSection, AppearanceSection),
coaching/* that read the browser supabase client.

## Re-sync risks
- **Live repo**: component set changes between syncs — `gen.mjs` re-derives it, but
  review added/removed names. (`SaveStatus`, `DevPanel` were removed mid-first-sync;
  `AppearanceSection` added.)
- **Non-ASCII escape + bundleSha re-stamp** live only in `build.mjs`, not the driver.
- **Stubs** assume the server boundary stays `web-push`/`resend`/`server-only`/the two
  barrels. A new node-only dep in a client graph → add it to `tsconfig.build.json` paths.
- `--render-check` depends on the homebrew Chromium path existing.

## Known render warns (triaged, not new)
- AdminPushDevCard: `cookies` called outside request scope — server-coupled, floor card.

## Preview authoring learnings (wave 1)
- `PreviewProvider` now also wraps children in the app `ThemeProvider` (theme/ThemeProvider) — `ThemeToggle`, `AppearanceSection` and anything calling `useTheme()` throw without it.
- **Relative-date labels drift**: `NextCallPill` / `CallTile` upcoming pills compute "aujourd'hui/demain/dans N jours" against the render machine's `Date.now()`; the repo's mock dates are in 2026, so labels collapse to "dans ~76X jours". Styling is correct — accepted, not a blocker.
- **CallTile blank trap**: a `past` call WITH `ai_summary`/`notion_page_id` makes the tile mount `CallDetailModal`, which pulls a server module + `useTheme` and renders the whole tile blank. Author CallTile/past cells WITHOUT summary/page-id.
- **Toaster** renders toasts into a body portal (outside the per-cell frame) — author a styled static replica using sonner's configured tokens (card surface, default border, 14px radius, nc-shadow-2) instead of live toast calls.
- **GradualBlurOverlay**: top anchor must be the overlay's first child, bottom anchor the last child, in a static non-scrolled container.

## Preview authoring learnings (wave 2)
- **`next/image` aliased to a plain-`<img>` stub** (`stubs/next-image.tsx`, via tsconfig.build paths): the real component validates remote hostnames against next.config (absent) and throws "hostname not configured" → blank host component. Fixed Topbar, EmailConfirmBannerActions/AvecGmail, etc.
- **Fake Supabase env + `__dirname`/`__filename` added to `process-shim.mjs`**: `createBrowserClient('','')` throws "URL and API key required", and some module references `__dirname`. Fake non-empty values let Topbar/MobileTopActions (which build a browser supabase client + NotificationPopover) render.
- **Modals** `CallDetailModal`, `NextCallDetailModal`, `FilloutModal` use `cfg.overrides.<N>.cardMode = "single"` (full-screen `inset:0` overlays).
- **Floor-card by nature** (no static visual / unfixable from previews): context providers `ProfileIdentityProvider`, `ProfileModalProvider`, `DevToolboxProvider`; null-returning registrars `ServiceWorkerRegistrar`, `AdminPushRegistrar`, `FeedbackWidgetLoader`; `DevToolboxButton`/`FeedbackWidget` (need unexported register hooks / internal open state); `EmailConfirmBanner` (async Server Component → null, covered by EmailConfirmBannerActions); `AdminPushDevCard` (server `cookies()` import). These keep the functional floor card.
- `SubscriptionSection` fetches `/api/payments/me` on mount → shows its real styled error state in preview (no prop to inject data).

## Known render warns (triaged — not new, render visually fine)
- `Topbar`, `MobileTopActions`, `AdminPushDevCard`: non-fatal `cookies() was called outside a request scope` pageerror from a transitively-imported server path; the components still render their visible UI (verified). Accepted.
- `NotionBlocks`: non-fatal pageerror from one block variant; the document still renders.

## Re-sync setup (fresh clone)
- `node .design-sync/build.mjs` is the canonical build (gen → tailwind → converter → escape → re-stamp).
- It needs the staged scripts + their deps: re-copy `.ds-sync/` per the skill, run the dep install there, then recreate the fork symlink so `.design-sync/gen.mjs` resolves ts-morph:
  `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules`
- `.design-sync/entry.mjs` and `.design-sync/styles.compiled.css` are generated (gitignored) — produced by the build.
