# Passation de session — Batch d'améliorations front (Communauté + Ressources)

> **But de ce document** : cloner le contexte de travail pour reprendre la
> session sur une autre machine / un autre agent, sans rien perdre. Rédigé le
> **2026-07-06**. Repo : `Notion-Club/Infrastructure`.

---

## 1. Mode de travail (règles NON négociables)

### Isolation & déploiement
- **Worktree isolé** : tout le travail se fait dans un git worktree séparé pour
  ne PAS entrer en collision avec le travail parallèle de Théo (et d'autres) sur
  `main`.
  - Chemin : `/Users/theogouman/Infrastructure-session-batch/`
  - Branche : `feat/session-batch-ameliorations`
  - `node_modules` = **vrai clone APFS** (`cp -Rc`), pas un symlink (Turbopack
    **rejette** les symlinks : _"Symlink is invalid, points out of filesystem
    root"_). `node_modules` est gitignored.
- **Déploiement = fast-forward direct sur `main`, SANS nouvelle PR.** Directive
  explicite de Théo : _« intègre ces commits sans rien écraser, il faut tout
  maintenir live »_. On ne crée pas de PR, on ne merge pas : on **push en
  fast-forward sur `main`** (Vercel déploie `main` → prod).
  - Vercel : team `g0uman`, projet `prj_CHn38vwOkjzm2DqzhcBilIDQpRo6`
    (`notion-club-infra`), alias prod **`app.notionclub.fr`**.
  - Vérifier l'état : MCP Vercel `get_deployment` sur
    `notion-club-infra-git-main-g0uman.vercel.app` (team `g0uman`). Build ≈ 48 s.

### Règle absolue « toujours à jour avec main » (CLAUDE.md)
**Avant CHAQUE push**, systématiquement et sans qu'on le demande :
1. `git fetch origin`
2. `git log --oneline HEAD..origin/main` → doit être **vide**.
3. Si `origin/main` a avancé : vérifier que les nouveaux commits **ne touchent
   pas les mêmes fichiers** (`git show <sha> --stat`), puis `git rebase
   origin/main` avant de pousser. **Jamais** de force-push qui écraserait un
   commit distant.

> Cette session a déjà absorbé 2 avances distantes de cette façon :
> `5a95c82` (migration slack) et le merge de la **PR #263** (déjà mergée en cours
> de route — la branche a été reset sur `origin/main` puis rebasée).

### Front-end / animations
- Référence canonique **obligatoire** : skill **`transitions-dev`**
  (`.claude/skills/transitions-dev/` — `transitions reveal|review|apply`).
  On s'en inspire plutôt que de réinventer des `@keyframes`.
- Toujours préserver les guards `@media (prefers-reduced-motion: reduce)`.
- Tokens : `--nc-ease`, `--nc-duration-*`, `.nc-skeleton`, `--nc-glass-*`, etc.

### iOS / PWA (méthode Théo)
- **Bug iOS connu** : toujours **tester sur device / banc isolé avant de
  déployer**. Beaucoup de quirks WebKit ne se voient QUE en **PWA standalone
  installée** (pas en Safari onglet, pas en desktop).
- Doc canonique overlays/modales iOS : **`docs/pwa/safari-web-pwa-integration.md`**
  (modèle de fond `.nc-app-bg`, jamais de `backdrop-filter` sur l'élément qui
  porte `theme-color` ni sur `.nc-app-bg`, bandes Safari = chrome hors DOM…).
- **Frugalité tokens** : ne pas sur-poller Vercel (le pipeline est fiable),
  déléguer les grosses explorations à des sous-agents.

### Format PR (si un jour on repasse en PR)
Voir CLAUDE.md : structure imposée (Contexte / Qu'est-ce qui a été fait /
Pourquoi / Comment ça fonctionne / Branchements) en français, aérée, emojis en
tête de sous-section, référence style PR #33 & #38. **Pas** de mention
« Generated with Claude Code » dans le corps.

### Gotchas connus
- `next build` local **s'arrête toujours** au prérender de `/ressources` :
  _"NOTION_API_TOKEN missing"_ — gate d'env **pré-existant**, le token est set
  côté Vercel. Ce n'est PAS une régression. Pour valider localement, se limiter
  à `tsc --noEmit` + `eslint <fichier>`.
- Erreurs de lint **pré-existantes** (hors périmètre, elles shippent en prod) :
  `CommentItem.tsx:51`, `FeedPostList.tsx:30` (`react-hooks/set-state-in-effect`).
- `/lab/morph` = banc de test e2e du morph **dev-only** (pas en prod).

---

## 2. Ce qui a été accompli (commits sur `main`, tous déployés)

Ordre chronologique. Tous poussés en fast-forward sur `main`, aucun PR.

| Commit | Sujet | État prod |
|---|---|---|
| `ce00c31` (#263) | Batch 1 : DMs pré-chargés + médias feed sans saccade + CTA réaction + icône `text.bubble` | ✅ live (mergé) |
| `3732993` | Boutons « retour » unifiés + fond blanc surface-card | ✅ live |
| `e5eb076` | Hover-card profil au-dessus des posts + fermeture au scroll | ✅ live |
| `e5cb747` | Recherche membres nom+username sans accents + modale portalisée | ✅ live |
| `a8a9744` | Bouton `+` état vide messages immobile au hover | ✅ live |
| `20b80e6` | Façade YouTube (miniature + play liquid glass) + Tella embed paramétré | ✅ live |
| `2435135` | Images du feed affichées EN ENTIER (fin du crop) | ✅ live |
| `6ac1fd6` | Switcher Feed/Messages **instantané** (fin des « deux bandes blanches ») | ✅ live |
| `e20c3e6` | Feed **hauteur fixe + scroll interne** (comme Messages) | ✅ live — **QA mobile à finir par Théo** |
| `e4ec04d` | Icône épingle → variante **contour** SF Symbols `pin` | ✅ live |
| `9fc26c5` | Fermeture morph /Ressources PWA iOS — tentative #2 (couper momentum) | ✅ live — **insuffisant** |
| `20c7e3f` | Fermeture morph /Ressources PWA iOS — **auto-correction anti-piège** | 🔄 déployé — **À VALIDER sur device** |

### Détails utiles par item récent
- **Switcher instantané** (`6ac1fd6`) : l'état « actif » venait de l'URL
  (sous Suspense, MAJ tardive). Ajout d'un **état visuel optimiste**
  (`uiTab`) basculé au clic, URL = source de vérité du contenu.
  Fichier : `src/modules/community/routes/community-page.tsx`.
- **Feed hauteur fixe** (`e20c3e6`) : `.nc-community-card--fixed` +
  `.nc-feed-scroll` dans `globals.css` ; `IntersectionObserver` ré-ancré sur le
  conteneur (`scrollRootRef`) dans `FeedPostList.tsx` ; restauration de scroll
  sur `#nc-feed-scroll`. Hauteurs = **estimation** :
  `calc(100dvh - 184px - safe-area)` mobile / `- 136px` desktop → **à ajuster si
  l'encadré dépasse/laisse un vide sur mobile**.
- **Icône épingle** (`e4ec04d`) : même canvas source (379.15×584.229) que
  l'ancien `pin.fill` → **même transform** `translate(4.338 -0.112) scale(0.04)`,
  on n'a swappé que le `d`. Fichiers :
  `src/shared/components/icons/PinFill.tsx` + `source/pin.fill.svg`. Seul site
  d'usage : `PostKebabMenu.tsx` (API inchangée, rien à toucher).

---

## 3. Chantier EN COURS — animation d'ouverture/fermeture /Ressources

### 3.1 Architecture (comprise ligne par ligne)
Ce n'est **pas** une transition de navigation. C'est un **morph FLIP en WAAPI**
rendu dans un **portail** (`createPortal` → `document.body`).

| Concern | Fichier |
|---|---|
| **Moteur** ouverture/fermeture/FLIP/scroll/blur/croix | `src/modules/ressources/components/morph/ResourceMorphOverlay.tsx` |
| **Machine à états** / contrôleur / `useMorph` | `src/modules/ressources/components/morph/MorphSourceContext.tsx` |
| Easing + durée (ressort critique ωₙ=16, 482 ms, zéro overshoot) | `src/modules/ressources/lib/spring.ts` |
| Déclencheurs cartes (`open()` + capture `cardRect`/`titleRect`) | `ResourceCard.tsx`, `TemplateCard.tsx` |
| Provider monté sur la route | `src/app/(app)/ressources/layout.tsx` |
| Corps partagé (overlay ↔ vraie page détail) | `components/shared/ResourceContentBody.tsx` |
| Chargement async du corps Notion | `src/modules/ressources/server/getResourceBody.ts` |
| Routes détail fallback (Cmd/clic milieu) | `src/app/(app)/ressources/ressource/[slug]/page.tsx`, `template/[slug]/page.tsx` |
| **Banc de test e2e (dev-only)** | `src/app/lab/morph/page.tsx` + `MorphTestHarness.tsx` |

**Mécanique du moteur** (`ResourceMorphOverlay.tsx`) :
- **Ouverture** (`useLayoutEffect`, ~l.326) : mesure la surface dans le flux
  (`flowRect`) + la carte (`source.cardRect`), bascule la surface en
  `position: fixed`, anime `transform + width + height + border-radius` de la
  géométrie carte → géométrie encadré + titre « hero » qui voyage + fond de page.
  À la fin, **`release()`** repose la surface en `position: relative` dans le
  conteneur de scroll → le contenu défile, la croix reste fixe.
- **Fermeture** (`startClose`, ~l.252) : ré-ancre la surface en `fixed` avec la
  géométrie mémorisée (`gRef.current : MorphGeom`) et rejoue les keyframes
  **inversées** (`[surfTo, surfFrom]`). `finishClose` → `history.back()` (si pas
  déjà via popstate) + `onClose()` (démontage par le provider).
- **Géométrie mémorisée** `gRef` : `fixTop/fixLeft/fixW/openH` (viewport, scroll 0)
  + `heroTop/heroLeft/heroW` + keyframes `surfFrom/surfTo` + `heroFrom`.
- iOS/PWA déjà géré ailleurs : verrou de scroll **non-déplaçant** de la grille
  (overflow hidden sans `position:fixed` pour ne pas faire tressauter la
  BottomNav), fermeture au **pointer** (pas `click`, avalé sur iOS),
  `history.pushState` pour le geste retour, focus restauré **seulement** si
  ouverture clavier (sinon encadré bleu iOS).

### 3.2 LE BUG (non résolu à 100 %)
**Symptôme** : en **PWA iOS installée**, la **fermeture** ne rétrécit pas —
l'encadré disparaît brutalement. **Ouverture parfaite. Fonctionne très bien en
Safari iOS et macOS.** C'est le symptôme d'origine de #258, jamais complètement
réglé.

**Ce qui a été écarté (vérifié)** :
- `html`/`body` en `@media (display-mode: standalone)` : **aucun**
  `transform`/`filter`/`contain`/`backdrop-filter` → pas de containing-block
  d'ancêtre qui piégerait le `fixed`.
- L'overlay est en `z-index: 9999`, **au-dessus** de tout le chrome PWA
  (`.nc-splash-cover` z9999 mais fondu tôt, `.nc-pwa-bottom-frost`, `.nc-top-tint`,
  `GradualBlurOverlay`) → pas un recouvrement.

**Historique des tentatives** :
1. **#258 (`757fad4`)** : `overflow:hidden` synchrone + `scrollTo(0,0)` avant le
   ré-ancrage. → insuffisant.
2. **`9fc26c5`** : couper le momentum `-webkit-overflow-scrolling:auto` + gate
   `WebkitOverflowScrolling` sur `!interactive` (React ne le réactive plus) +
   reflow forcé. → **toujours insuffisant** (confirmé par Théo après
   désinstallation/réinstallation).
3. **`20c7e3f` (actuel, à valider)** : **auto-correction anti-piège**. On ne
   parie plus sur le fait que le `fixed` soit viewport-relatif : après
   ré-ancrage, on **mesure** la position réelle via `getBoundingClientRect`
   (toujours en coords viewport) et on **compense l'écart exact**
   (`surf.style.top = fixTop - (got.top - fixTop)`). Le scroller étant gelé,
   l'offset reste constant sur toute l'animation. Inerte si le fixed est déjà
   correct (écart nul) → zéro impact Safari/desktop. + reset `scrollTop=0`
   **avant** de figer overflow (sinon scrollTop non-réinscriptible).

### 3.3 À FAIRE ensuite
1. **Théo valide `20c7e3f` sur iPhone PWA** (app désinstallée/réinstallée) :
   ouvrir une ressource **longue**, **scroller**, fermer (croix / tap fond) →
   l'encadré doit **rétrécir visiblement** vers la carte.
2. **Si ça marche** : clôturer, mettre à jour ce doc + éventuellement documenter
   la technique dans `docs/pwa/`.
3. **Si ça persiste** — plans B (par ordre de robustesse) :
   - **B1 — instrumenter** : afficher en overlay debug la valeur de
     `surf.getBoundingClientRect().top` vs `g.fixTop` juste après ré-ancrage
     (les logs console PWA sont durs à lire) pour SAVOIR si l'offset piège
     existe et si la correction s'applique.
   - **B2 — reparenter** la surface hors du scroller pendant la fermeture :
     la porter dans le div overlay externe (`position:fixed; inset:0`, PAS un
     scroller) → un `fixed`/`absolute` là-dedans n'est jamais piégé. Plus
     invasif (gérer refs/anims WAAPI pendant le reparent).
   - **B3 — ancrage sur rect live** : au lieu de la géométrie mémorisée à
     scroll 0, partir du `getBoundingClientRect()` **courant** de la surface et
     construire des keyframes fraîches vers `cardRect` (shrink depuis la position
     réelle, sans dépendre d'aucun reset de scroll).
4. **QA mobile du Feed hauteur fixe** (`e20c3e6`) : ajuster les constantes
   `184px`/`136px` si l'encadré dépasse ou laisse un vide.

---

## 4. Commandes de reprise rapide

```bash
cd /Users/theogouman/Infrastructure-session-batch
git status && git log --oneline -6
git fetch origin && git log --oneline HEAD..origin/main   # doit être vide avant tout push

# vérifs locales (le build complet s'arrête sur NOTION_API_TOKEN — normal)
npx tsc --noEmit -p tsconfig.json
npx eslint src/modules/ressources/components/morph/ResourceMorphOverlay.tsx

# déploiement (fast-forward, pas de PR)
git push origin HEAD:main
```

Vérif déploiement (MCP Vercel) : `get_deployment` sur
`notion-club-infra-git-main-g0uman.vercel.app`, team `g0uman` → `state: READY`.
