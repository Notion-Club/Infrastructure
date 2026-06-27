# Morph /Ressources — transition d'ouverture des cartes

Point d'entrée canonique pour la transition « carte → détail » de la section
**/Ressources** (ressources **et** templates). À lire avant toute modification de
l'overlay, des cartes, ou des pages détail.

Reproduction web de la *zoom transition* iOS 18
(réf. <https://douglashill.co/zoom-transitions/>) : la carte cliquée **grandit
en place** jusqu'à un encadré de détail, par-dessus une grille **restée figée**.

---

## TL;DR mécanique

- **Aucune navigation** au clic : un overlay s'ouvre **en place**, en portail sur
  `document.body`. La grille n'est jamais démontée → fond statique, fermeture
  sans re-cascade.
- **Donnée déjà en mémoire** : la grille porte tout (les ressources embarquent
  leur `content[]`, les templates leur `urlTella`/`urlNotionPublicPage`). Zéro
  re-fetch, zéro `loading.tsx`, zéro skeleton à l'ouverture.
- **Morph WAAPI** : la *surface* clippée morphe (largeur/hauteur/translate/
  border-radius, **pas** de scale → coins lisses) sur un ressort critique
  (`linear()`, sans overshoot) ; les contenus se croisent en *fade-through* à gap
  (sortant entièrement parti avant l'entrant) ; un **titre continu** (hero)
  voyage de la carte vers l'encadré.

---

## Carte des fichiers

```
src/modules/ressources/components/
  morph/
    MorphSourceContext.tsx   ← contrôleur : state open/close + rend l'overlay
    ResourceMorphOverlay.tsx ← l'overlay (morph WAAPI, a11y, body, fermeture)
  shared/
    renderBlock.tsx          ← rendu d'un bloc Notion — SOURCE UNIQUE
    ResourceContentBody.tsx  ← corps ressource (accès + blocs/verrou) — SOURCE UNIQUE
  ResourceCard.tsx           ← carte ressource : clic → open() en place
  TemplateCard.tsx           ← carte template : clic → open() en place
  lib/spring.ts              ← courbe ressort `linear()` + durées + easings fade

src/app/(app)/ressources/
  layout.tsx                 ← <MorphSourceProvider> (plus de slot @modal)
  ressource/[slug]/page.tsx  ← vraie page détail (accès direct / refresh / cmd-clic)
  template/[slug]/page.tsx   ← idem templates

src/app/lab/morph/           ← harnais e2e dev-only (mock data), cf. Tests
e2e/run-morph.mjs            ← runner Playwright (build prod → next start → 7 assertions)
.github/workflows/e2e-morph.yml
```

---

## Contrat & flux

1. **Clic gauche simple** sur une carte (`ResourceCard`/`TemplateCard`) :
   `e.preventDefault()` puis `open({ item, cardRect, titleRect, triggerEl })`.
   Cmd/Ctrl/Maj/Alt/clic-milieu : **pas** de `preventDefault` → le navigateur
   suit le `href` (vraie page, nouvel onglet).
2. `MorphSourceProvider` pose `source` dans son state et rend
   `<ResourceMorphOverlay key={source.item.slug} … />`. Le **`key={slug}`** garantit
   un overlay **neuf par item** → aucun résidu d'animation précédente.
3. L'overlay lit la donnée dans `source` (Resource **ou** Template), joue le morph
   d'ouverture (`useLayoutEffect`), puis devient interactif.
4. **Fermeture** (croix / Échap / clic backdrop / bouton retour) : l'overlay joue
   le morph inverse PUIS appelle `onClose()` → le provider met `source = null` →
   démontage. La fermeture a donc le temps de jouer.

`MorphSource = { item, cardRect, titleRect, triggerEl? }` (cf.
`MorphSourceContext.tsx`).

---

## Détails à connaître avant de toucher

- **WAAPI / offsets** : toute keyframe d'**opacité** doit aller explicitement
  jusqu'à `offset: 1`. WAAPI ne tient pas une propriété au-delà de son dernier
  offset < 1 → la valeur dérive vers la base (c'était la cause d'un bug de
  doublage/inversion historique). Les transforms aussi spannent `[0, 1]`.
- **Coins lisses** : on anime `width/height/border-radius` directement (FLIP),
  **jamais** un `scale` non-uniforme (qui déformerait les arrondis).
- **`isolation`/`position:fixed`** : l'overlay est en `createPortal` sur
  `document.body` pour échapper à l'`isolation: isolate` de `.nc-page-halo`.
- **Fond** : `pageBg` réplique `.nc-app-bg` (échantillonné au runtime) → fond
  opaque qui masque la grille (pas d'effet « pop-up »).
- **Scroll-lock NON déplaçant** : pendant l'ouverture, `overflow: hidden` sur
  `html`/`body` **sans** `position: fixed` et **sans** `scrollTo`. La position de
  scroll n'est **jamais** modifiée → à la fermeture la grille reste exactement où
  elle était. Le fond reste figé via `touch-action: none` (backdrop) +
  `overscroll-behavior: contain` (surface).
  > ⚠️ Ne **pas** revenir au verrou `position: fixed; top: -scrollY` : il
  > déplaçait le document (saut de scroll haut→bas à la fermeture) et reflowait
  > le viewport/safe-area iOS (la BottomNav tressautait). Cf. #249.
- **Bouton retour (mobile/PWA)** : `history.pushState` à la **même URL** à
  l'ouverture + `popstate` → ferme l'overlay. Aucune navigation Next, aucun
  désync de routeur. On force `history.scrollRestoration = 'manual'` pendant
  l'overlay → le `history.back()` de fermeture ne restaure pas le scroll de
  l'entrée précédente (sinon retour en haut de page).

---

## Accessibilité

- La **surface** porte `role="dialog"`, `aria-modal="true"`,
  `aria-label = titre`, `tabindex=-1`.
- **Ouverture** : le focus entre dans le dialogue (annonce du titre).
- **Focus-trap** : Tab / Shift+Tab bouclent dans la surface (jamais vers la
  grille gelée).
- **Fermeture** : le focus revient sur la carte déclencheuse (`triggerEl`)
  **uniquement si l'ouverture était au clavier** (`viaKeyboard = e.detail === 0`).
  En souris/tactile on ne refocalise pas → pas d'encadré bleu de sélection iOS
  (cf. #249). `-webkit-tap-highlight-color: transparent` sur les cartes en
  complément.
- `prefers-reduced-motion` : morph désactivé, états finaux posés directement.

---

## Une seule source pour le contenu

Le rendu du contenu Notion ne doit **jamais** être dupliqué :

- `shared/renderBlock.tsx` — rendu d'un bloc (`heading`, `paragraph`, `list`,
  `callout`, `quote`, `code`, `tella_embed`, `image`).
- `shared/ResourceContentBody.tsx` — corps d'une ressource (séparateur + blocs
  **ou** `CapabilityLock` selon `canAccess`).

L'overlay **et** la vraie page détail importent ces deux modules. Fonctions
**pures, sans dépendance serveur** → utilisables serveur ET client sans
`'use client'`.

---

## Tests (filet de fiabilité)

La preview étant inaccessible (mur d'auth), la mécanique est prouvée par un test
e2e qui exerce le **code réel** de l'overlay sur des données mockées.

```bash
npm run e2e:morph            # build prod → next start → 9 assertions chromium
E2E_SKIP_BUILD=1 npm run e2e:morph   # ré-itération rapide (réutilise .next)
```

- Route `src/app/lab/morph` : **dev-only** (gatée `VERCEL_ENV=production`, hors
  `(app)`), monte la vraie grille + overlay sur 4 items mockés.
- `e2e/run-morph.mjs` : **aucun secret** (Notion 401 → `[]`, Supabase factice).
  On teste un **build de prod + `next start`** car l'hydratation sous `next dev`
  n'aboutit pas derrière le proxy Supabase. Le runner libère le port avant de
  démarrer (sinon un serveur fantôme d'un run précédent sert des chunks périmés).
- **9 assertions** : ouverture (titre + contenu), focus dans le dialogue,
  focus-trap, fermeture (zéro résidu), **multi-cartes** (le bug d'origine),
  verrou d'accès, resize, **scroll préservé à l'ouverture/fermeture** (#249),
  **focus restitué après ouverture clavier** (#249).
- CI : `.github/workflows/e2e-morph.yml` sur chaque PR touchant `/ressources`
  (Playwright installé à la volée, hors deps repo).

---

## Limites connues / à faire

- **Resize / rotation pendant l'ouverture** : la géométrie de fin est figée en
  px (`fill: both`) → tourner l'écran overlay ouvert ne re-dimensionne pas la
  surface. Edge-case rare, non corrigé.
- **Scroll-document** : **statu quo décidé** — le corps long scrolle **dans** la
  surface (capée en hauteur). Le passage à un scroll au fil du document
  (encadré plein écran) reste possible mais changerait la **cible visuelle** du
  morph → à cadrer d'abord dans le harnais `/lab/morph` si on le réactive.
- **View Transition** : retiré de /ressources (inerte) ; reste **app-wide**
  (communauté/formation/réglages) via `next.config` + CSS global — ne pas y
  toucher depuis ce périmètre.

---

## Historique

| PR | Apport |
|----|--------|
| #241 | Bascule en overlay client (fin de l'empilement, morph sur toute la grille) |
| #242 | Source unique du corps détail + retrait du View Transition mort |
| #244 | Accessibilité : focus-trap, focus restitué, dialogue ARIA |
| #247 | Filet e2e Playwright (7/7) + CI |
| #248 | Doc archi (ce fichier) |
| #249 | Fix fermeture : scroll figé (verrou non déplaçant + scrollRestoration manual), fin de l'encadré iOS (focus clavier-only) et du tressaut de la BottomNav ; e2e 9/9 |
