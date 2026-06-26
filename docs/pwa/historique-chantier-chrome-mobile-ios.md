# Historique complet — chantier « chrome mobile & intégration iOS / Safari »

> Document de référence retraçant **tout** ce qui a été accompli sur l'intégration
> Safari iOS / PWA du dashboard NotionClub, le **pourquoi**, le **comment**, et les
> **invariants** à ne pas casser. Sert de point d'entrée pour toute reprise.
>
> Base de départ : branche visuelle `claude/ios-theme-background-layers-q3aa2u`
> (fond/thème Safari). État final : mergé sur `main` via les PR #227 → #231.

---

## 1. Le contexte

Le chantier précédent (fond/thème Safari) avait livré un rendu visuellement parfait
mais avait **cassé la navigation** sur iOS et introduit plusieurs artefacts de chrome
mobile. Cette série de PR a : (a) débloqué la navigation, (b) fini le chrome mobile
(haut/bas), (c) corrigé les bugs de hauteur de scroll sur Safari.

---

## 2. Chronologie des PR (toutes mergées sur `main`)

| PR | Titre | Apport |
|----|-------|--------|
| **#227** | theme-color hors React | **Débloque la navigation iOS** (cause racine : crash `removeChild` en phase commit) + promotion de la base visuelle |
| **#228** | retrait du halo d'ombre BottomNav | Supprime le voile sombre parasite sous la pilule |
| **#229** | voile de flou haut global + BottomNav opaque | Frost du haut sur toutes les pages + nav opaque (light) + `GradualBlurOverlay` hauteur CSS |
| **#230** | BottomNav opaque en dark | Valeur `html.dark` oubliée → nav opaque aussi en sombre |
| **#231** | rangée du haut qui défile + teinte thème | Le haut défile au scroll (absolute) + teinte thème du frost en Safari navigateur |
| **(suite)** | scroll Safari communauté/coaching | Feed + Coaching en scroll-document (fin du contenu « remonté trop tôt » sur Safari) |

---

## 3. Le bug central de navigation (#227) — à comprendre absolument

### Symptômes
Spinner de login infini, skeleton de formation bloqué, navigation qui exige un 2ᵉ clic,
dropdown profil gelé — **tout réparé par un hard refresh**.

### Cause racine
La balise `<meta name="theme-color">` était **mutée à la main** (`querySelector` +
`appendChild`/`setAttribute`/`remove`) sur un nœud `<head>` que **React 19 possède**
(métadonnées hoistées, déclarées via `viewport.themeColor`). À la navigation, la
réconciliation du `<head>` faisait `removeChild` sur un `parentNode` devenu `null`
→ exception **EN PHASE COMMIT** → React **avorte tout le commit** → la navigation ne
s'applique jamais et la racine reste cassée.

### Correctif & invariant
**La balise theme-color est gérée EXCLUSIVEMENT en impératif, jamais par React.**
- `viewport.themeColor` **retiré** de `layout.tsx` (React ne rend plus aucune balise theme-color).
- Teinte de pré-paint posée par le **script inline** du root layout (hors React), suivant le thème réel (localStorage).
- `ThemeColorMeta.applyThemeColor` retire + ré-insère le `<meta>` à chaque switch (nécessaire pour forcer Safari iOS à relire la teinte sous un overlay `backdrop-filter`) — ne touche désormais que des nœuds **non-React**.

> ⛔ **NE JAMAIS remettre `viewport.themeColor`** → le crash de navigation revient.

---

## 4. Chrome mobile — état final & fonctionnement

### Frost du haut (mobile, toutes pages)
Monté dans le **root layout** (`md:hidden`) → actif partout, présent et futur. **Deux
calques SÉPARÉS** (jamais couleur + flou sur le même élément = bug WebKit de non-repeint) :
1. `GradualBlurOverlay` (z38) = **flou pur**, tous modes. Hauteur `calc(env(safe-area-inset-top) + 52px)`.
2. `.nc-top-tint` (z39) = **couleur du thème** (`--color-surface-page`), **sans** backdrop-filter (repeint correct), affiché **uniquement en Safari navigateur** (`@media (display-mode: browser)`) pour se souder à la barre teintée par theme-color. PWA = flou pur seul.

### Rangée du haut (logo + dev-tool + notif + profil)
`position: absolute` (et non `fixed`) → ancrée au **haut de la page**, défile avec le
contenu et **disparaît au scroll** (ne survole plus le contenu). z40/41 (au-dessus des
voiles 38/39). ⚠️ Revient volontairement sur la décision #218 (« chrome haut fixe »).

### BottomNav
- `position: fixed; bottom: calc(10px + env(safe-area-inset-bottom))`, z50.
- Fond **opaque** : `--nc-bottom-nav-bg` = `#ffffff` (clair) / `#1c1917` (sombre), défini en `:root`, `.dark` ET le bloc de renfort `html.dark`. **Pas de backdrop-filter** (translucidité = contenu visible au scroll + bug de repeint iOS).
- Ombre = contact serré seul (`0 1px 4px rgba(0,0,0,0.06)`) — pas de halo descendant (sinon voile parasite avant la barre Safari).

---

## 5. Bug de hauteur de scroll Safari (communauté / coaching)

### Symptôme
Sur Safari iOS (navigateur), le contenu du **feed** et du **coaching** est **plus court**
qu'il ne devrait — la fin remonte trop tôt. En **PWA**, il descend correctement.

### Cause racine
Ces pages utilisaient un shell à **hauteur fixe** `h-dvh overflow-hidden` avec **scroll
interne** (`flex-1 min-h-0 overflow-y-auto`). Conséquence : **le document lui-même ne
scrolle pas** → sur iOS Safari, **la barre d'outils ne se rétracte jamais** (elle ne se
replie qu'au scroll du document) → elle mange l'espace en permanence → `dvh` reste petit
→ zone de contenu raccourcie. En PWA (pas de barre), `dvh` = plein écran → pleine hauteur.

Les pages qui marchent (dashboard, ressources) utilisent au contraire `minHeight: 100lvh`
+ **scroll du document** naturel.

### Correctif
- **Feed (communauté) + Coaching** → passés en **scroll-document** (`minHeight: 100lvh`,
  flux naturel, plus de `overflow-hidden`/`overflow-y-auto` interne) → Safari rétracte sa
  barre, le contenu descend pleinement comme en PWA.
- **Messages (chat)** → laissés en **hauteur fixe explicite** (découplés de la chaîne
  flex du shell) car le chat a besoin d'un conteneur à hauteur définie (composer + liste
  à scroll interne). Le chat n'était pas concerné par le bug.

---

## 6. Invariants & pièges iOS (à ne pas refaire)

1. **theme-color hors React** (cf. §3). Jamais `viewport.themeColor`.
2. **Jamais couleur + `backdrop-filter` sur le MÊME élément** : sur iOS, l'élément ne se
   repeint pas au changement de thème (variable CSS). Toujours **séparer** couleur et flou
   en deux calques.
3. **Pas de shell `h-dvh overflow-hidden` à scroll interne pour des pages de contenu
   long** : ça fige la barre Safari → contenu raccourci. Préférer le **scroll-document**
   (`minHeight: 100lvh`). Réserver le shell fixe aux vues type chat (hauteur explicite).
4. **`position: fixed` mobile** : à n'utiliser que pour ce qui DOIT rester au viewport
   (BottomNav). Le chrome haut est en `absolute` (défile avec la page).
5. Tester **sur device** (iPhone) : les previews Vercel ne reproduisent ni le chrome
   Safari ni les bugs WebKit (absents de Chromium).

---

## 7. Fichiers clés

| Rôle | Fichier |
|------|---------|
| theme-color (impératif, hors React) | `src/shared/components/theme/ThemeColorMeta.tsx`, script inline + `viewport` dans `src/app/layout.tsx` |
| Frost du haut (flou + teinte) | `src/app/layout.tsx` (montage), `src/shared/components/GradualBlurOverlay.tsx`, `.nc-top-tint` dans `src/app/globals.css` |
| Chrome haut (logo/actions, absolute) | `src/shared/components/dashboard/mobile/MobileTopActions.tsx`, `.nc-mobile-logo` dans `globals.css` |
| BottomNav (opaque, ombre) | `src/shared/components/dashboard/mobile/BottomNav.tsx`, `--nc-bottom-nav-bg` dans `globals.css` |
| Scroll communauté | `src/app/(app)/communaute/(shell)/layout.tsx`, `src/modules/community/routes/community-page.tsx` |
| Scroll coaching | `src/app/(app)/coaching/CoachingPageClient.tsx` |

Voir aussi : `docs/pwa/retrospective-bandes-ios-theme.md`, `docs/pwa/safari-web-pwa-integration.md`,
`docs/pwa/passation-session-fond-theme-safari.md`.
