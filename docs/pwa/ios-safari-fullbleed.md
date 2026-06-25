# iOS Safari — fond plein-écran & barres « liquid glass » (mode navigateur)

> Pourquoi, sur iPhone en Safari (hors PWA), notre page montrait un **bandeau
> blanc en bas** alors que des sites comme `nike.com` laissent le contenu
> passer derrière une barre flottante translucide — et comment on l'a corrigé.

---

## TL;DR

Ce **n'est pas** un problème de « chargement de page » Safari ni de
`theme-color`. C'était notre app qui :

1. peignait un **aplat opaque** couleur de page en bas de chaque page
   (`.nc-mobile-bottom-fade`) qui **recouvrait** le contenu → le contenu
   n'atteignait jamais le bord bas → bandeau ;
2. avait une **BottomNav** au fond quasi opaque (`0.92`) ;
3. sur Communauté & Coaching, scrolle un **conteneur interne**
   (`h-dvh overflow-hidden`) au lieu du document → Safari **ne replie jamais**
   sa barre en pilule flottante sur ces pages.

Nike, lui : **document-scroll** + média **full-bleed** jusqu'au bord + **aucun
chrome d'app en bas**. Quand Safari replie sa barre, le média est déjà là
derrière la pilule translucide.

---

## Comment fonctionne la barre Safari iOS (15 → 26)

- **Deux états** : *déployée* (haute : URL + rangée d'outils) et *repliée*
  (pilule flottante translucide « liquid glass »).
- **Le repli est piloté par le scroll du _document racine_.** Safari replie la
  barre au scroll vers le bas du `<body>`/document. Il **ne réagit pas** au
  scroll d'un conteneur interne `overflow: scroll/hidden`.
- **Unités de viewport** :
  - `100svh` = *small* (barre déployée),
  - `100lvh` = *large* (barre repliée),
  - `100dvh` = *dynamic* (valeur courante).
  Pour que le contenu existe **derrière** la barre, le dimensionner en
  `lvh`/fixed (on utilise déjà `minHeight: 100lvh` sur les pages document-scroll).
- **`viewport-fit=cover` + `env(safe-area-inset-*)`** : laissent le contenu
  s'étendre sous le notch et la barre de gestes. Déjà en place
  (cf. `src/app/layout.tsx`).
- **`theme-color`** : teinte la barre déployée + la zone status bar. Piloté
  dynamiquement par `ThemeColorMeta` (cf. `docs` / `src/shared/components/theme/
  ThemeColorMeta.tsx`) — ne concerne PAS le bandeau du bas.

**→ Effet Nike = document-scroll + contenu full-bleed jusqu'au bord bas +
aucun aplat opaque par-dessus.**

---

## Anatomie du bas de page NotionClub

Empilement (du bord bas vers le haut), avant correction :

1. `html` — canvas peint `--color-surface-page` (`globals.css`, règle `html`).
2. Barre Safari (système), par-dessus la page.
3. **`.nc-mobile-bottom-fade`** — `position: fixed; bottom: 0`,
   `height: env(safe-area-inset-bottom) + 96px`, `z-index: 44`.
   👉 c'était l'**aplat opaque** = le bandeau.
4. **BottomNav** — pilule fixe `rgba(255,255,255,0.92)` (`BottomNav.tsx`).
5. Contenu (cartes) qui scrolle derrière.

Monté pour toutes les pages connectées dans `src/app/(app)/layout.tsx`.

---

## Correctifs appliqués

### 1. `.nc-mobile-bottom-fade` → frosted glass (le vrai fix)

`globals.css`. On **floute** le contenu qui passe dessous au lieu de le
**recouvrir** d'un aplat : le voile de couleur passe de `100 %` opaque au bord
à `≤ 30 %`, le `backdrop-filter: blur` est conservé. Résultat : le contenu
bleed jusqu'au bord bas et transparaît derrière la barre, façon média Nike sous
la pilule Safari.

### 2. BottomNav plus translucide (tunable)

`--nc-bottom-nav-bg` : light `0.92 → 0.82`, dark `0.88 → 0.80`. Le
`backdrop-filter: blur(20px)` garde les icônes lisibles. Valeur ajustable si la
lisibilité sur contenu chargé en pâtit.

---

## Connu / non traité (décision produit séparée)

- **Communauté & Coaching** utilisent `h-dvh overflow-hidden`
  (`(app)/communaute/(shell)/layout.tsx`, `coaching/CoachingPageClient.tsx`).
  C'est un **shell type messagerie** (composer épinglé en bas, liste qui scrolle
  en interne). Conséquence : Safari **n'y replie jamais** sa barre. Passer ces
  pages en document-scroll donnerait l'effet flottant Nike **mais** casserait
  le composer épinglé — **non modifié** ici, à arbitrer séparément.
- **Comparaison Nike imparfaite** : Nike n'a **pas** de barre de navigation
  persistante. NotionClub si → on ne peut pas atteindre « zéro chrome », mais on
  obtient « contenu qui bleed + barres translucides » au lieu d'un bandeau plein.

---

## Checklist de validation (sur device réel via la preview Vercel)

- [ ] Safari iPhone (hors PWA), page Ressources : le contenu atteint le bord bas,
      plus d'aplat blanc ; la BottomNav laisse deviner le contenu derrière.
- [ ] Scroll vers le bas : la barre Safari se replie en pilule flottante, le
      contenu reste visible derrière.
- [ ] Thèmes clair ET sombre.
- [ ] PWA standalone : la `safe-area-inset-bottom` (home indicator) reste
      correctement gérée, pas de saut de la BottomNav.
