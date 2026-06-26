# Historique complet — chantier « chrome mobile & intégration iOS / Safari »

> Document de référence retraçant **tout** ce qui a été accompli sur l'intégration
> Safari iOS / PWA du dashboard NotionClub, le **pourquoi**, le **comment**, et les
> **invariants** à ne pas casser. Sert de point d'entrée pour toute reprise.
>
> Base de départ : branche visuelle `claude/ios-theme-background-layers-q3aa2u`
> (fond/thème Safari). État final : mergé sur `main` via les PR #227 → #233.

---

## 1. Le contexte

Le chantier précédent (fond/thème Safari) avait livré un rendu visuellement parfait
mais avait **cassé la navigation** sur iOS et introduit plusieurs artefacts de chrome
mobile. Cette série de PR a : (a) débloqué la navigation, (b) fini le chrome mobile
(haut/bas), (c) ajusté la hauteur des composants à scroll interne sur Safari.

---

## 2. Chronologie des PR

| PR | Titre | Apport |
|----|-------|--------|
| **#227** | theme-color hors React | **Débloque la navigation iOS** (crash `removeChild` en phase commit) + promotion de la base visuelle |
| **#228** | retrait du halo d'ombre BottomNav | Supprime le voile sombre parasite sous la pilule |
| **#229** | voile de flou haut global + BottomNav opaque | Frost du haut sur toutes les pages + nav opaque (light) |
| **#230** | BottomNav opaque en dark | Valeur `html.dark` oubliée → nav opaque aussi en sombre |
| **#231** | rangée du haut qui défile + teinte thème | Le haut défile au scroll (absolute) + teinte thème du frost en Safari navigateur |
| **#232 → reverté** | feed/coaching en scroll-document | ❌ Mauvaise approche (rendait la PAGE scrollable → cassait le PWA). **Annulé.** |
| **#233** | clearance basse responsive | ✅ Bonne approche : on garde le **scroll interne** (page fixe) et on cale la hauteur du composant juste au-dessus de la BottomNav, sur tous les écrans |

---

## 3. Le bug central de navigation (#227) — à comprendre absolument

### Symptômes
Spinner de login infini, skeleton de formation bloqué, navigation qui exige un 2ᵉ clic,
dropdown profil gelé — **tout réparé par un hard refresh**.

### Cause racine
La balise `<meta name="theme-color">` était **mutée à la main** sur un nœud `<head>` que
**React 19 possède** (métadonnées hoistées via `viewport.themeColor`). À la navigation,
la réconciliation du `<head>` faisait `removeChild` sur un `parentNode` `null` →
exception **EN PHASE COMMIT** → React **avorte tout le commit** → navigation jamais
appliquée, racine cassée.

### Correctif & invariant
**La balise theme-color est gérée EXCLUSIVEMENT en impératif, jamais par React.**
- `viewport.themeColor` **retiré** de `layout.tsx`.
- Teinte de pré-paint posée par le **script inline** du root layout (hors React).
- `ThemeColorMeta.applyThemeColor` retire + ré-insère le `<meta>` (nécessaire iOS) — ne touche que des nœuds **non-React**.

> ⛔ **NE JAMAIS remettre `viewport.themeColor`** → le crash de navigation revient.

---

## 4. Chrome mobile — état final

### Frost du haut (mobile, toutes pages)
Monté dans le **root layout** (`md:hidden`). **Deux calques SÉPARÉS** (jamais couleur +
flou sur le même élément = bug WebKit de non-repeint) :
1. `GradualBlurOverlay` (z38) = **flou pur**, tous modes. `calc(env(safe-area-inset-top) + 52px)`.
2. `.nc-top-tint` (z39) = **couleur du thème**, **sans** backdrop-filter, affiché **uniquement en Safari navigateur** (`@media (display-mode: browser)`).

### Rangée du haut (logo + dev-tool + notif + profil)
`position: absolute` → ancrée au **haut de la page**, défile avec le contenu et
disparaît au scroll. z40/41.

### BottomNav
`fixed; bottom: calc(10px + env(safe-area-inset-bottom))`, z50, hauteur 56. Fond
**opaque** (`#ffffff` / `#1c1917`, défini en `:root`, `.dark` ET `html.dark`). Pas de
backdrop-filter. Ombre de contact seule (`0 1px 4px rgba(0,0,0,0.06)`).

---

## 5. Hauteur des composants à scroll interne (communauté / coaching)

### La RÈGLE (à respecter absolument)
La **page ne scrolle PAS**. Le composant (carte feed / encadré coaching) occupe une
hauteur **fixe** et **scrolle en interne**. Le composant doit **toujours** s'arrêter
**juste au-dessus de la BottomNav**, sur **tous** les écrans (règle responsive).

### Le bug (Safari)
Sur Safari iOS, le composant s'arrêtait **trop tôt** (gros vide avant la BottomNav),
alors qu'en PWA il descendait correctement.

### Cause
La clearance basse était **fixe** (`pb-[120px]`). Or la BottomNav est à
`bottom: calc(10px + env(safe-area-inset-bottom))` → son empreinte **dépend** de la
safe-area : ~100px en PWA (safe ≈ 34), ~66px en Safari (safe ≈ 0). Un padding fixe de
120px tombait juste en PWA mais laissait ~54px de vide en trop sur Safari.

### Correctif (#233)
Clearance basse **responsive** = empreinte exacte de la BottomNav :
```
pb = calc(env(safe-area-inset-bottom, 0px) + 86px)
```
(86 = 10 bottom + 56 hauteur + ~20 marge). Écart constant de ~20px au-dessus de la nav,
quel que soit l'écran. **PWA inchangé** (safe ≈ 34 → 120px, comme avant) ; **Safari**
(safe ≈ 0 → 86px → le composant descend ~34px plus bas, pile au-dessus de la nav).

> ⚠️ On **n'a PAS** rendu la page scrollable (tentative #232, re-vertée). Le scroll
> reste **interne** au composant. Ne JAMAIS repasser ces pages en scroll-document.

---

## 6. Invariants & pièges iOS

1. **theme-color hors React** (cf. §3). Jamais `viewport.themeColor`.
2. **Jamais couleur + `backdrop-filter` sur le MÊME élément** : pas de repeint au thème sur iOS. Séparer en deux calques.
3. **Communauté / coaching = scroll INTERNE, page fixe** (`h-dvh overflow-hidden`). Pour que le composant s'arrête au-dessus de la nav, **clearance basse responsive** (`env(safe-area-inset-bottom) + 86px`), jamais un padding fixe, jamais de scroll-document.
4. **`position: fixed` mobile** réservé à la BottomNav. Le chrome haut est en `absolute`.
5. Tester **sur device** : les previews Vercel ne reproduisent ni le chrome Safari ni les bugs WebKit (absents de Chromium), ni la différence PWA / navigateur.

---

## 7. Fichiers clés

| Rôle | Fichier |
|------|---------|
| theme-color (impératif, hors React) | `src/shared/components/theme/ThemeColorMeta.tsx`, script inline + `viewport` dans `src/app/layout.tsx` |
| Frost du haut (flou + teinte) | `src/app/layout.tsx`, `src/shared/components/GradualBlurOverlay.tsx`, `.nc-top-tint` dans `src/app/globals.css` |
| Chrome haut (logo/actions, absolute) | `src/shared/components/dashboard/mobile/MobileTopActions.tsx`, `.nc-mobile-logo` dans `globals.css` |
| BottomNav (opaque, ombre) | `src/shared/components/dashboard/mobile/BottomNav.tsx`, `--nc-bottom-nav-bg` dans `globals.css` |
| Hauteur communauté (scroll interne) | `src/app/(app)/communaute/(shell)/layout.tsx` |
| Hauteur coaching (scroll interne) | `src/app/(app)/coaching/CoachingPageClient.tsx` |

Voir aussi : `docs/pwa/retrospective-bandes-ios-theme.md`, `docs/pwa/safari-web-pwa-integration.md`,
`docs/pwa/passation-session-fond-theme-safari.md`.
