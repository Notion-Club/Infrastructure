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

---

## Outil de feedback admin (widget intégré)

Repris tel quel de `theogouman/random-project` (branche `claude/setup-swiss-serenity-plus-Fm7s6`, projet Swiss Serenity Plus). Voir `extracted-feedback-widget/INTEGRATION.md` pour le dump brut d'origine + le graphe de dépendances complet.

### Emplacement dans le repo

```
src/shared/components/feedback-widget/
  FeedbackWidget.tsx           ← cœur (1208 LOC, 3 flows)
  FeedbackWidget.module.css
  FeedbackWidgetLoader.tsx     ← dynamic(ssr:false) wrapper
  CustomSelect/{tsx,module.css}
  RichTextEditor/{tsx,module.css}

src/app/api/
  feedback/route.ts            ← POST  → Notion DB (NOTION_DATABASE_ID)
  tickets/route.ts             ← GET (liste) / DELETE (archive) — même DB
  blog-posts/route.ts          ← POST  → Notion DB (NOTION_BLOG_DATABASE_ID)
```

Monté dans `src/app/(app)/layout.tsx` (donc visible uniquement après auth Supabase, pas sur `/login` ni `/signup`).

### Les 3 flows

1. **Feedback sur un élément** — mode inspection visuel : clic sur "Sélectionner un élément" → curseur crosshair + overlay highlight → clic sur n'importe quel élément de la page → l'élément est annoté (avec son ancre `#id` pour deep-link), choix d'une action (Modifier du texte, Ajouter du texte, Ajouter une image, Changer une couleur, Modifier la mise en page, Supprimer un élément, Ajouter un lien, Corriger une faute, Autre), saisie du retour, ajout au draft.
2. **Feedback général** — feedback page entière sans sélection.
3. **Création d'article de blog** — formulaire complet : titre, slug auto-généré, extrait, catégorie, tags, image cover (drag & drop), auteur, date de publication, temps de lecture, meta description SEO (validation 120-160 caractères), corps via éditeur rich-text (`<RichTextEditor>` — gras, italique, listes, séparateur via `document.execCommand`).

Vue grille des tickets déjà envoyés disponible depuis le hub (lecture/suppression directe via `/api/tickets`).

### Comment l'administrateur note rapidement dans le ticket de la roadmap

1. Naviguer sur n'importe quelle page du dashboard (le widget est disponible partout sous `(app)/`).
2. Cliquer sur le bouton flottant en bas à droite (avatar circulaire).
3. Choisir un des 3 flows selon le type de note :
   - **"Sélectionner un élément"** quand la modification porte sur un élément précis (un bouton, un titre, une image) — l'élément ciblé + son URL avec ancre sont envoyés à Notion.
   - **"Feedback général"** pour une note de page entière (cohérence, ordre des sections, etc.).
   - **"Nouvel article"** pour une note structurée avec titre + corps (utile pour les recettes UX/copy plus longues qui ne tiennent pas dans un retour court).
4. Rédiger, ajouter au draft. Plusieurs retours peuvent s'accumuler avant envoi.
5. "Envoyer" → un ticket est créé par retour dans la base Notion jointe, statut initial `À traiter`.
6. Onglet "Tickets envoyés" (icône grille) : voir/supprimer les tickets existants.

### Connexion à la base Notion

URL fournie en session par l'administrateur :

```
https://www.notion.so/gouman/c4209ec95e2b496888c843e6c4672eda?v=a981d5a0b73149c29454699f4f0ca8c3&source=copy_link
```

→ ID de la base (format UUID Notion) : `c4209ec9-5e2b-4968-88c8-43e6c4672eda`

À renseigner dans **`NOTION_BLOG_DATABASE_ID`** (variable consommée par `/api/blog-posts`) — flow "Nouvel article" du widget. Voir `.env.example` pour le détail des variables.

### Champs Notion attendus par le code (à créer/vérifier dans la base jointe)

Repris tels quels du code source, sans renommage.

**Base feedback/tickets** (consommée par `/api/feedback`, `/api/tickets` — `NOTION_DATABASE_ID`) :

| Propriété (libellé exact) | Type Notion | Valeurs |
|---|---|---|
| `Ticket` | Titre | auto : `[Élément ciblé] · [60 premiers char du retour]` |
| `Statut` | Select | `À traiter`, `En cours`, `Traité`, `Résolu`, `Refusé` |
| `Action` | Select | les 9 actions listées plus haut |
| `Élément ciblé` | Texte (rich_text) | nom de l'élément annoté |
| `Page concernée` | Select | un des libellés `PAGE_MAP` (Dashboard, Communauté, etc.) |
| `Retour client` | Texte (rich_text) | texte complet du retour |
| `Date soumission` | Date | ISO 8601 |
| `Session ID` | Texte (rich_text) | UUID v4 |
| `URL` | URL | deep-link `https://app.notionclub.fr/page#anchor` |

**Base articles de blog** (consommée par `/api/blog-posts` — `NOTION_BLOG_DATABASE_ID`, c'est cette base qui reçoit la base jointe) :

| Propriété | Type Notion | Notes |
|---|---|---|
| `Titre` | Titre | |
| `Statut` | Select | `Brouillon`, `À relire`, `Publié`, `Archivé` |
| `Slug` | Texte | |
| `Extrait` | Texte | |
| `Catégorie` | Select | cf. `BLOG_CATEGORY_OPTIONS` (5 valeurs Swiss Serenity, non adaptées — cf. ambiguïtés) |
| `Tags` | Multi-select | |
| `Image cover` | URL | |
| `Auteur` | Texte | default `"Mireille Dayer"` côté UI (non adapté — cf. ambiguïtés) |
| `Date de publication` | Date | |
| `Temps de lecture (min)` | Nombre | |
| `Meta description SEO` | Texte | validé 120-160 caractères côté UI |
| `Corps` | Texte | rich-text HTML produit par l'éditeur |

### Adaptations effectuées au code source

Conformément à la règle "ne rien inventer", seules deux modifications strictement nécessaires :

1. **Imports** dans `FeedbackWidget.tsx` : `../CustomSelect/...` → `./CustomSelect/...` (réorganisation dossier, sous-composants imbriqués dans `feedback-widget/`).
2. **`PAGE_MAP`** dans `FeedbackWidget.tsx` : remplacé par les routes réelles de NotionClub Infra (`/dashboard`, `/communaute`, `/coaching`, `/ressources`, `/settings`, `/login`, `/signup`, `/reset-password`, `/update-password`). Routes dynamiques (`/communaute/post/[id]`, `/ressources/ressource/[slug]`, etc.) retombent sur `"Home"` — comportement d'origine, **point à confirmer**.

### Points d'ambiguïté — laissés ouverts

À trancher par l'administrateur :

- **Variables d'env Notion** : faut-il fusionner `NOTION_TOKEN` (consommé par le widget) avec l'existant `NOTION_API_TOKEN` (Brique 4 — Notion sync, OPS-18) sur une seule intégration Notion, ou garder deux intégrations distinctes ?
- **Base unique ou deux bases** : le widget original utilise deux bases (feedback + blog). Une seule base est jointe par l'administrateur (ID `c4209ec9-5e2b-4968-88c8-43e6c4672eda`). Faut-il :
  - pointer uniquement `NOTION_BLOG_DATABASE_ID` dessus (le flow "Nouvel article" suffit-il à la roadmap UX/copy ?), ou
  - pointer aussi `NOTION_DATABASE_ID` dessus en s'assurant que les champs des 2 schémas coexistent dans la base jointe, ou
  - créer une seconde base dédiée aux flows "feedback élément" et "feedback général" ?
- **Constantes non adaptées dans `FeedbackWidget.tsx`** (laissées verbatim faute d'équivalent NotionClub fourni) :
  - `SITE_DOMAIN = "swiss-serenity-plus.ch"` (l. 28) — apparaît dans la prévisualisation du slug du flow blog.
  - `AVATAR_URL = "https://res.cloudinary.com/.../Avatar_zc0wae.jpg"` (l. 30-31) — avatar Mireille dans le bouton trigger.
  - `setBlogAuthor("Mireille Dayer")` (l. 233, 592) — auteur par défaut du formulaire blog.
  - `aria-label="Outil de retours Mireille"` (l. 674) — libellé d'accessibilité du modal.
  - `BLOG_CATEGORY_OPTIONS` (l. 18-24) — catégories Swiss Serenity (`conseils-dirigeants`, `temoignages`, `actualites`, `ressources-particuliers`, `autre`).
  - `STATUS_COLORS` (l. 72-78) — palette `À traiter / En cours / Traité / Résolu / Refusé`, **a priori OK** pour NotionClub.
- **Gating admin** : le widget est aujourd'hui monté pour **tous les utilisateurs authentifiés** via `(app)/layout.tsx`. À restreindre aux administrateurs ? Si oui, sur quel critère (rôle Supabase, email allowlist, env var) ?
- **Thème sombre** : le widget hardcode des couleurs claires (palette feedback d'origine). Le projet utilise `next-themes` ; l'apparence en mode dark n'a pas été ajustée.
- **Routes dynamiques manquantes dans `PAGE_MAP`** : `/communaute/post/[id]`, `/ressources/ressource/[slug]`, `/ressources/template/[slug]` → tous ces deep-links remonteront avec `Page concernée = "Home"` dans Notion.

### Setup à effectuer côté Vercel/Notion

1. Créer (ou réutiliser) une intégration Notion sur https://www.notion.so/my-integrations — capability `Insert content` minimum, `Read content` aussi si on veut activer la vue grille des tickets envoyés.
2. Connecter l'intégration à la base jointe : ouvrir la base → `...` → `Connections` → ajouter l'intégration.
3. Renseigner les variables d'env sur Vercel (Production + Preview + Development) :
   - `NOTION_TOKEN` (token `ntn_…` ou `secret_…` de l'intégration)
   - `NOTION_BLOG_DATABASE_ID=c4209ec9-5e2b-4968-88c8-43e6c4672eda`
   - `NOTION_DATABASE_ID=` (laissé vide tant que la décision "base unique vs deux bases" n'est pas tranchée — flow "feedback élément/général" cassera tant que cette variable est manquante)
4. Tester en local avec `vercel dev` (les env Vercel sont injectées automatiquement) ou en posant les valeurs dans `.env.local`.
