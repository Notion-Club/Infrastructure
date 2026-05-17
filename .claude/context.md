# Contexte projet — NotionClub Infra

## Branche active
`claude/develop-home-page-6cym5` → PR #7 ouverte sur `theogouman/NotionClub-Infra`
Tout push sur cette branche met à jour la PR automatiquement.

---

## Stack
- **Next.js 16.2.6** (Turbopack, App Router) + **React 19**
- **Tailwind CSS v4** (`@import "tailwindcss"`)
- **shadcn/ui** → `src/shared/components/ui/`
- **Supabase** (auth + DB) — non branché sur le dashboard (tout est mocké)
- **lucide-react v1.16.0**
- **Police** : SF Pro Display (self-hostée, 4 graisses), chargée via `src/shared/lib/fonts.ts`
- **Vercel** : team `g0uman`, project `prj_CHn38vwOkjzm2DqzhcBilIDQpRo6`

---

## Design system (tokens CSS — `src/app/globals.css`)

```css
--color-brand: #e0625a          /* accent rouge Notion Club */
--color-text-primary: #000000
--color-text-secondary: #52525b
--color-text-muted: #64748b
--color-surface-page: #f5f2f2   /* fond de page (pinkish) */
--color-surface-raised: #f5f5f5
--color-border-default: #e5e7eb

--nc-radius-xs: 12px  --nc-radius-sm: 16px
--nc-radius-md: 24px  --nc-radius-xl: 100px

--nc-shadow-2: rgba(0,0,0,0.03) 0 -2px 16px -4px, rgba(0,0,0,0.08) 0 16px 40px -8px, rgba(0,0,0,0.04) 0 1px 3px 0
--nc-shadow-3: rgba(0,0,0,0.06) 0 4px 24px 0, rgba(0,0,0,0.04) 0 1px 2px 0
```

Classes utilitaires importantes :
- `.nc-page-halo` — fond `#f5f2f2` + gradient radial accent en `::before` fixed
- `.nc-shine-card` — bordure animée conic-gradient
- `.nc-blink-dot` — point rouge animé (blink 1.4s)
- `.nc-btn-shine` — shimmer sur bouton
- `.nc-mode-in` — animation entrée translateY(8px)→0

Logo Cloudinary : `https://res.cloudinary.com/dceobxyts/image/upload/v1777034233/Notion_Club_-_Black_-_Sans_BG_hcvk9k.png`
(déjà dans `next.config.ts` remotePatterns)

---

## Architecture (CONVENTIONS.md — règles strictes)

```
src/
  app/                    Routes Next.js
  modules/
    auth/                 Auth + profils + memberships (SEUL module avec code)
    formation/            (vide)
    community/            (vide)
    notion-sync/          (vide)
    coaching/             (vide)
    onboarding/           (vide)
  shared/
    components/ui/        shadcn/ui (ne pas modifier directement)
    components/           composants transversaux
    lib/                  utils, fonts, supabase clients
    fonts/                SF Pro Display .otf
```

**Règle d'isolation ESLint** : un module ne peut importer que son propre code, `@/shared/*`, ou des packages npm. Jamais un autre module.

---

## Flux applicatif actuel
```
/ → redirect /login
/login → (mock auth, n'importe quel email/mdp) → /dashboard
/dashboard → home page (mockée, zéro Supabase)
```

---

## Dashboard — état actuel

### Layout général (`src/app/dashboard/page.tsx`)
```tsx
<div className="nc-page-halo flex flex-col" style={{ minHeight: "100dvh" }}>
  <Topbar />                    {/* hidden md:flex sticky — desktop */}
  <div className="md:hidden">
    <MobileHeader />            {/* position: fixed, top */}
    <BottomNav />               {/* position: fixed, bottom pill */}
  </div>
  <main style={{ flex: 1 }}>
    {/* Desktop: greeting + search bar (max-width 840px centré) */}
    {/* Mobile: greeting + search bar statique */}
    {/* Grid widgets: grid-cols-1 md:grid-cols-2 */}
    <FormationWidget />
    <ProfilWidget />
    {/* Placeholder dashed "Communauté · Coaching · à venir" */}
  </main>
</div>
```

**Padding contenu** : `px-4 pt-[80px] pb-[100px] md:px-10 md:py-10`
(mobile: 80px top pour MobileHeader fixe, 100px bottom pour BottomNav)

---

## Composants dashboard créés

### `src/shared/components/dashboard/Topbar.tsx`
- `"use client"` — `usePathname()` pour état actif
- **Structure** : outer header `hidden md:flex justify-center sticky top-0 z-50`
  - `background: transparent; backdropFilter: blur(8px)` → gradient de page visible, pas de bande colorée
  - `padding: 10px 40px`
- **Pill intérieure** : `width: 100%; maxWidth: 840px; justify-content: space-between`
  - Gauche : logo Image Cloudinary (h-24px) + séparateur 0.5px + nav pills
  - Droite : cloche Bell (badge rouge `2` hardcodé) + avatar `TM` (#e0625a) + dropdown
- **Nav items** : `[Accueil, Formation, Communauté, Coaching]`
- **État actif** : `background: rgba(0,0,0,0.07); color: #000; font-weight: 600` (gris léger)
- **Hover inactif** : `rgba(0,0,0,0.04)`
- **Dropdown avatar** : Mon profil / Réglages / (séparateur) / Se déconnecter (#e0625a)
- MOCK_USER `{ prenom: "Théo", nom: "Martin" }`, UNREAD_COUNT `2`

### `src/shared/components/dashboard/mobile/MobileHeader.tsx`
- `"use client"` — `position: fixed; top: 0; height: 60px; z-index: 40`
- `background: rgba(255,255,255,0.88); backdropFilter: blur(16px)`
- Gauche : avatar initiales + "Bon retour / Théo" → clic ouvre dropdown (Mon profil, Réglages, Déconnexion)
- Droite : bouton Search (slide-down input animé) + bouton Bell (badge 2)
- MOCK_USER `{ prenom: "Théo", nom: "Martin", avatarUrl: null }`

### `src/shared/components/dashboard/mobile/BottomNav.tsx`
- `"use client"` — `position: fixed; bottom: 10px; left: 12px; right: 12px; height: 56px; z-index: 50`
- Pill : `background: rgba(255,255,255,0.92); backdropFilter: blur(20px); border-radius: 9999px`
- 4 items : Accueil (actif hardcodé) / Formation / Communauté / Coaching
- Actif : couleur `var(--color-brand)`, fond `rgba(224,98,90,0.08)`, border-radius pill
- `padding-bottom: env(safe-area-inset-bottom)` pour iPhone

### `src/shared/components/dashboard/widgets/FormationWidget.tsx`
- `"use client"` — `useRouter()` pour navigation
- Clic encadré → `/formation`, clic bouton "Reprendre" (stopPropagation) → `/formation/module-6/video-3`
- MOCK : Module 6, vidéo 3/5, 58%, 5/12 modules
- Hover : `translateY(-1px)` + shadow renforcée

### `src/shared/components/dashboard/widgets/ProfilWidget.tsx`
- Server Component (pas de `"use client"`)
- Badge niveau `rgba(224,98,90,0.08)` border `rgba(224,98,90,0.2)`
- MOCK : Niveau 6 Intermédiaire, 58%, 7 modules restants, status `in_progress`
- Conditionnel `in_progress` / `completed`

### `src/shared/components/dashboard/widgets/ProgressBar.tsx`
- Server Component — réutilisable (props: `percent`, `from?`, `to?`)
- Fill : `var(--color-brand)`, transition 0.6s

### `src/shared/components/dashboard/NotificationPopover.tsx`
- `"use client"` — 3 notifs mockées, toggle ouvert/fermé, "marquer tout lu"
- Click-outside via `useEffect + useRef`
- Branché sur le bouton cloche de la Sidebar (supprimée) mais PAS encore sur Topbar ni MobileHeader

---

## Sidebar — SUPPRIMÉE
`src/shared/components/dashboard/Sidebar.tsx` a été supprimé (git rm).
Remplacée par `Topbar.tsx` pour desktop.

---

## Décisions d'architecture actées

1. **Desktop (≥ md / 768px)** : Topbar horizontale sticky — PAS de sidebar verticale
2. **Mobile (< md)** : MobileHeader fixe top + BottomNav pill fixe bottom
3. **Breakpoint unique** : `md:` (768px) pour basculer desktop/mobile. Pas de `lg:` ou `xl:` dans cette session
4. **Sticky topbar** : doit être enfant direct du `flex flex-col` container pour que `sticky top-0` fonctionne sur toute la hauteur du scroll
5. **`hidden md:flex`** sur le `<header>` de Topbar directement (pas de wrapper div intermédiaire) pour préserver la sticky
6. **Nav items** : 4 items seulement — Accueil, Formation, Communauté, Coaching. "Ressources" et "Bibliothèque" supprimés
7. **État actif nav** : gris léger `rgba(0,0,0,0.07)` + texte noir (pas fond noir)
8. **Topbar fond** : transparent + `backdropFilter: blur(8px)` — pas de bande colorée
9. **Pill topbar** : `max-width: 840px` = largeur du contenu hero

---

## Ce qui reste à faire (non implémenté)
- Brancher `NotificationPopover` sur la cloche de Topbar et MobileHeader
- `usePathname()` pour état actif dynamique dans BottomNav (hardcodé sur /dashboard)
- Branchement Supabase (auth réelle, données réelles)
- Pages `/formation`, `/communaute`, `/coaching`
- `app/dashboard/layout.tsx` quand plusieurs pages dashboard existent

---

## Règles session en cours
- ❌ Zéro Supabase / logique auth
- ❌ Zéro API routes
- ❌ Zéro pages sous-sections (/formation etc.)
- ✅ Données mockées uniquement
- ✅ `useState` pour interactions UI
- ✅ `router.push()` statique
