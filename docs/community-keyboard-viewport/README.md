# Chantier — Clavier mobile & viewport sur `/communaute`

> **État : ABANDONNÉ au profit du pattern natif (2026-07-14).**
>
> Le `ViewportFrame` (conteneur `position: fixed` + `transform` suivant le
> viewport visuel) résolvait le resize au clavier MAIS **reflowait la safe-area
> iOS**, ce qui déplaçait la BottomNav globale (trop haute en PWA, vide en
> dessous) — insoluble au niveau CSS, en amont du `!important`. Après ~15
> tentatives (§5), décision : **retirer tout le frame** et revenir au modèle
> `main` (nav globale JAMAIS touchée par `/communaute` → position identique
> partout, par construction). Le seul ajout net = **masquage de la BottomNav au
> clavier en CSS pur** (`body.nc-kb-open`, posée par `MessageComposer` au focus).
>
> Fichiers supprimés : `ViewportFrame.tsx`, `ViewportDebugOverlay.tsx`,
> `AppMobileChrome.tsx`, `PwaBottomFrost.tsx`, `api/vpdebug/route.ts`. Fichiers
> ramenés à `main` : shell layout, `(app)/layout`, `app/layout`, `globals.css`,
> `ConversationThread`, `BottomNav` (+ classe `nc-bottom-nav`).
>
> **Ce document est conservé pour ses données de mesure iOS (§6, ground truth)**
> et l'historique des impasses — utile si le resize « composant au ras du
> clavier » doit un jour être retenté SANS toucher la nav (piste : une seule
> variable CSS de hauteur pour la carte Messages, jamais de frame/transform sur
> le chrome). Voir §7 pistes 2 et 4.
>
> ---
>
> _Ci-dessous : le document de passation d'origine (chantier frame, abandonné)._

---

## 1. Objectif — ce que l'utilisateur doit vivre

Page `/communaute` : un composant unique (carte) contenant deux onglets **Feed**
et **Messages**, sur mobile (Safari Web **et** PWA iOS installée).

### Au repos (clavier fermé) — ✅ acquis
- La page **ne scrolle pas** (fond fixe).
- Le composant est **visible en entier**, avec un padding constant en haut et en
  bas (espace avec la rangée d'actions du haut et avec la BottomNav).
- Feed et Messages ont la **même taille**, pas de bande grise.

### À la saisie d'un message (clavier ouvert) — ❌ NON acquis
1. La **BottomNav in-app** (Accueil/Formation/Communauté/Coaching/Ressources)
   doit **disparaître**.
2. Le composant doit **descendre au ras du clavier** (léger padding ~8 px), pour
   maximiser la visibilité des messages. **Réduire** l'espace entre le bas du
   composant et le haut du clavier.
3. **Aucune bande** parasite ne doit apparaître dans le composant sous le champ.

### À la fermeture du clavier — ❌ NON acquis (surtout en PWA)
- La BottomNav **revient**, le composant reprend sa taille — **sans** avoir à
  changer de page.

---

## 2. Symptômes ACTUELS (dernier build `a011a2e`)

| Contexte | BottomNav clavier ouvert | Composant clavier ouvert | BottomNav à la fermeture |
|---|---|---|---|
| **Safari Web** | revient/masquée (~ok) | **remonte vers le haut, vide en dessous** ❌ | revient ✅ |
| **PWA iOS** | masquée | **remonte vers le haut, vide en dessous** ❌ | **ne revient pas** ❌ |

Le **problème central non résolu** : à l'ouverture du clavier, le composant
**remonte vers le haut de l'écran** en laissant un grand **vide** entre lui et le
clavier — l'inverse de ce qu'on veut (il devrait descendre au ras du clavier).

---

## 3. Contexte macro — structure de la page à la racine

### Arbre de rendu (mobile)

```
src/app/layout.tsx                      ← <html>, <body>, viewport meta, .nc-app-bg (fond global fixed)
└─ src/app/(app)/layout.tsx             ← chrome commun à TOUTES les routes app
   ├─ <Topbar/>                          (desktop)
   ├─ <div className="md:hidden">        (mobile)
   │   ├─ <MobileBrandLogo/>             position: fixed
   │   ├─ <MobileTopActions/>            position: fixed, top 12 (cloche + avatar)
   │   └─ <BottomNav/>                   position: fixed, bottom 10+safe  ← LA nav à masquer
   └─ {children}
      └─ src/app/(app)/communaute/(shell)/layout.tsx
         └─ <div className="nc-page-halo nc-community-shell flex flex-col">   ← LE shell
            ├─ <main className="… px-4 md:px-10 md:pt-[104px] md:pb-8">
            │   └─ <CommunityPage/>       (src/modules/community/routes/community-page.tsx)
            │       └─ <div className="… nc-community-card nc-community-card--fixed|--messages">
            │           ├─ switcher Feed/Messages (shrink-0)
            │           └─ contenu : .nc-feed-scroll  OU  .nc-messages-embed → <MessagesLayout/>
            │                                                                   └─ <ConversationThread/> + <MessageComposer/>
            ├─ {children}                 (pages-marqueurs `return null`)
            ├─ <ViewportWatcher/>         ← notre contrôleur clavier (client, monté SEULEMENT ici)
            └─ <ViewportDebugOverlay/>    ← overlay de debug TEMPORAIRE (à retirer)
```

### Points structurels clés

- **La BottomNav est GLOBALE** (montée dans `(app)/layout.tsx`, présente sur
  toutes les routes). Elle est `position: fixed; bottom: calc(10px + safe)`.
  Contrainte absolue : **son comportement/position sur les autres routes
  (dashboard, coaching, ressources, formation) ne doit pas changer d'un pixel**.
- **`.nc-page-halo`** a `isolation: isolate` et `padding-top: env(safe-area-inset-top)`.
  Son fond est **global** (`.nc-app-bg`, `position: fixed; inset: 0` dans le root
  layout), pas dans le halo.
- **Élément fixed hors du halo** : règle du repo (cf. `.claude/context.md`) — la
  nav et les actions du haut sont rendues HORS `.nc-page-halo` car son
  `isolation: isolate` peut casser `position: fixed`.
- **Patron `/coaching`** (`.nc-coaching-shell`) : référence explicite du brief.
  Mobile = `height: 100dvh; min-height: 0; overflow: hidden`, contenu en flex,
  scroll INTERNE. `/communaute` devait répliquer ça mais avec une hauteur
  **dynamique** (rétrécissant au clavier).

---

## 4. Comment j'ai structuré l'opération (architecture livrée)

### `ViewportWatcher` — `src/shared/components/dashboard/mobile/ViewportWatcher.tsx`
Composant client, monté **uniquement** dans le layout `/communaute`. En lecture
seule (aucun `preventDefault`/`blur`/`scrollTo`). Effets :
1. Pose `--nc-vvb = round(visualViewport.height)` sur `<html>` (hauteur visible).
2. Pose/retire `body.nc-kb-open` (clavier actif) : classe posée au `focusin` d'un
   champ éditable, retirée quand `vv.height` revient à la référence
   (`baseline`) — **et jamais sur `focusout`** (le swipe-down iOS ne blure pas).
   Garde `sawKeyboard` : on ne démasque qu'après avoir vu le clavier réduire la
   hauteur (sinon la classe est retirée dans la même frame qu'elle est posée).
   Filet anti-blocage 700 ms (clavier matériel).
3. Pose `html.nc-lock-scroll` (verrou de scroll document, cf. §5).

### CSS — `src/app/globals.css` (bloc `.nc-community-shell`)
```css
.nc-community-shell { min-height: 100lvh; }                 /* desktop inchangé */
html.nc-lock-scroll, html.nc-lock-scroll body {
  overflow: hidden; overscroll-behavior: none;              /* verrou scroll doc */
}
@media (max-width: 767px) {
  .nc-community-shell {
    height: var(--nc-vvb, 100dvh);   /* ← hauteur = zone visible, rétrécit au clavier */
    min-height: 0; overflow: hidden;
  }
  .nc-community-shell > main {
    padding-top: 64px;
    padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));  /* réserve nav */
    min-height: 0;
  }
  body.nc-kb-open .nc-community-shell > main { padding-bottom: 8px; }  /* nav masquée → 8px */
  .nc-community-card.nc-community-card--fixed,
  .nc-community-card.nc-community-card--messages { height: auto; flex: 1 1 auto; min-height: 0; }
}
.nc-messages-embed { height: auto; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
```

### CSS — masquage nav (bloc `.nc-bottom-nav`)
```css
.nc-bottom-nav { position: fixed; bottom: calc(10px + env(safe-area-inset-bottom,0px));
  left:12px; right:12px; height:56px; z-index:50; transition: transform 200ms …, opacity 160ms …; }
body.nc-kb-open .nc-bottom-nav, body.nc-kb-open .nc-pwa-bottom-frost {
  transform: translateY(calc(100% + 24px)); opacity: 0; pointer-events: none;   /* JAMAIS display:none */
}
```

### Viewport racine — `src/app/layout.tsx`
`interactiveWidget: "resizes-content"` (dernière tentative, cf. §5.G).

### Idée directrice
Le shell est une **boîte verrouillée à la hauteur visible** (`--nc-vvb`) : quand
le clavier s'ouvre, `--nc-vvb` chute → le shell rétrécit → la carte (flex) et le
composer descendent au ras du clavier. La nav est masquée via `body.nc-kb-open`.
**C'est la FORME du shell qu'on pilote, pas le contenu.**

---

## 5. Ce qui a été essayé, et pourquoi ça ne marche pas

Ordre chronologique. Chaque tentative est un commit sur la branche.

**A. Masquage nav via classe au focus (`e6d6ce6` de l'ancien chantier, ré-appliqué).**
La nav pose `display:flex` en inline → une règle `display:none` sans `!important`
ne s'applique pas. Corrigé en `transform/opacity` (pas `display:none`, qui en
plus casse la pilule active mesurée via `offsetWidth`).

**B. Détection clavier sur `vv.height + offsetTop` (`2421644`).**
❌ `offsetTop` **dérive avec le scroll** (0→351) → la valeur remonte → le seuil
« clavier vu » ne se déclenche pas → le filet anti-blocage retire la classe après
700 ms → **la nav réapparaît pendant la saisie**. Prouvé par relevé (§6).
→ Corrigé : détection sur `vv.height` seul (indépendant du scroll).

**C. Shell verrouillé `height: var(--nc-vvb)` (`93282f2`).**
Le shell rétrécit bien (mesuré : `h956 → h543`), MAIS ❌ **25 ms plus tard iOS
scrolle le document de 413 px** (`scrollY=413`, `vvOT=351`) pour « remonter le
champ » sur une géométrie périmée → la carte part **hors écran par le haut**.

**D. `body.nc-kb-open` jamais posée (`4c59018`, bug trouvé par relevé).**
Au `focusin`, la classe était posée puis `measure()` la retirait dans la même
frame (clavier pas encore monté → `h == baseline` → « clavier absent » vrai).
→ Corrigé : garde `sawKeyboard`.

**E. Shell en `position: fixed` (`4c59018`).**
Pour sortir le shell du flux et empêcher iOS de le scroller. ❌ **Régression
grave** : `position: fixed` sur le contenu **reflowe le viewport/safe-area iOS**
et **déplace la BottomNav AU REPOS** (nav remontée dès l'arrivée sur la page).
Piège **déjà documenté** dans `docs/ressources-morph/README.md`. → Reverté.

**F. Verrou scroll `overflow:hidden` sur `html`/`body` (`34639bb`).**
Remplace `position:fixed`. Fixe bien la régression nav-au-repos (E). ❌ Mais le
composant **remonte encore** : le verrou bloque `scrollY` mais **pas** le
décalage du **visual viewport** (`offsetTop`), l'autre canal par lequel iOS
remonte le champ en mode `resizes-visual`.

**G. `interactive-widget=resizes-content` (`272b84e` puis `a011a2e`).**
Idée : faire redimensionner le **layout** par le clavier (comme Android) →
`dvh` rétrécit tout seul, `offsetTop` reste 0.
- `272b84e` : posé **dynamiquement en JS** (ViewportWatcher). ❌ **Ignoré par
  iOS** (ne relit `interactive-widget` qu'au parse de la page).
- `a011a2e` : posé au **viewport racine, rendu côté serveur** (vérifié présent
  dans le HTML SSR). ❌ **Toujours aucun changement** selon l'utilisateur (ni
  PWA ni Safari Web).

---

## 6. Données de mesure RÉELLES (ground truth)

Relevés capturés sur device (iPhone iOS 18.7, Safari 26.5, PWA standalone,
440×956, safe-bottom 34) via l'overlay de debug. **À utiliser comme référence.**

**Signal clavier (propre, indépendant du scroll) :**
```
vv.height : 956 (clavier fermé)  ↔  543 (clavier ouvert)   → clavier ≈ 351px
clientHeight (layout viewport) : 894  CONSTANT   ← le clavier ne redimensionne PAS le layout (resizes-visual)
dvh (100dvh résolu) : 956 au repos
safe-bottom : 34
```

**À l'ouverture du clavier (mode resizes-visual, shell en flux) :**
```
focusin    vvH=956 vvOT=0   scrollY=0    shell top0/bot956/h956   card bot842
vv.resize  vvH=543 vvOT=0   scrollY=0    shell top0/bot543/h543   card bot429   ← shell rétrécit OK
vv.scroll  vvH=543 vvOT=351 scrollY=413  shell top-413/bot130     card bot16    ← iOS scrolle : carte éjectée
```
→ **Les DEUX canaux bougent** : `scrollY` (document) ET `vvOT` (visual viewport).

**QUESTION OUVERTE CRITIQUE (non mesurée sur le dernier build `a011a2e`) :**
Est-ce que `resizes-content` a **réellement** pris effet ? Le test : ouvrir le
clavier et regarder si **`dvh` rétrécit** (956 → ~543) et si **`clientHeight`
rétrécit** (894 → ~543). L'overlay logge déjà `dvh` et `clientHeight`.
- Si `dvh` rétrécit → `resizes-content` marche, le bug est ailleurs (le shell ne
  suit pas, ou un cache/rebuild du preview).
- Si `dvh` reste à 894/956 → `resizes-content` **n'est pas honoré** sur cet
  iOS/PWA même en SSR → il faut une autre approche (§7).

---

## 7. Pistes pour la suite (non essayées / à creuser)

1. **CONFIRMER d'abord si `resizes-content` prend effet** (cf. §6) — c'est LE
   point de bascule. Vérifier aussi que le preview a bien rebuild (pas un cache
   PWA : désinstaller/réinstaller l'icône, ou hard reload).

2. **Si `resizes-content` n'est pas honoré** → conteneur qui suit le visual
   viewport en JS, façon « app shell » iOS standard :
   `position: fixed; top: 0; left: 0; right: 0; height: visualViewport.height;
   transform: translateY(visualViewport.offsetTop)` mis à jour sur
   `visualViewport.scroll`/`resize`. **MAIS** attention au reflow safe-area de
   `position:fixed` (piège E). Solution possible : appliquer ce fixed à un
   conteneur INTERNE (pas `.nc-page-halo`), ou compenser la safe-area
   manuellement. À prototyper hors `.nc-page-halo`.

3. **Piste `resizes-content` GLOBAL déjà en place** (`a011a2e`) : si ça marche
   une fois le cache vidé, alors le shell `height: var(--nc-vvb)` + `100dvh`
   fallback devrait suffire — voire simplifier (retirer le JS de sizing, laisser
   `height: 100dvh` faire).

4. **Envisager de NE PAS verrouiller la page** et laisser iOS faire son
   scroll-into-view natif, mais avec le composer réellement en bas d'un document
   = exactement 100dvh (pattern chat natif). À tester : sans `--nc-vvb`, sans
   verrou, juste `height: 100dvh` + composer sticky bottom.

5. **BottomNav qui ne revient pas en PWA à la fermeture** : symptôme distinct.
   Probable que `vv.height` ne revient pas exactement à `baseline` en PWA après
   fermeture (ou dans l'état « remonté »). Mesurer `vv.height` + `kbOpen` sur la
   fermeture (l'overlay le fait). Si `vv.height` ne revient pas à ~956, la
   condition `h >= baseline - 60` de `removeClass` ne se déclenche jamais.

---

## 8. Fichiers touchés sur la branche

| Fichier | Rôle |
|---|---|
| `src/shared/components/dashboard/mobile/ViewportWatcher.tsx` | **Cœur.** `--nc-vvb`, `body.nc-kb-open`, `html.nc-lock-scroll` |
| `src/app/globals.css` | `.nc-community-shell`, `.nc-bottom-nav` (masquage), `.nc-messages-embed`, `html.nc-lock-scroll` |
| `src/app/(app)/communaute/(shell)/layout.tsx` | Classe `nc-community-shell`, montage `ViewportWatcher` + overlay |
| `src/shared/components/dashboard/mobile/BottomNav.tsx` | Classe `.nc-bottom-nav`, positionnement en CSS, garde `moveTo` |
| `src/app/layout.tsx` | `interactiveWidget: "resizes-content"` (viewport racine) |
| `src/modules/community/routes/community-page.tsx` | Cartes `--fixed`/`--messages` en flex-fill mobile |
| `src/shared/components/dev/ViewportDebugOverlay.tsx` | **Overlay debug TEMPORAIRE** (à retirer) |
| `src/app/api/vpdebug/route.ts` | **Route debug TEMPORAIRE** (logge le journal dans Vercel, à retirer) |

### Outil de debug (à garder tant que non résolu, retirer avant merge)
- Overlay en bas à gauche : boutons **📌 Marquer** / **📤 Envoyer**.
- **📤 Envoyer** POST le journal (état DOM complet : `vv.*`, `kbOpen`, `--nc-vvb`,
  rects shell/carte/nav, `dvh`, `clientHeight`) sur `/api/vpdebug` → visible
  dans les **logs runtime Vercel** (le presse-papier iOS s'est révélé infiable).
- Activé par la constante `FORCE_DEBUG = true` dans `ViewportDebugOverlay.tsx`.

### Contraintes à ne jamais violer (rappel)
- Pas de `position: fixed` sur `.nc-page-halo`/le shell (reflow safe-area).
- Pas de `display:none` sur la nav (casse l'animation + la pilule active).
- Pas de `blur()` forcé, pas de boucle `rAF` de scroll, pas de `setTimeout`
  en rafale, pas de `scrollTo` défensif (liste noire du brief).
- Desktop (≥768px) et autres routes : **zéro changement**.
