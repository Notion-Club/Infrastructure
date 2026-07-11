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
    MorphSourceContext.tsx   ← contrôleur : snapshot liste+index, open/close, rend l'overlay
    ResourceMorphOverlay.tsx ← l'overlay (morph WAAPI, gestes, a11y, body, fermeture)
  shared/
    ResourceContentBody.tsx  ← corps ressource (accès + NotionRenderer/verrou) — SOURCE UNIQUE
  ResourceCard.tsx           ← carte ressource : clic → open() en place
  TemplateCard.tsx           ← carte template : clic → open() en place
  lib/spring.ts              ← courbe ressort `linear()` + durées + easings fade

src/shared/components/notion/
  NotionRenderer.tsx         ← rendu Notion UNIFIÉ (app-wide) — importé par ResourceContentBody
  server/getResourceBody.ts  ← (module ressources) Server Action : corps async d'une ressource

src/app/(app)/ressources/
  layout.tsx                 ← <MorphSourceProvider> (plus de slot @modal)
  ressource/[slug]/page.tsx  ← vraie page détail (accès direct / refresh / cmd-clic)
  template/[slug]/page.tsx   ← idem templates

src/app/lab/morph/           ← harnais e2e dev-only (mock data), cf. Tests
e2e/run-morph.mjs            ← runner Playwright (build prod → next start → assertions)
.github/workflows/e2e-morph.yml
```

> **Rendu Notion** : le contenu n'est **plus** rendu par un `renderBlock.tsx`
> propre au module (supprimé). Il est délégué au renderer unifié
> `@/shared/components/notion/NotionRenderer`, importé par
> `shared/ResourceContentBody.tsx`. Voir « Une seule source pour le contenu ».

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

## Gestes tactiles (mobile / PWA)

L'overlay **reste monté toute la session d'ouverture** et navigue **en interne**
(seul l'`index` dans la liste change) — il ne se remonte jamais. Le provider fige
à l'ouverture un **snapshot** de la liste visible ordonnée (`items`) + l'index de
départ (`initialIndex`) : la grille est couverte, donc la liste ne peut plus
bouger.

### En-tête d'intention (le gros commentaire du fichier)

Le bloc de commentaire en tête de `ResourceMorphOverlay.tsx` est la carte
mentale à lire en premier : il décrit le **scroll-document** (l'encadré fait la
longueur du contenu, relâché en flux après l'ouverture) **et** les deux gestes
ci-dessous. Le garder synchronisé avec le code.

### Reconnaisseur d'axe unique

Un **seul** reconnaisseur tactile arbitre les deux gestes (listeners `touchstart/
move/end/cancel` non-passifs sur le conteneur de scroll) :

- Le geste ne démarre que si le doigt part **sur la surface** (le fond garde son
  tap-to-close par pointer events).
- L'axe est **verrouillé après `AXIS_LOCK` (10px)** parcourus (`Math.hypot`).
  `|dx| > |dy|` → axe **horizontal** (carrousel) ; sinon axe **vertical**.
- Sur l'axe vertical, on ne prend la main **qu'au bord** (`atTop()` + pull vers
  le bas, ou `atBottom()` + pull vers le haut). Hors bord → on **lâche le geste**
  (`g = null`) et le **scroll vertical natif reste intact** (`touch-action:
  pan-y` : le navigateur garde la verticale, on ne s'empare que de l'horizontale).

### Carrousel swipe ±1 (panneau ghost + préchargement)

Swipe **horizontal** → ressource/template **±1** (gauche = suivant, droite =
précédent), en « carrousel Tinder » :

- La **piste** (`trackRef`) suit le doigt (`translateX`) ; un **panneau voisin
  (ghost)** est monté à la volée à côté (`PANEL_GAP = 16px`), rendu **identique à
  la surface au repos** (`SURFACE_BOX_STYLE` partagé → parité pixel au swap). Le
  ghost porte **son propre item** (snapshot) → il ne change pas quand `index`
  change.
- **Butée élastique** aux extrémités (`EDGE_RESIST = 0.35`) quand il n'y a pas de
  voisin.
- **Validation** à la fin du geste : distance `> 30 %` de la largeur
  (`H_COMMIT_RATIO`) **ou** flick (`|vx| > H_COMMIT_VELOCITY = 0.5 px/ms` dans le
  bon sens) → `commitCarousel`, sinon `revertCarousel` (retour à 0).
- **Swap sans couture** : `commitCarousel` anime la piste jusqu'au panneau voisin,
  puis bascule l'item de la surface en `flushSync(setIndex)` **pendant** que la
  piste est encore décalée (le centre montre le même item avant/après → aucun
  flash), puis remet la piste à `none` et recalcule la géométrie de fermeture sur
  le nouveau slug.
- **Préchargement des voisins** : `bodyCache` (state par slug) + `ensureBody`
  pré-chargent le corps de l'item courant **et de ses ±1** à chaque changement
  d'index (`inFlightRef` dédoublonne) → le panneau qui arrive montre skeleton puis
  contenu sans attente.
- Au clavier, `←` / `→` naviguent aussi (mêmes bornes).

### Pull-to-close vertical au bord

Pull **vertical au bord** (haut→bas en haut de page, bas→haut en bas de page) →
**fermeture par le MÊME morph retour** vers la carte de l'item **courant** :

- La surface suit le doigt (`translateY`, amortie), le `pageBg` **se dé-fade**
  avec la distance.
- Pas de `preventDefault` : au bord il n'y a rien à scroller
  (`overscroll-behavior: contain` gèle le rubber-band), on lit passivement.
- **Validation** : distance `> V_CLOSE_DISTANCE (100px)` **ou** flick
  (`|vy| > V_CLOSE_VELOCITY = 0.5 px/ms`) → `startClose(pullY)` démarre le morph
  inverse **depuis** l'offset de pull (aucun saut) ; sinon `revertPull` ramène la
  surface et le fond.

### Fix PWA iOS #258 — la piste ne doit NI être positionnée NI transformée pendant le morph

C'est le piège central à ne jamais rouvrir. Un `position: relative` **ou** un
`transform` sur la **piste** en fait un **bloc conteneur** qui **piège le
`position: fixed`** de la surface pendant le morph : en PWA iOS, la fermeture
après scroll faisait **rétrécir l'encadré hors écran**.

Parades, toutes **synchrones** et cumulées :

- La piste n'est `relative` **que pendant un drag** (ghost monté) ; **hors drag
  elle est `static`** (`transform: none`, pas `0px`) → l'ancêtrage redevient
  identique à la version validée (surface → wrapper statique → scroller `fixed`).
  Le drag et le morph ne se chevauchent jamais.
- Au tout début de `startClose`, on **remet la piste en `static` / `none`**
  avant toute mesure.
- On **dé-piège aussi le scroller** (le layer momentum d'un conteneur scrollable
  iOS ancre le `fixed` au **contenu**, pas au viewport) : `scrollTop = 0`,
  `-webkit-overflow-scrolling: auto`, `overflow-y: hidden`, flush synchrone.
- **Auto-correction anti-piège** : après ré-ancrage de la surface en `fixed`
  (état d'ouverture, scroll 0), on **relit** son `getBoundingClientRect()` avec
  une transform **neutre** ; si le `top`/`left` réel dévie de la cible (`> 0.5px`,
  signe que le `fixed` a été piégé), on **compense** `top`/`left` du delta mesuré
  avant de lancer le morph inverse.

Voir les commits `2df5fdd` (carrousel + pull-to-close), `0de9761` (piste `static`
hors drag), `9fc26c5` (dé-piège du `fixed`), `20c7e3f` (auto-correction).

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

Le rendu du contenu Notion ne doit **jamais** être dupliqué. L'ancien
`shared/renderBlock.tsx` (rendu bloc-par-bloc propre au module, « lossy ») a été
**supprimé** : le rendu est désormais délégué au **renderer Notion unifié**,
partagé avec Formation / Coaching.

- `@/shared/components/notion/NotionRenderer` — rendu de l'arbre `NotionBlock`
  complet (texte + annotations inline, médias, toggle/callout/quote, colonnes,
  table, divider…). Export alias `NotionBlocks` conservé pour compat. C'est LA
  source de rendu app-wide ; ne pas réintroduire de renderer local.
- `shared/ResourceContentBody.tsx` — corps d'une ressource : séparateur +
  `<NotionRenderer blocks={resource.content} />` **ou** `CapabilityLock` selon
  la prop `hasAccess` (calculée par l'appelant à partir des vraies capabilities
  Supabase — cf. `docs/ressources/README.md`). Garde contenu-vide : si
  `resource.content` est vide (l'overlay le
  réutilise avec une ressource issue de la LISTE, body non chargé), rend un
  wrapper vide plutôt que le message « pas de corps » — parité exacte avec
  l'ancien `[].map(renderBlock)`.

L'overlay **et** la vraie page détail importent `ResourceContentBody` → la
logique d'accès et le rendu du corps ne peuvent plus diverger. `NotionRenderer`
est un composant client (`'use client'`) ; `ResourceContentBody` reste une
fonction pure sans dépendance serveur.

---

## Tests (filet de fiabilité)

La preview étant inaccessible (mur d'auth), la mécanique est prouvée par un test
e2e qui exerce le **code réel** de l'overlay sur des données mockées.

```bash
npm run e2e:morph            # build prod → next start → 10 assertions chromium
E2E_SKIP_BUILD=1 npm run e2e:morph   # ré-itération rapide (réutilise .next)
```

- Route `src/app/lab/morph` : **dev-only** (gatée `VERCEL_ENV=production`, hors
  `(app)`), monte la vraie grille + overlay sur 4 items mockés.
- `e2e/run-morph.mjs` : **aucun secret** (Notion 401 → `[]`, Supabase factice).
  On teste un **build de prod + `next start`** car l'hydratation sous `next dev`
  n'aboutit pas derrière le proxy Supabase. Le runner libère le port avant de
  démarrer (sinon un serveur fantôme d'un run précédent sert des chunks périmés).
- **10 assertions** : ouverture (titre + contenu), focus dans le dialogue,
  focus-trap, fermeture (zéro résidu), **multi-cartes** (le bug d'origine),
  verrou d'accès, resize, **scroll préservé à l'ouverture/fermeture** (#249),
  **focus restitué après ouverture clavier** (#249), **scroll-document** (titre
  + croix qui défilent avec la carte, contenu défilable).
- CI : `.github/workflows/e2e-morph.yml` sur chaque PR touchant `/ressources`
  (Playwright installé à la volée, hors deps repo).

---

## Limites connues / à faire

- **Resize / rotation pendant l'ouverture** : la géométrie de fin est figée en
  px (`fill: both`) → tourner l'écran overlay ouvert ne re-dimensionne pas la
  surface. Edge-case rare, non corrigé.
- **Scroll-document** : ✅ **implémenté**. L'encadré fait la longueur du contenu
  (pas de scroll interne) et défile dans un conteneur dédié plein écran
  (`scrollRef`). Mécanique : pendant le morph la surface est `position: fixed`
  (géométrie au pixel) ; à la fin de l'ouverture elle est **relâchée en flux**
  (`position: relative`) dans le conteneur (le `release()`). Le **titre** (vrai
  `<h1>`, le hero s'efface) ET la **croix** sont **ancrés à la carte** → ils
  défilent avec elle (visibles en haut seulement). Fermeture : retour en haut du
  conteneur (`scrollTo(0,0)`) + ré-ancrage en `fixed` → morph inverse depuis la
  géométrie d'ouverture.
  > ⚠️ La surface ne porte **aucune** propriété de layout via le prop React
  > (position/width/height/overflow/border-radius/top/left/transform) : tout est
  > inline JS, sinon un re-render (arrivée async du body) réinitialiserait la
  > géométrie en plein morph.
- **Fermeture au fond** : tap basé sur les **pointer events** (le `click` est
  avalé/différé sur conteneur scrollable iOS) avec une **détente** (< 12px de
  mouvement entre down/up) → fiable sans être hypersensible.
- **Apparition du contenu async** (skeleton → corps Notion) : **resize fluide**
  de la carte (skill `01-card-resize`, tween height) + **reveal** du corps
  (skill `18-texts-reveal` : fade + translateY + blur). Ne joue qu'en chargement
  async (`startedEmpty`) ; en synchrone le morph révèle déjà tout.
- **Flou haut (PWA)** : ✅ bande `backdrop-filter: blur` en haut, masquée en
  dégradé (fort en haut → nul en bas) → le contenu se brouille en remontant, sans
  couvrir la croix/le titre au repos (situés sous la bande). Visible seulement
  une fois l'overlay ouvert.
- **iOS — tap status-bar pour remonter en haut** : NON disponible (choix assumé).
  Le scroll est dans un conteneur dédié (grille gelée derrière, fix #249) ; iOS ne
  remonte que le scroller du *document*. On préserve le gel de la grille plutôt
  que le confort status-bar. Bascule en scroll-document possible si on inverse ce
  choix.
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
| #250 | MAJ doc |
| #253 | Scroll-document : encadré = longueur du contenu (conteneur de scroll dédié), titre qui défile, croix fixe ; e2e 10/10 |
| #255 | Croix ancrée à la carte (défile), resize fluide + reveal du corps async (skills 01/18), fermeture pointer-events avec détente |
| #256 | Flou (`backdrop-filter`) en bande haute de l'overlay au scroll |
| #258 | Fix morph de fermeture visible en PWA iOS (encadré qui rétrécissait hors écran) |
| `9fc26c5` / `20c7e3f` | Fermeture PWA iOS fiable : dé-piège du `fixed` (scroller) + auto-correction anti-piège |
| `2df5fdd` | Gestes carte : carrousel swipe ±1 (panneau ghost + préchargement voisins) + pull-to-close |
| `0de9761` | Fermeture PWA iOS : piste du carrousel en `static` hors drag (ne piège plus le `fixed`) |
