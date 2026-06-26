# Règles d'intégration des pages & modales sur Safari Web / PWA (iOS)

> Règle canonique. **Toute nouvelle page, modale, pop-up ou overlay** plein
> écran DOIT respecter ce document, sinon on réintroduit les bugs de « bandes »
> haut/bas et de non-persistance du thème sur iOS (cf.
> `retrospective-bandes-ios-theme.md` pour l'historique des échecs).

---

## 1. Le modèle de fond — UN seul calque

Il n'y a **qu'un seul fond visible** dans toute l'app : `.nc-app-bg`
(`src/app/globals.css`), monté **une fois** dans le root layout.

| Élément | Rôle | Fond |
|---|---|---|
| `html` | base du **canvas** (overscroll iOS / rubber-band) + 1ʳᵉ frame | `var(--color-surface-page)` (surface unie : `#f5f2f2` clair / `#141211` sombre) |
| **`.nc-app-bg`** | **seul fond visible** : dégradé fixe plein écran | dégradé + base surface (opaque, autoportant) |
| `body` | boîte qui scrolle | **`transparent`** |
| `.nc-page-halo` | wrapper de page | **transparent** |
| contenu | cartes, texte | leurs propres surfaces |

**Pourquoi `body` transparent** : un `background-color` opaque sur `body` se
peint AU-DESSUS d'un enfant en `z-index` négatif (ordre de peinture CSS), donc il
masquait `.nc-app-bg` et « se décrochait » au scroll. Ne jamais remettre de fond
opaque sur `body`, `html` (autre que la surface unie), `.nc-page-halo`, ou un
wrapper de page.

---

## 2. Les « bandes » Safari ne sont PAS dans le DOM

En **Safari navigateur**, les zones haut (status-bar) et bas (barre d'outils)
sont du **chrome Safari**, peint par le navigateur — pas par notre DOM. On ne
peut PAS les rendre transparentes ni changer leur forme. On ne contrôle que
**leur couleur**, via `<meta name="theme-color">`.

De même, l'**overscroll** iOS (pull-to-refresh) révèle le fond du `<html>`
(canvas), pas `.nc-app-bg` (qui est `fixed` et suit l'élastique).

### Conséquence — la règle de design du fond

Le dégradé `.nc-app-bg` doit **fondre vers la surface unie** (`--color-surface-page`)
en **haut et en bas**, pour rejoindre sans cassure :
- les bandes Safari (réglées sur cette même surface via `theme-color`),
- le canvas d'overscroll (`html`, même surface).

Concrètement (light) : les accents de marque sont **2 taches latérales**
(gauche/droite), **centrées verticalement** et de hauteur limitée → le haut et le
bas (~25 %) restent en surface unie. **Interdit** : poser de la couleur (coins,
fondus colorés) sur la limite haute/basse → ça crée une cassure nette avec les
bandes.

`theme-color`, `html`, et la couleur vers laquelle le dégradé fond DOIVENT rester
**synchronisés** :
- `--color-surface-page` (globals.css) — `#f5f2f2` / `#141211`
- `LIGHT_CHROME` / `DARK_SURFACE` (`ThemeColorMeta.tsx`)
- `viewport.themeColor` (`layout.tsx`)

---

## 3. Pilotage du `theme-color` (barres Safari)

`ThemeColorMeta` (`src/shared/components/theme/ThemeColorMeta.tsx`) écrit
`theme-color` selon le thème **réel** de l'app (store JS, qui peut diverger de
l'OS), pas selon `prefers-color-scheme`.

Règles **non négociables** :

1. **Jamais** de `backdrop-filter` SUR l'élément qui porte la couleur de
   `theme-color` ni sur `.nc-app-bg`. Un calque qui combine `backdrop-filter` +
   couleur pilotée par variable **ne se repeint pas** au changement de thème sur
   iOS (bug WebKit confirmé).
2. La balise `theme-color` est **recréée** (remove + append) à chaque changement,
   pas mutée — c'est ce qui force Safari à relire la valeur quand une couche
   `backdrop-filter` (modale) est composée par-dessus.
3. La classe `.dark` sur `<html>` est maintenue par un `MutationObserver`
   (persistance à la navigation / streaming RSC). Ne pas retirer cette garde.

---

## 4. Règles pour une nouvelle PAGE

Gabarit (cf. `dashboard`, `settings`, `formation`) :

```tsx
<>
  {/* Chrome fixe (Topbar/MobileTopActions/BottomNav) est monté par (app)/layout,
      PAS ici. */}
  <div className="nc-page-halo" style={{ minHeight: "100lvh" }}>
    <main style={{ position: "relative", zIndex: 1 }}>
      <div className="px-4 pt-[96px] pb-[120px] md:px-10 md:pt-[148px] md:pb-10">
        {/* contenu */}
      </div>
    </main>
  </div>
</>
```

À respecter :
- ✅ `.nc-page-halo` **transparent**, `min-height: 100lvh`.
- ✅ Padding haut (`pt-[96px]` / `md:pt-[148px]`) pour passer sous le notch +
  chrome ; padding bas (`pb-[120px]`+) pour dégager la dernière ligne au-dessus
  de la BottomNav.
- ✅ Le contenu scrolle **derrière la BottomNav translucide** (pilule
  `var(--nc-bottom-nav-bg)`, **sans** `backdrop-filter` → se repeint).
- ❌ **NE PAS** ajouter de bandeau bas fixe en `backdrop-filter`
  (`GradualBlurOverlay anchor="bottom" position="fixed"`) : il rend un voile
  blanchâtre et ne se repeint pas au switch de thème sur iOS. C'était le bug de
  la page Ressources (supprimé). Les pages full-screen (Settings, Formation) n'en
  ont jamais eu et c'est le comportement de référence.
- ❌ Aucun fond opaque sur le wrapper de page.

---

## 5. Règles pour une MODALE / POP-UP / OVERLAY (peu importe le z-index)

Le switch de thème (clair/sombre) DOIT se propager aux barres Safari **même quand
une modale est ouverte** — pas seulement après fermeture.

1. **Toujours** piloter le thème via `ThemeContext` (`useTheme()` →
   `setPreference`/`toggleTheme`). Ne jamais bidouiller la classe `.dark` ou
   `theme-color` à la main dans un composant.
2. Le composant qui change le thème (ex. `ThemeToggle`/`AppearanceSection`) doit
   être **dans l'arbre React sous `<ThemeProvider>`** (un `createPortal` est OK :
   le contexte React traverse les portails). **Jamais** dans une `<iframe>** (doc
   séparé → store de thème distinct → le parent ne bascule pas).
3. Toute couleur/teinte d'un overlay qui doit suivre le thème passe par les
   tokens `--color-*` (jamais une couleur en dur). Pas de `backdrop-filter` +
   couleur-variable sur le même élément (cf. §3.1).
4. Surfaces d'overlay (sheets, modales) = `var(--color-surface-page)` /
   `var(--color-surface-card)` → suivent le thème automatiquement.

### Limitation connue (acceptée)

- Sur iOS, si un overlay applique un `backdrop-filter` plein écran, le repaint du
  chrome Safari peut rester légèrement décalé d'une frame. La recréation de la
  balise `theme-color` (§3.2) couvre le cas courant ; si un overlay persiste à ne
  pas propager, vérifier qu'il n'introduit pas un `backdrop-filter` coloré.
- Le **flou de fond** d'un overlay (ex. backdrop de l'éditeur de profil) ne se
  prolonge pas forcément dans la zone du notch (le voile s'arrête au bord du
  contenu, pas sous la status-bar). Cosmétique, non bloquant. Si besoin d'un flou
  continu jusqu'au notch : étendre l'élément flouté sous `env(safe-area-inset-top)`
  (et compenser le contenu), au lieu de l'ancrer à `top: 0` du contenu.

---

## 6. Checklist avant de merger une page/modale

- [ ] `body` / wrapper de page **transparents** (aucun fond opaque réintroduit).
- [ ] Page : `.nc-page-halo` + paddings notch/BottomNav, **aucun** bandeau bas
      `backdrop-filter` fixe.
- [ ] Thème piloté via `ThemeContext` ; aucun `theme-color`/`.dark` manipulé à la
      main hors `ThemeColorMeta`/`ThemeProvider`.
- [ ] Aucun élément combinant `backdrop-filter` + couleur pilotée par variable.
- [ ] Testé **sur device** (iPhone Safari **et** PWA installée) : scroll sous le
      notch, overscroll (pull-to-refresh), barres haut/bas, et **switch clair↔sombre
      modale ouverte**.

---

## 7. Fichiers de référence

- `src/app/globals.css` — `html`, `body`, `.nc-app-bg`, `.nc-page-halo`.
- `src/app/layout.tsx` — `viewport.themeColor`, montage `.nc-app-bg` + `ThemeColorMeta`.
- `src/shared/components/theme/ThemeColorMeta.tsx` — `LIGHT_CHROME`/`DARK_SURFACE`,
  `applyThemeColor` (recréation de la balise), garde `.dark`.
- `src/shared/components/theme/ThemeProvider.tsx` — store de thème (source de vérité).
- `docs/pwa/retrospective-bandes-ios-theme.md` — historique & pièges déjà essayés.
