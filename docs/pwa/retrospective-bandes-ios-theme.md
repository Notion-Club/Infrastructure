# Rétrospective — bandes haut/bas, fond de page & changement de thème sur iOS

> Document de passation honnête sur un chantier long et en grande partie
> infructueux. Objectif : que la prochaine personne (ou IA) ne reparte pas de
> zéro et ne refasse pas les mêmes essais.

---

## 1. L'objectif initial

Sur iPhone (Safari **et** PWA), donner aux pages connectées un rendu « natif,
plein écran » :

1. Le contenu doit s'intégrer jusqu'aux bords (sous le notch, derrière la barre
   Safari) sans **bande blanche** qui jure.
2. Les zones haut (status bar) et bas (sous la BottomNav) doivent adoucir le
   contenu qui défile (effet frosted / liquid glass).
3. Tout doit suivre le **thème** (clair/sombre), y compris au changement de mode
   et à la navigation entre pages.

## 2. Le contexte technique

- **Next.js 16 (App Router) + React 19**, Tailwind v4, déploiement Vercel.
- Thème **custom** (pas `next-themes`) : un store JS (`ThemeProvider`) pose la
  classe `.dark` sur `<html>` impérativement (`classList`), source =
  `localStorage`. Les couleurs viennent de variables CSS
  (`--color-surface-page`, etc.) qui basculent avec `.dark`.
- Le test ne pouvait se faire que **sur l'appareil de l'utilisateur** (iPhone),
  souvent **en PWA connectée** (les previews Vercel ne permettent pas de tester
  l'app connectée). C'est la contrainte qui a le plus coûté : pas de boucle de
  validation rapide côté assistant.

## 3. Les deux bugs iOS rencontrés

### Bug A — la « bande blanche » derrière la barre Safari
`viewport-fit=cover` étend le viewport sous les barres, mais l'inset libéré est
rempli par la `background-color` du body/html. Sans contenu à cet endroit, on
voit du fond plat. Aggravé au départ par un dégradé `::before` en
`position: fixed` **dans** un parent `isolation: isolate` (clippé à la boîte).

### Bug B — les bandes ne suivent pas le thème sur iOS (le gros morceau)
**Bug WebKit confirmé** : un élément qui combine `backdrop-filter` **ET** un
`background` coloré par une **custom property** ne se **repeint pas** quand la
variable change (bascule de thème). La bande restait figée sur l'ancienne
couleur jusqu'à un **re-composite** forcé — d'où le symptôme « il faut tourner
l'écran en paysage pour que la couleur se mette à jour ». Chromium (Arc) n'a
PAS ce bug → d'où des résultats trompeusement OK sur desktop.

## 4. Tout ce qui a été essayé (et pourquoi ça a échoué)

| # | Tentative | Résultat |
|---|---|---|
| 1 | `theme-color` dynamique (`ThemeColorMeta`) | OK pour Android/anciens iOS, **inerte** sur le chrome bas de Safari 26. |
| 2 | App-shell (un seul conteneur de scroll `fixed`) | Régressions (bande noire, contenu remonté en PWA) → **reverté**. |
| 3 | Ré-appliquer `.dark` en `useLayoutEffect(usePathname)` | Insuffisant : React re-retire la classe dans un commit ULTÉRIEUR (streaming RSC). |
| 4 | `MutationObserver` qui ré-applique `.dark` | Corrige la **persistance de classe** à la navigation (conservé). Ne corrige PAS le repaint des bandes. |
| 5 | Forcer le re-composite (toggle `backdrop-filter` off/on) | iOS garde le fond peint en cache → inefficace. |
| 6 | Muter directement le `background` en `rgba` explicite (JS) | Échoue aussi sur iOS (le calque backdrop-filter ne se ré-évalue pas). |
| 7 | **Séparer flou et couleur** en 2 calques (`-blur` + `-fade`) | Validé en **banc de test isolé** (`/theme-lab`) sur le device, mais le rendu réel restait perçu comme non fiable / trop de calques. |

Banc de test isolé `/theme-lab` (supprimé depuis) : a confirmé qu'un élément
**sans** `backdrop-filter` suit toujours le thème (témoin), et que la version
séparée fonctionne — mais aussi qu'on empilait beaucoup de calques.

## 5. Décision finale (cette PR) — simplifier

On arrête de chercher le frosted coloré parfait sur iOS. On **supprime les
calques « bande »** (haut/bas, couleur + flou) qui se superposaient au contenu
et coûtaient cher, et on **fusionne la couleur dans le fond de page** :

- **`.nc-app-bg`** (fond de page unique, SANS `backdrop-filter` → se repeint
  correctement au changement de thème) reçoit un **dégradé vers la surface
  (blanc en light) à la limite du notch** → plus de cassure nette en haut.
- **`GradualBlurOverlay`** (haut) reste pour le **léger flou progressif**,
  réduit de **6 à 3 calques** (perf). Sans couleur → il échantillonne le fond
  thème-correct, donc pas de bug de repaint.
- **BottomNav** : `background` thème-aware **sans** `backdrop-filter`
  (pilule simple, se repeint).
- Supprimé : `.nc-mobile-top-blur/-fade`, `.nc-mobile-bottom-blur/-fade`,
  `.nc-bottom-nav::before`, et le hack JS `applyGlassTheme` (essais précédents).
- Conservé : garde de classe `.dark` (`MutationObserver`) pour la persistance à
  la navigation — c'est utile et peu coûteux.

## 6. Ce qui reste vrai / recommandations

- **Le frosted coloré (backdrop-filter + couleur thème) sur le MÊME élément est
  un cul-de-sac sur iOS.** Si on en veut un un jour : couleur sur un élément,
  flou sur un AUTRE (jamais les deux ensemble).
- Pour un thème vraiment robuste, envisager **`next-themes`** (gère la classe
  `.dark` sans les soucis de strip React) plutôt que le store custom.
- Tester sur device dès le début ; les previews Vercel ne couvrent pas l'app
  connectée ni les bugs WebKit (absents de Chromium).
- Fichiers clés : `src/app/globals.css` (`.nc-app-bg`), `src/app/layout.tsx`
  (`GradualBlurOverlay`, `ThemeColorMeta`), `src/app/(app)/layout.tsx` (chrome),
  `src/shared/components/theme/*`.

## 7. Itération suivante — vraiment UN seul fond (DA dégradé)

Symptôme persistant après §5 : au scroll, le contenu (cartes blanches + fond
plat off-white du `body`) « se décollait » du dégradé, qui n'apparaissait qu'aux
coins et au bas → impression de calques empilés. Cause : **dualité** entre un
remplissage **plat** (`body` = `--color-surface-page`) au centre et un
**dégradé** (`.nc-app-bg`) cantonné aux coins, plus une **bande blanche** forcée
au notch (1er stop du `linear-gradient`).

Décision : **fusionner toute la DA dans le seul `.nc-app-bg`**.

- Le dégradé d'accents couvre désormais **tout le viewport** (coins + voile
  central, `transparent` repoussé à ~58-60 %) → wash homogène, plus de zone
  centrale plate.
- La **bande blanche au notch est supprimée** ; remplacée par un **fondu sombre
  très léger** (`rgba(0,0,0,0.12)` → 0 sur `safe-area-top + 56px`) **intégré au
  même calque** (juste pour la lisibilité du status-bar blanc en PWA). Pas un
  `<div>` séparé : c'est un `background-image` de plus dans la même propriété.
- `.nc-app-bg` reçoit `var(--color-surface-page)` en **couleur de base finale**
  → calque **opaque et autoportant** (ne dépend plus du fond de `body`).
- **`GradualBlurOverlay` (ancre top) retiré** du root layout — c'était la couche
  `backdrop-filter` superposée en trop. Le composant reste utilisé en `bottom`
  ailleurs (Ressources/Communauté).
- Toujours **aucun `backdrop-filter`** sur `.nc-app-bg` → repeint correct au
  changement de thème (acquis de §5 préservé). Dark mode inchangé (fond uni
  near-black, `.dark .nc-app-bg { background: none }`).

Bilan : un contenu transparent qui scrolle au-dessus d'**un unique dégradé
fixe**, du haut au bas → plus de frontière qui « surgit » au scroll.

## 8. La VRAIE cause racine (test device) — le `body` opaque masquait tout

Le §7 a embelli le dégradé mais le symptôme persistait à l'identique sur device :
un fond blanc cassé qui se décroche au scroll et laisse voir le dégradé + les
bandes. Raison : **on n'avait jamais corrigé l'occulteur**.

`.nc-app-bg` est en `z-index: -1`. Or `body` portait
`background-color: var(--color-surface-page)` (**opaque**). Dans l'ordre de
peinture CSS, **le fond d'un bloc en flux normal (le `body`) se peint AU-DESSUS
d'un enfant positionné en `z-index` négatif**. Donc le blanc cassé du `body`
recouvrait le dégradé en permanence. Et comme le `body` est la boîte qui
scrolle, c'est LUI qu'on voyait « se décrocher », révélant le `.nc-app-bg` fixe
(dégradé + zones safe-area = les « bandes ») là où le `body` ne peignait pas.

Correctif décisif (`globals.css`) :

- **`body { background-color: transparent }`** → le dégradé `.nc-app-bg`
  redevient le SEUL fond visible, sur toutes les pages.
- **`html`** garde une couleur unie (`--color-surface-page`) = base d'overscroll
  iOS (canvas peint SOUS le dégradé → n'occulte rien).
- Modèle final, sans conflit : `html` (base) < `.nc-app-bg` (dégradé, seul fond
  visible) < `body` transparent < `.nc-page-halo` transparent < contenu.

Leçon : un fond fixe en `z-index` négatif est INVISIBLE tant qu'un ancêtre/bloc
en flux a un `background` opaque. Vérifier l'ordre de peinture AVANT de soigner
le dégradé lui-même.
