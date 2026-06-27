# Contexte projet — NotionClub Infra

> ⚠️ **Document partiellement historique.** Ce fichier a été écrit au début du
> projet (session « home page »). La **section design-system / tokens / patterns
> de page ci-dessous reste valide** et utile. En revanche les sections décrivant
> l'« état applicatif » (flux, règles de session « tout mocké ») étaient liées à
> la première itération et ont depuis été **dépassées** : l'app a une auth
> Supabase réelle, des route handlers, et toutes les sous-sections
> (formation, communauté, coaching, ressources, réglages, membres) sont
> implémentées. **Pour l'état réel et courant, se référer à `README.md` et
> `AGENTS.md`.** Les blocs périmés sont signalés `(HISTORIQUE)` ci-dessous.

## Branche active
Variable selon la tâche en cours (chaque session/feature a sa propre branche
`claude/...`). Ne pas se fier à une branche figée ici.

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

## Flux applicatif (HISTORIQUE — première itération)
```
/ → redirect /login
/login → (mock auth, n'importe quel email/mdp) → /dashboard
/dashboard → home page (mockée, zéro Supabase)
```
> ⚠️ **Périmé.** L'auth est désormais **réelle (Supabase)** : `(auth)/login`,
> `signup`, `reset-password`, `update-password`, callback OAuth Google, et le
> groupe `(app)/` est protégé. Voir `README.md` pour le flux à jour.

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

1. **Desktop (≥ md / 768px)** : Topbar horizontale **fixed** — PAS de sidebar verticale
2. **Mobile (< md)** : MobileTopActions fixe top-right + BottomNav pill fixe bottom
3. **Breakpoint unique** : `md:` (768px) pour basculer desktop/mobile. Pas de `lg:` ou `xl:` dans cette session
4. **`hidden md:flex`** sur le `<header>` de Topbar directement
5. **Nav items** : Accueil, Formation, Communauté, Coaching, Ressources
6. **État actif nav** : gris léger `rgba(0,0,0,0.07)` + texte noir (pas fond noir)
7. **Topbar fond** : transparent + `backdropFilter: blur(8px)` — pas de bande colorée
8. **Pill topbar** : `max-width: 920px`

### Règle de positionnement — toutes les pages

> **La cloche de notifications et l'avatar utilisateur ne doivent JAMAIS suivre le scroll.**
> - Desktop : `Topbar` en `position: fixed; top: 0; left: 0; right: 0` — la cloche et l'avatar sont dans cette topbar fixe.
> - Mobile : `MobileTopActions` en `position: fixed; top: 12px; right: 12px` — boutons flottants indépendants du scroll.
> - Conséquence : tout contenu de page doit compenser avec `md:pt-[96px]` (desktop) et `pt-[72px]` (mobile).

### Pattern de page standard

⚠️ **Règle critique** : `Topbar`, `MobileTopActions` et `BottomNav` doivent être rendus **en dehors** du div `nc-page-halo`. En effet, `nc-page-halo` a `isolation: isolate` qui peut casser `position: fixed` dans certains navigateurs.

```tsx
<>
  {/* Éléments fixed HORS de nc-page-halo */}
  <Topbar />
  <div className="md:hidden">
    <MobileTopActions />
    <BottomNav />
  </div>

  <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
    <main style={{ position: "relative", zIndex: 1 }}>
      <div className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10">
        {/* contenu */}
      </div>
    </main>
  </div>
</>
```

---

## Ce qui restait à faire (HISTORIQUE — désormais largement livré)
Cette liste datait de la première itération. La plupart est faite :
`NotificationPopover` est branché sur Topbar + MobileTopActions, l'auth
Supabase réelle est en place, et les pages `/formation`, `/communaute`,
`/coaching`, `/ressources`, `/settings`, `/membres` existent. Pour le
backlog réel, se référer aux issues/PR du repo.

---

## Règles session (HISTORIQUE — ne plus appliquer telles quelles)
> ⚠️ Ces règles valaient pour la **première session** (maquette home page).
> Elles sont **caduques** : l'app utilise aujourd'hui Supabase (auth + données),
> des route handlers, et des Server Actions. Ne pas les prendre comme
> contraintes actuelles. Conventions à jour : `AGENTS.md` + `CONVENTIONS.md`.
- ❌ ~~Zéro Supabase / logique auth~~ → auth + données Supabase réelles
- ❌ ~~Zéro API routes~~ → nombreux route handlers (`src/app/api/*`)
- ❌ ~~Zéro pages sous-sections~~ → toutes les sous-sections sont implémentées
- Quelques zones restent mockées (feed communauté via `mocks/posts.mock`,
  données réglages de démo) — voir README.

---

## Outil de feedback admin (widget intégré)

> 📘 **Point d'entrée canonique** : [`docs/feedback-widget/README.md`](../docs/feedback-widget/README.md) — recap complet, prompt de reprise de contexte, journal des commits, ambiguïtés ouvertes, next steps.

Origine : repris de `theogouman/random-project` (Swiss Serenity Plus), simplifié pour ne garder que les 2 flows de feedback utiles à NotionClub. Le flow "Création d'article de blog" + ses dépendances (`CustomSelect`, `RichTextEditor`, route `/api/blog-posts`) ont été supprimés.

### Emplacement dans le repo

```
src/shared/components/feedback-widget/
  FeedbackWidget.tsx           ← cœur — 2 flows
  FeedbackWidget.module.css
  FeedbackWidgetLoader.tsx     ← dynamic(ssr:false) wrapper

src/app/api/
  feedback/route.ts            ← POST  → Notion DB (NOTION_DATABASE_ID)
  tickets/route.ts             ← GET (liste) / DELETE (archive) — même DB
```

Monté dans `src/app/(app)/layout.tsx` (visible uniquement après auth Supabase, pas sur `/login` ni `/signup`).

### Les 2 flows

1. **Feedback sur un élément** — mode inspection visuel : clic sur "Sélectionner un élément" → curseur crosshair + overlay highlight brand → clic sur n'importe quel élément de la page → l'élément est annoté (avec son ancre `#id` pour deep-link), choix d'une action parmi 9 (Modifier du texte, Ajouter du texte, Ajouter une image, Changer une couleur, Modifier la mise en page, Supprimer un élément, Ajouter un lien, Corriger une faute, Autre), choix du côté (Frontend ou Backend, optionnel), saisie du retour, ajout au draft.
2. **Feedback général** — feedback page entière sans sélection (même formulaire, Action optionnelle).

Vue grille des tickets déjà envoyés disponible depuis le hub (lecture/suppression directe via `/api/tickets`).

### Comment l'administrateur note rapidement dans le ticket de la roadmap

1. Naviguer sur n'importe quelle page du dashboard (le widget est disponible partout sous `(app)/`).
2. Cliquer sur le bouton flottant en bas à droite.
3. Choisir un des 2 flows :
   - **"Retour sur un élément"** quand la modification porte sur un bloc précis — Composant + URL avec ancre envoyés à Notion.
   - **"Feedback général"** pour une note de page entière.
4. Cocher éventuellement Frontend / Backend pour cibler la stack.
5. Rédiger, ajouter au draft. Plusieurs retours peuvent s'accumuler avant envoi.
6. "Envoyer" → un ticket est créé par retour dans la base Notion jointe.
7. Onglet "Tickets envoyés" (icône grille) : voir/supprimer les tickets existants.

### Connexion à la base Notion

URL fournie en session par l'administrateur :

```
https://www.notion.so/gouman/c4209ec95e2b496888c843e6c4672eda?v=a981d5a0b73149c29454699f4f0ca8c3&source=copy_link
```

→ ID de la base (format UUID Notion) : `c4209ec9-5e2b-4968-88c8-43e6c4672eda`

ID hardcodé comme défaut dans les 2 routes (`/api/feedback`, `/api/tickets`). `NOTION_API_TOKEN` existante (Brique 4 Notion sync) suffit. Voir `.env.example` pour le détail.

### Schéma de la base Notion roadmap (5 propriétés + /End)

Le code écrit/lit exactement ce que contient la base aujourd'hui — pas plus, pas moins. Tout écart provoquera une erreur `validation_error` Notion.

| Propriété (libellé exact) | Type Notion | Source côté code |
|---|---|---|
| `Composant` | Select | nom du bloc annoté (auto-clip à 100 chars, virgules → espaces) |
| `Action` | Select | une des 9 actions du formulaire |
| `/End` | Select | `Frontend` ou `Backend` (optionnel) |
| `Feedback` | Texte (rich_text) | texte du retour (clip 2000 chars en property, débordement écrit en blocs paragraphes dans le body) |
| `User Agent` | Texte (rich_text) | header HTTP côté serveur — pour distinguer mobile / desktop |
| `URL` | URL | deep-link `https://app.notionclub.fr/page#anchor` |

Notion auto-crée les options de Select au premier write — pas besoin de seeder la base.

### Adaptations effectuées au code source

1. **Suppression flow blog** : route `/api/blog-posts`, composants `CustomSelect` + `RichTextEditor`, formulaire complet + CSS associé. Le widget ne porte plus que les 2 flows de feedback.
2. **`PAGE_MAP`** dans `FeedbackWidget.tsx` : routes NC réelles. Routes dynamiques retombent sur `"Home"` (note : `Page concernée` n'est plus écrit côté Notion — propriété absente du schéma actuel).
3. **Palette CSS alignée DA NotionClub** : `FeedbackWidget.module.css` réécrit sur les tokens du projet (`--color-brand`, `--color-text-*`, `--color-surface-*`, `--color-border-default`, `--nc-radius-*`, `--nc-shadow-2/3`, `--nc-ease`, `--nc-duration-*`). Pattern hover lift `translateY(-2px)` + border brand-tinted + halo dot pattern repris du `FormationWidget`.
4. **Trigger** : icône Lucide `<MessageSquarePlus>` sur fond brand, halo pulse au hover.
5. **Overlay sélection** : couleurs brand `rgba(224,98,90,…)` au lieu du taupe Swiss-Serenity original.

### Points d'ambiguïté — laissés ouverts

Décisions tranchées :
- **Token Notion unifié** : les routes consomment `NOTION_API_TOKEN` (variable existante de la Brique 4 Notion sync).
- **Base Notion unique** : `c4209ec9-5e2b-4968-88c8-43e6c4672eda` hardcodée comme défaut. Schéma : voir tableau ci-dessus.
- **Pas de blog dans le widget** : `outil pour faire des articles de blog` retiré (cf. session 2026-05-22).

Restant ouvert :
- **Gating admin** : le widget est aujourd'hui monté pour **tous les utilisateurs authentifiés** via `(app)/layout.tsx`. À restreindre aux administrateurs ? Si oui, sur quel critère (rôle Supabase, email allowlist, env var) ?
- **Thème sombre** : palette alignée sur le light theme NC. Le projet utilise `next-themes` ; l'apparence en mode dark n'a pas encore été testée.

### Setup à effectuer côté Vercel/Notion

1. Vérifier que l'intégration Notion liée à `NOTION_API_TOKEN` est connectée à la base "ticket roadmap" (`c4209ec9-...`) : ouvrir la base → `...` → `Connections` → ajouter l'intégration. **Sans cette étape, Notion renvoie un 404 "object_not_found".**
2. S'assurer que la base contient les 6 propriétés du tableau ci-dessus (Composant / Action / /End / Feedback / User Agent / URL) — les options des Select sont auto-créées au premier write.
3. `NOTION_API_TOKEN` est déjà configurée côté Vercel (Brique 4 Notion sync). Aucune nouvelle var requise.
4. `NOTION_DATABASE_ID` reste dispo en override optionnel (preview/staging vers une base de test).
