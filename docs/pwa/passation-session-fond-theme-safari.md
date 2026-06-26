# Passation — session « fond unique + intégration Safari/PWA »

> But de ce document : donner à la **prochaine session (perf & architecture)** un
> contexte exhaustif et précis de tout ce qui a été modifié ici, la logique
> appliquée, et une analyse **honnête** des incidences probables sur les temps de
> chargement. Le rendu visuel obtenu est **validé/désiré** (« l'intégration est
> belle sur Safari ») — l'objectif suivant est de **garder ce comportement** tout
> en simplifiant la structure et en corrigeant les lenteurs perçues.

---

## 0. TL;DR

- Cette session a unifié le **fond de page** (un seul dégradé fixe `.nc-app-bg`)
  et réglé l'intégration des **bandes Safari** (notch / barre d'outils) + le
  **switch clair/sombre**.
- Code touché = **6 fichiers** (3 pages Ressources, `globals.css`, `layout.tsx`,
  `ThemeColorMeta.tsx`) + **2 docs**. Changements de code **modestes**.
- Bilan perf des changements : **neutre à positif** (on a **retiré** des couches
  `backdrop-filter`, coûteuses sur mobile ; on n'en a pas ajouté).
- ⚠️ Les « temps de chargement infinis » sont **très probablement ailleurs**
  (data fetching serveur, service worker, politique réseau de l'env). Pistes
  détaillées en §4.3 et §6.

---

## 1. Objectif et déroulé de la session

Problème de départ : sur iPhone (Safari + PWA), plusieurs **calques de fond se
superposaient** (dégradé + blanc cassé + bandes haut/bas), et le calque blanc
« se décrochait » au scroll. Objectif : **un seul fond** (le dégradé de la DA),
qui s'intègre proprement avec les bandes imposées par Safari, et qui **suit le
thème** clair/sombre partout.

Cheminement (7 commits, voir `git log 470be5a..HEAD`) :

| Commit | Idée |
|---|---|
| `4ed93af` | Fond unique : `.nc-app-bg` porte tout le dégradé, suppression des calques « bande ». Retrait du `GradualBlurOverlay` **haut** du root layout. |
| `ff27286` | `body { background: transparent }` — le `body` opaque masquait le dégradé (ordre de peinture CSS) et « se décrochait » au scroll. **Correctif clé.** |
| `db8cbba` | Retrait d'un fondu sombre en haut du dégradé (sans effet réel). |
| `a183ed6` | Tentative : retirer `theme-color` en clair (inefficace → Safari retombe sur blanc). |
| `f6ebb8c` | Teinter canvas+chrome en rose pour matcher le dégradé (abandonné au commit suivant). |
| `4d3f824` | **Design final** : dégradé = 2 taches latérales, **surface unie en haut/bas** ; canvas + `theme-color` = surface unie `#f5f2f2`. Plus de cassure avec les bandes. |
| `38c1335` | Ressources alignée sur Settings/Formation (retrait `GradualBlurOverlay` bas) ; `theme-color` recréé (repaint sous modale) ; règle `.md`. |

Baseline avant session = commit **`470be5a`** (`git diff 470be5a..HEAD`).

---

## 2. Inventaire EXACT des fichiers modifiés

### 2.1 `src/app/globals.css`
- **`html`** : `background-color: var(--color-surface-page)` (surface unie, sert
  de fond au **canvas d'overscroll** iOS).
- **`body`** : passé de `background-color: var(--color-surface-page)` (opaque) à
  **`transparent`**. ⚠️ Changement de comportement structurel : le `body` ne
  peint plus de fond ; le seul fond est `.nc-app-bg`.
- **`.nc-app-bg`** (le fond global, `position: fixed; inset: 0; z-index: -1`,
  monté 1× dans le root layout) : dégradé **simplifié** = **2 `radial-gradient`
  latéraux** (gauche/droite, centrés verticalement) + couleur de base
  `var(--color-surface-page)`. Avant la session, le dégradé vivait dans un
  `::before` par page ; ici il est **global et unique**. Pas de `backdrop-filter`
  dessus (→ repaint correct au switch de thème).
- Incidence perf : `.nc-app-bg` est un grand élément `fixed` à gradients. Coût de
  **rastérisation/paint** au scroll possible sur mobile, mais **plus léger
  qu'avant** (2 gradients vs 4 coins + voile + bande linéaire auparavant).

### 2.2 `src/app/layout.tsx` (root layout)
- `viewport.themeColor` : passé d'une string `#f5f2f2` à un tableau
  `[{ media: light, color: #f5f2f2 }, { media: dark, color: #141211 }]`
  (pré-paint no-JS).
- **Retrait** du `<GradualBlurOverlay anchor="top" />` (mobile) qui était monté
  dans le `body`. → **une couche `backdrop-filter` en moins** (gain perf).
- `.nc-app-bg` (`<div aria-hidden>`) et `<ThemeColorMeta/>` inchangés dans leur
  montage.

### 2.3 `src/shared/components/theme/ThemeColorMeta.tsx`
Composant client monté globalement (root layout). Rôles :
- **`applyThemeColor(color)`** : écrit `<meta name="theme-color">`. Désormais il
  **RECRÉE** la balise (remove all + append) à chaque application, au lieu de
  muter `content` → force iOS à relire la valeur même quand une modale
  `backdrop-filter` est ouverte (point « switch de thème sous modale »).
  Fréquence : seulement au **changement de thème/override** (rare).
- `LIGHT_CHROME = "#f5f2f2"`, `DARK_SURFACE = "#141211"` (doivent rester synchro
  avec `--color-surface-page` et le `viewport.themeColor`).
- **`MutationObserver`** sur `document.documentElement` (filtre `class`) qui
  ré-applique `.dark` si React le retire (persistance navigation / streaming
  RSC). ⚠️ **À auditer en perf** : observer global d'attributs ; léger en
  théorie, mais à vérifier qu'aucun code ne « bat » la classe de `<html>` en
  boucle (ce qui ferait tourner `enforceThemeClass` souvent).
- `useSyncExternalStore` (override store) + `useContext(ThemeContext)` +
  `useIsoLayoutEffect([pathname, theme])` (enforceThemeClass à chaque
  navigation, trivial).

### 2.4 `src/app/(app)/ressources/page.tsx`, `…/ressource/[slug]/page.tsx`, `…/template/[slug]/page.tsx`
- **Retrait** de `<GradualBlurOverlay />` (bandeau bas, `position: fixed` +
  `backdrop-filter`) + son import. Ces pages se comportent maintenant comme
  Settings/Formation (contenu derrière la BottomNav translucide, padding
  `pb-[176px]`). → **3 couches `backdrop-filter` en moins** (gain perf), et fin
  du voile blanc + non-repaint au switch de thème.

### 2.5 Docs
- `docs/pwa/retrospective-bandes-ios-theme.md` : ajout §7 et §8 (historique).
- `docs/pwa/safari-web-pwa-integration.md` : **règle canonique** (modèle de fond,
  bandes Safari = theme-color, règles page/modale, checklist). À lire avant toute
  nouvelle page/modale.

> Note : le composant `src/shared/components/GradualBlurOverlay.tsx` n'est **plus
> utilisé** en runtime (seulement référencé par `.design-sync/previews`). Candidat
> à suppression en session perf si confirmé inutile.

---

## 3. Modèle runtime résultant (mental model)

```
html (background: surface unie)         ← canvas d'overscroll
 └─ .nc-app-bg (fixed, z-index:-1)       ← SEUL fond visible : dégradé (2 taches
     │                                      latérales) + base surface unie
     └─ body (transparent)
         └─ (app)/layout : Topbar / MobileTopActions / BottomNav (fixed) + {page}
             └─ .nc-page-halo (transparent) > main(z-index:1) > contenu
```

- **Bandes Safari** (notch haut / barre d'outils bas) = chrome Safari, **hors
  DOM**, couleur = `theme-color`. On ne contrôle que leur couleur.
- Le dégradé **fond vers la surface unie** en haut/bas → continuité avec les
  bandes (mêmes couleurs) + l'overscroll.
- Thème piloté par un **store JS** (`ThemeProvider`, localStorage → classe
  `.dark`), pas `next-themes`. `ThemeColorMeta` aligne `theme-color` + garde
  `.dark`.

---

## 4. Incidences PERFORMANCE — analyse honnête

### 4.1 Ce que mes changements coûtent réellement
- `.nc-app-bg` : grand élément `fixed` à 2 gradients → coût de **paint** au
  scroll possible (mobile). **Moins** lourd qu'avant la session.
- `ThemeColorMeta` : `MutationObserver` (class de `<html>`) + recréation de la
  balise au switch de thème. **Négligeable** sauf si la classe `<html>` est
  modifiée en boucle par ailleurs (à vérifier).
- **Aucun** ajout de fetch, de dépendance, de composant lourd, de JS bloquant.

### 4.2 Pourquoi ce n'est probablement PAS la cause des chargements infinis
- J'ai **retiré 4 couches `backdrop-filter`** (1 haut globale + 3 bas Ressources),
  qui sont parmi les effets les **plus coûteux** sur GPU mobile. Bilan net = on
  **allège** le rendu.
- « Temps de chargement infinis » = la page **ne s'affiche pas / reste en
  chargement**, ce qui relève du **fetch de données / réseau / cache**, pas d'un
  fond CSS (qui n'empêche jamais le contenu d'arriver).

### 4.3 Les VRAIS suspects à investiguer (session perf)
1. **`src/app/(app)/layout.tsx`** : à **chaque** page connectée, il `await` :
   - `getAuthUser()` (Supabase),
   - une RPC `user_has_capability` (Supabase),
   - `getCurrentProfile()`.
   Si Supabase est lent/inaccessible (réseau, cold start, RLS), **toutes** les
   pages bloquent sur le shell. **Suspect n°1.**
2. **Service Worker** (`ServiceWorkerRegistrar` + le SW PWA) : un SW mal configuré
   ou un cache périmé peut faire « tourner » le chargement à l'infini. **Suspect
   n°2** — vérifier la stratégie de cache, et tester en désinscrivant le SW.
3. **Data fetching des pages** (dashboard `getDashboardFormationData/ProfilData`,
   Ressources `getAllResourceItems`, etc.) via Supabase/Notion : latence,
   absence de cache, requêtes en cascade.
4. **Politique réseau de l'environnement d'exécution** (proxy sortant) : peut
   throttler/bloquer Supabase, Notion, Cloudinary.
5. **Polices self-hostées** (SF Pro, 4 graisses) : `display: swap` ne bloque pas
   le rendu, mais vérifier le poids/preload.

---

## 5. État des lieux fonctionnel

✅ Fonctionne (validé device) : fond unique en dégradé, switch clair/sombre sur
les pages principales, intégration des bandes haut/bas sans cassure, contenu qui
passe sous le notch, Ressources alignée sur Settings/Formation.

⚠️ Limites connues (documentées dans `safari-web-pwa-integration.md`) :
- Flou d'un overlay (éditeur de profil) qui ne se prolonge pas jusqu'au notch
  (cosmétique, non corrigé).
- Repaint du chrome Safari sous modale `backdrop-filter` : fiabilisé via
  recréation de la balise, mais reste un quirk WebKit potentiel sur vieux iOS.

---

## 6. Plan suggéré pour la session perf

1. **Mesurer d'abord** (ne pas optimiser à l'aveugle) :
   - `npm run build` (vérifier tailles de bundles, warnings).
   - Lighthouse / WebPageTest sur 2-3 pages (LCP, TTFB, TBT).
   - Onglet réseau : repérer les requêtes lentes (Supabase RPC, Notion).
2. **Isoler le shell** : chronométrer `(app)/layout.tsx` (auth + RPC). Mettre en
   cache / paralléliser / rendre non-bloquant si possible.
3. **Service worker** : tester en le désinscrivant ; auditer la stratégie de cache.
4. **Rendu** : profiler le paint de `.nc-app-bg` au scroll (si jank) — option
   `will-change`/`contain`, ou réduire encore les gradients.
5. **Nettoyage structurel** : supprimer `GradualBlurOverlay` si confirmé inutile ;
   vérifier qu'aucun composant ne re-toggle la classe `<html>` en boucle (coût
   du MutationObserver).

> Important : garder le **comportement visuel** actuel (désiré). La perf se joue
> côté data/SW/réseau, pas côté fond CSS — commencer par là.

---

## 7. Revert / reproduction

- Diff complet de la session : `git diff 470be5a..HEAD`.
- Pour repartir d'une base vierge **sans** l'intégration Safari (déconseillé,
  puisqu'elle est validée) : `git revert 470be5a..HEAD` ou comparer à `470be5a`.
- Fichiers à relire en priorité : `src/app/globals.css` (`html`, `body`,
  `.nc-app-bg`), `src/app/layout.tsx`, `src/shared/components/theme/ThemeColorMeta.tsx`,
  `src/app/(app)/layout.tsx` (perf shell).
