# iOS Safari — app-shell, nav statique & full-bleed (Liquid Glass)

> Deux problèmes mobiles distincts, longtemps confondus, et leur résolution.
> À lire avant de toucher au layout mobile partagé (`(app)/layout.tsx`,
> `globals.css`, `BottomNav`).

---

## TL;DR

| # | Symptôme | Cause racine | Correctif |
|---|---|---|---|
| 1 | La BottomNav « remonte » au scroll (Safari + PWA) | Le **document** scrolle → iOS anime sa barre + `env(safe-area-inset-bottom)` bascule 0↔34px + rebond élastique → la nav `position: fixed` suit | **App-shell** : le contenu scrolle dans `#app-scroll`, le document **jamais** |
| 2 | Bande de fond plat sous la nav (Safari navigateur) | Safari 26 composite sous sa **barre en verre** les pixels présents derrière elle ; sous la nav il n'y a que `background-color` plat → bande | **Frosted glass + nav translucide** pour que du **contenu** transparaisse derrière, pas du fond plat |

---

## Problème 1 — la nav bouge au scroll

### Mécanique iOS
La barre d'outils de Safari se replie/déploie au scroll du **document racine**,
ce qui modifie le viewport visible. Une barre `position: fixed; bottom: …` suit
ce mouvement. En PWA standalone, c'est le **rebond élastique** du `<body>` qui
la fait bouger. Avant, une seule page sur deux scrollait le document (archi
incohérente : `minHeight: 100lvh` vs `h-dvh overflow-hidden`).

### Correctif — app-shell unifié
`src/app/(app)/layout.tsx` enveloppe tout le contenu connecté dans un conteneur
unique :

```
.nc-app-scroll { position: fixed; inset: 0; overflow-y: auto;
                 overscroll-behavior-y: contain; }
```

Le **document ne scrolle plus** (le contenu scrolle dans `#app-scroll`) → iOS
n'anime jamais sa barre, pas de rebond `<body>` → la BottomNav `fixed` est
**statique**, Safari ET PWA. Les routes hors `(app)` (auth, privacy, terms)
gardent le scroll document normal (elles n'utilisent pas le shell).

### Ramifications gérées
- **Verrou de scroll des modales** : les ~9 modales font `body.style.overflow =
  "hidden"`, désormais sans effet (le body ne scrolle plus). `ScrollLockBridge`
  (`src/shared/components/ScrollLockBridge.tsx`) observe le `<body>` et miroir
  l'overflow sur `#app-scroll` → toutes les modales re-verrouillent le fond,
  sans modifier leur code.
- **Scroll-to-top Formation** : `window.scrollTo` → `scrollAppToTop()`
  (`src/shared/lib/appScroll.ts`), qui cible `#app-scroll`.
- **Shells chat** (Communauté, Coaching) : `h-dvh` → `h-full` pour remplir
  exactement `#app-scroll` (sinon scroll fantôme). Leur scroll interne (composer
  épinglé) est inchangé.

---

## Problème 2 — la bande de fond plat

### Mécanique iOS 26 (Liquid Glass)
Il n'existe **aucun interrupteur Apple** « contenu derrière les barres ».
La barre basse de Safari 26 est en **verre** et **échantillonne les pixels** de
la page derrière elle. S'il y a du contenu → effet de profondeur. S'il n'y a que
`html { background-color: #f5f2f2 }` plat → ça se lit comme une bande.
`viewport-fit=cover` étend le viewport sous les barres, mais l'inset libéré est
rempli par défaut avec la `background-color` du body/html — c'est ce fond plat
qu'on voit.

### Ce qui NE marche PAS (vérifié)
- ❌ `theme-color` (y compris `ThemeColorMeta`) : **quasi inerte** sur le chrome
  bas de Safari 26. Gardé seulement pour Android / anciens iOS.
- ❌ Unités de viewport seules (`100dvh`/`svh`/`lvh`) : dimensionnent un
  conteneur ; vide, il reste du fond plat.
- ❌ Aplat opaque couleur de page au bord bas : c'était la bande elle-même.
- ❌ Augmenter `padding-bottom` : agrandit la zone de fond plat → aggrave.

### Correctif — faire transparaître du contenu
- `.nc-mobile-bottom-fade` en **frosted glass** (voile ≤ 30 % + `blur`), pas un
  aplat → le contenu se dissout sous la nav au lieu d'être recouvert.
- BottomNav **translucide** (`--nc-bottom-nav-bg` : `0.82` light / `0.80` dark) +
  `blur(20px)` → on devine le contenu qui défile derrière la pilule, que Safari
  composite sous sa barre en verre.
- Possible (rendu translucide **sans danger** uniquement parce que l'app-shell a
  supprimé le mouvement de la nav — sinon la translucidité révèle le saut).

### Plafond assumé (choix produit)
Avec une **BottomNav persistante**, on n'atteint pas le « zéro chrome » de Nike
(qui n'a aucun chrome d'app en bas). Cible réaliste et tenue : « nav en verre qui
laisse deviner le contenu qui défile derrière ». Levier supplémentaire possible
si besoin : réduire le `pb-[…]` des pages pour que la grille bleed davantage sous
la nav (à évaluer page par page, risque de régression visuelle).

---

## Sources
- WebKit — *Designing Websites for iPhone X* (safe-area, inset rempli par la bg).
- *WebKit Features in Safari 26.0* / WWDC25 session 233.
- Reverse-engineering Liquid Glass (Apple ne documente pas le tinting du chrome).

---

## Checklist de validation (device réel via preview Vercel)
- [ ] Safari iPhone (hors PWA) : la BottomNav ne bouge PLUS au scroll.
- [ ] PWA standalone : idem, pas de rebond qui décale la nav.
- [ ] Contenu visible/flouté derrière la nav translucide (clair ET sombre).
- [ ] Modales : le fond ne scrolle pas derrière (ScrollLockBridge OK).
- [ ] Formation : changement de leçon → remonte bien en haut.
- [ ] Communauté/Coaching : composer épinglé, scroll interne OK.
