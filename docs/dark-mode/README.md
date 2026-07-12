# Dark Mode — Documentation complète

> Dernière mise à jour : 2026-05-24
> Branche de référence : `claude/funny-johnson-LDm9e` → PR #67

---

## Table des matières

1. [Objectif et DA](#1-objectif-et-da)
2. [Architecture CSS — comment ça fonctionne](#2-architecture-css--comment-ça-fonctionne)
3. [Palette dark mode](#3-palette-dark-mode)
4. [Tous les tokens CSS](#4-tous-les-tokens-css)
5. [ThemeProvider](#5-themeprovider)
6. [Composants modifiés — inventaire complet](#6-composants-modifiés--inventaire-complet)
7. [Patterns récurrents](#7-patterns-récurrents)
8. [Problèmes résolus et leurs causes](#8-problèmes-résolus-et-leurs-causes)
9. [Ce qui reste à faire](#9-ce-qui-reste-à-faire)
10. [Prompt de reprise de contexte](#10-prompt-de-reprise-de-contexte)

---

## 1. Objectif et DA

### Intention

Dark mode élégant, sobre, sans recréer une identité "pure noire". L'identité rouge NC (`#e0625a`) reste présente via les accents, boutons, réactions — mais le fond devient une profondeur near-black chaude, pas un noir pur.

### Règles DA appliquées

| Règle | Application |
|---|---|
| Éviter le noir pur | `#141211` au lieu de `#000000` — évite l'effet halo sur les yeux |
| Contraste minimum 7:1 pour le texte important | `--color-text-primary: #f2edeb` → ~15:1 sur fond page |
| Accents désaturés en dark | Brand reste `#e0625a` (rouge vif), mais utilisé avec parcimonie |
| Profondeur par luminosité | Surfaces de plus en plus claires = de plus en plus proches de l'utilisateur |
| Halo rouge signature retiré | `nc-page-halo::before { background: none }` en dark — la profondeur du fond suffit |

### Système de profondeur (z-axis par luminosité)

```
#141211  ← --color-surface-page   (page, le plus sombre)
#201d1b  ← --color-surface-raised (nav pills, inputs, conteneurs secondaires)
#2a2725  ← --color-surface-card   (modales, dropdowns, cards, le plus proche)
```

---

## 2. Architecture CSS — comment ça fonctionne

### Approche : cascade CSS pure, zéro logique React

Tous les composants utilisent uniquement des `var(--color-*)`. Le changement de thème = ajout/suppression de la classe `.dark` sur `<html>`. Aucun `if (isDark)` dans le JSX pour les couleurs (sauf `StatusBadge` dans FeedbackWidget, cas particulier avec des valeurs JS inline).

### Structure de `globals.css`

```
:root { }                   ← shadcn/ui tokens (oklch) — light
.dark { }                   ← shadcn/ui dark + NC dark tokens
@theme inline { }           ← Tailwind v4 theme mapping + NC light tokens
:root { }                   ← NC radius, shadows, animations + new tokens
[...classes utilitaires...] ← .nc-page-halo, .nc-topbar-pill, etc.
html.dark { }               ← BLOC DE RENFORCEMENT (en dernier, voir §2.1)
```

### 2.1 Problème Tailwind v4 + solution `html.dark`

**Problème** : En Tailwind v4, `@theme inline {}` génère des variables dans `:root`. CSS specificity : `:root` = `[0,0,1]`, `.dark` = `[0,1,0]`. Théoriquement `.dark` gagne — mais l'ordre de compilation de Tailwind peut interférer.

**Solution** : bloc `html.dark {}` ajouté en **toute fin** de `globals.css`. Spécificité `[0,1,1]` (élément + classe) — gagne sur tout `:root` quelle que soit la compilation.

```css
/* Toujours EN DERNIER dans globals.css */
html.dark {
  --color-text-primary: #f2edeb;
  --color-surface-card: #2a2725;
  /* ... tous les tokens NC dark ... */
}
```

### 2.2 CSS Modules et dark mode

Les CSS Modules (ex. `FeedbackWidget.module.css`) ne supportent pas `.dark` en sélecteur direct. Il faut utiliser `:global(.dark)` :

```css
/* Dans un .module.css */
:global(.dark) .modal {
  box-shadow: 0 32px 80px -16px rgba(0, 0, 0, 0.56), ...;
}
```

Les `var(--color-*)` dans les CSS Modules héritent bien du cascade — seuls les overrides spécifiques au dark nécessitent `:global(.dark)`.

---

## 3. Palette dark mode

### Texte

| Token | Valeur dark | Contraste sur fond page | Usage |
|---|---|---|---|
| `--color-text-primary` | `#f2edeb` | ~15:1 | Titres, labels, contenu principal |
| `--color-text-secondary` | `#a89e9b` | ~7:1 | Texte secondaire, descriptions |
| `--color-text-muted` | `#857a77` | ~4.5:1 | Hints, placeholders, métadonnées |

### Surfaces

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-surface-page` | `#f5f2f2` | `#141211` | Fond de page |
| `--color-surface-raised` | `#f5f5f5` | `#201d1b` | Inputs, conteneurs secondaires |
| `--color-surface-card` | `#ffffff` | `#2a2725` | Cards, modales, dropdowns |
| `--color-border-default` | `#e5e7eb` | `#332e2b` | Toutes les bordures |

### Brand et interactions

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-brand` | `#e0625a` | `#e0625a` | Accent (inchangé) |
| `--nc-nav-active-bg` | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.09)` | Item nav actif |
| `--nc-nav-hover-bg` | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.05)` | Hover nav |

### Composants spéciaux

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--nc-btn-dark-bg` | `#1a1a1a` | `#ede9e6` | Boutons CTA sombres (invertis) |
| `--nc-btn-dark-text` | `#ffffff` | `#141211` | Texte sur CTA sombres |
| `--nc-segmented-active-bg` | `#ffffff` | `rgba(255,255,255,0.92)` | Onglet/toggle actif |
| `--nc-segmented-active-text` | `#000000` | `#141211` | Texte sur onglet actif |
| `--nc-bottom-nav-bg` | `rgba(255,255,255,0.92)` | `rgba(28,25,23,0.88)` | Pill BottomNav mobile |
| `--nc-bottom-nav-border` | `rgba(229,231,235,0.9)` | `rgba(55,50,47,0.9)` | Bordure BottomNav |
| `--nc-card-dot-color` | `rgba(224,98,90,0.28)` | `rgba(255,255,255,0.18)` | Dots hover sur resource/template cards |
| `--nc-lock-overlay-bg` | `rgba(255,255,255,0.72)` | `rgba(20,18,17,0.87)` | Overlay frosted glass (FreeTeaserPanel) |
| `--nc-switch-off-bg` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.14)` | SwitchToggle fond OFF |
| `--nc-btn-disabled-bg` | `#e5e7eb` | `rgba(255,255,255,0.08)` | Fond bouton désactivé |
| `--nc-btn-disabled-text` | `#9ca3af` | `rgba(255,255,255,0.28)` | Texte bouton désactivé |
| `--nc-tag-general-bg/text` | `rgba(0,0,0,0.06)` / secondary | `rgba(255,255,255,0.07)` / secondary | Tag "Général" |
| `--nc-tag-question-bg/text` | `rgba(59,130,246,0.10)` / `#1d4ed8` | `rgba(59,130,246,0.12)` / `#60a5fa` | Tag "Question" |
| `--nc-tag-presentation-bg/text` | `rgba(34,197,94,0.10)` / `#15803d` | `rgba(34,197,94,0.09)` / `#4ade80` | Tag "Présentation" |
| `--nc-tag-annonce-bg/text` | `rgba(224,98,90,0.12)` / `#c0392b` | same / brand | Tag "Annonce" |

---

## 4. Tous les tokens CSS

Emplacement canonique : `src/app/globals.css`

### Light mode (dans `@theme inline {}` + second `:root {}`)

```css
@theme inline {
  --color-brand: #e0625a;
  --color-text-primary: #000000;
  --color-text-secondary: #52525b;
  --color-text-muted: #64748b;
  --color-surface-page: #f5f2f2;
  --color-surface-raised: #f5f5f5;
  --color-border-default: #e5e7eb;
  --color-surface-card: #ffffff;
}

:root {
  --nc-radius-xs: 12px;
  --nc-radius-sm: 16px;
  --nc-radius-md: 24px;
  --nc-radius-xl: 100px;
  --nc-radius-2xl: 9999px;
  --nc-shadow-2: ...;
  --nc-shadow-3: ...;
  --nc-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --nc-duration-fast: 200ms;
  --nc-duration-normal: 250ms;
  --nc-duration-slow: 300ms;
  --nc-nav-active-bg: rgba(0, 0, 0, 0.07);
  --nc-nav-hover-bg: rgba(0, 0, 0, 0.04);
  --nc-segmented-active-bg: #ffffff;
  --nc-segmented-active-text: #000000;
  --nc-btn-dark-bg: #1a1a1a;
  --nc-btn-dark-text: #ffffff;
  --nc-bottom-nav-bg: rgba(255, 255, 255, 0.92);
  --nc-bottom-nav-border: rgba(229, 231, 235, 0.9);
}
```

### Dark mode (dans `.dark {}` ET bloc `html.dark {}` à la fin)

```css
html.dark {
  --color-brand: #e0625a;
  --color-text-primary: #f2edeb;
  --color-text-secondary: #a89e9b;
  --color-text-muted: #857a77;
  --color-surface-page: #141211;
  --color-surface-raised: #201d1b;
  --color-surface-card: #2a2725;
  --color-border-default: #332e2b;
  --nc-nav-active-bg: rgba(255, 255, 255, 0.09);
  --nc-nav-hover-bg: rgba(255, 255, 255, 0.05);
  --nc-segmented-active-bg: rgba(255, 255, 255, 0.92);
  --nc-segmented-active-text: #141211;
  --nc-btn-dark-bg: #ede9e6;
  --nc-btn-dark-text: #141211;
  --nc-bottom-nav-bg: rgba(28, 25, 23, 0.88);
  --nc-bottom-nav-border: rgba(55, 50, 47, 0.9);
}
```

---

## 5. ThemeProvider

Fichier : `src/shared/components/theme/ThemeProvider.tsx`

### Fonctionnement

- `useSyncExternalStore` pour la réactivité sans flash
- Lit `localStorage.getItem("theme")` → `"light" | "dark" | "system"`
- `"system"` → suit `window.matchMedia("(prefers-color-scheme: dark)")`
- Applique la classe via `document.documentElement.classList.add("dark")`
- FOUC évité par un script inline dans `<head>` (THEME_INIT_SCRIPT) qui lit localStorage et applique la classe avant le premier paint

### Hook d'accès

```tsx
import { useTheme } from "@/shared/lib/hooks/useTheme";

const { theme, preference, setPreference, toggleTheme } = useTheme();
// theme: "light" | "dark"
// preference: "light" | "dark" | "system"
```

### Toggle UI

`src/shared/components/theme/ThemeToggle.tsx` — deux variantes :
- `variant="segmented"` : 3 boutons (Clair / Système / Sombre) dans le dropdown avatar de la Topbar
- `variant="compact"` : toggle switch on/off pour les settings

---

## 6. Composants modifiés — inventaire complet

### `src/app/globals.css`
- Ajout bloc `html.dark {}` (renforcement spécificité)
- Ajout tokens `--nc-btn-dark-*`, `--nc-bottom-nav-*`, `--nc-segmented-*`, `--nc-nav-*`
- `.dark .nc-page-halo::before { background: none }` — halo rouge supprimé
- Classes utilitaires dark : `.nc-mobile-action-btn`, `.nc-topbar-pill`, `.nc-dropdown-panel`

### Navigation desktop
- `src/shared/components/dashboard/Topbar.tsx` — pill, séparateur, nav items, dropdown

### Navigation mobile
- `src/shared/components/dashboard/mobile/BottomNav.tsx` — pill bg/border → tokens, icônes/labels → `--color-text-primary`
- `src/shared/components/dashboard/mobile/MobileTopActions.tsx` — boutons flottants Bell → `.nc-mobile-action-btn`

### Thème
- `src/shared/components/theme/ThemeToggle.tsx` — thumb toggle : `"white"` → `var(--nc-segmented-active-bg)`

### Auth
- `src/modules/auth/components/AuthCard.tsx` — tab switcher : `bg-white` → `bg-[var(--nc-segmented-active-bg)]`

### Communauté (module complet)
- `src/modules/community/routes/community-page.tsx` — conteneur, tab switcher
- `src/modules/community/components/feed/PostCard.tsx`
- `src/modules/community/components/feed/FeedTagFilters.tsx`
- `src/modules/community/components/feed/FeedSkeletonState.tsx`
- `src/modules/community/components/messages/MessagesLayout.tsx`
- `src/modules/community/components/messages/MessageBubble.tsx`
- `src/modules/community/components/messages/MessageComposer.tsx`
- `src/modules/community/components/messages/ConversationThread.tsx`
- `src/modules/community/components/messages/NewConversationModal.tsx`
- `src/modules/community/components/notifications/NotificationPopover.tsx`
- `src/modules/community/components/post-composer/PostComposerModal.tsx`
- `src/modules/community/components/post-composer/PostComposerAdminFields.tsx`
- `src/modules/community/components/post-composer/PostComposerTagSelect.tsx`
- `src/modules/community/components/post-detail/CommentComposer.tsx`
- `src/modules/community/components/shared/ReactionsBar.tsx`
- `src/modules/community/components/shared/RestrictedTooltip.tsx`
- `src/modules/community/components/shared/TagPill.tsx`
- `src/modules/community/components/shared/UserAvatar.tsx`

### Formation
- `src/modules/formation/components/FormationIndexClient.tsx`
- `src/modules/formation/components/LessonNavigation.tsx`
- `src/modules/formation/components/LessonNotes.tsx`
- `src/modules/formation/components/ModuleAccordion.tsx`
- `src/modules/formation/components/ProgramCard.tsx`
- `src/modules/formation/components/ProgramPageClient.tsx`
- `src/modules/formation/components/ResourceCard.tsx`

### Ressources
- `src/modules/ressources/components/FilloutModal.tsx`
- `src/modules/ressources/components/ResourceCard.tsx`
- `src/modules/ressources/components/ResourcesGrid.tsx`
- `src/modules/ressources/components/TemplateCard.tsx`
- `src/modules/ressources/components/shared/ResourcePageFooter.tsx`
- `src/modules/ressources/components/shared/TemplatePageFooter.tsx`
- `src/app/(app)/ressources/template/[slug]/DuplicateButton.tsx` — CTA noir → `--nc-btn-dark-bg`

### Coaching
- `src/shared/components/coaching/CallCard.tsx`
- `src/shared/components/coaching/CoachingCTACard.tsx` — CTA `#18181b` → `--nc-btn-dark-bg`
- `src/shared/components/coaching/CoachingHeader.tsx` — CTA `#000` → `--nc-btn-dark-bg`
- `src/shared/components/coaching/FilloutModal.tsx`
- `src/shared/components/coaching/FreeTeaserPanel.tsx` — skeleton `#f5f5f5`/`#e5e7eb` → tokens

### Settings
- `src/shared/components/settings/AvatarCropper.tsx`
- `src/shared/components/settings/AvatarPicker.tsx`
- `src/shared/components/settings/DangerZone.tsx`
- `src/shared/components/settings/EmailField.tsx`
- `src/shared/components/settings/NotificationsSection.tsx` (+ résolution conflit rebase)
- `src/shared/components/settings/NotificationsSection.tsx`
- `src/shared/components/settings/PhoneField.tsx`
- `src/shared/components/settings/ProfileHero.tsx`
- `src/shared/components/settings/SecuritySection.tsx`
- `src/shared/components/settings/SettingsCard.tsx`
- `src/shared/components/settings/SubscriptionSection.tsx`

### Dashboard
- `src/shared/components/dashboard/EmailConfirmBannerActions.tsx`
- `src/shared/components/dashboard/NotificationPopover.tsx`
- `src/shared/components/dashboard/widgets/FormationWidget.tsx`
- `src/shared/components/dashboard/widgets/ProfilWidget.tsx`
- `src/app/(app)/dashboard/page.tsx` — barre recherche mobile `bg-white` → token

### Feedback widget
- `src/shared/components/feedback-widget/FeedbackWidget.module.css` — remplace tous les `#ffffff`/`#1a1a1a`, ajout `:global(.dark)` overrides
- `src/shared/components/feedback-widget/FeedbackWidget.tsx` — `STATUS_COLORS` theme-aware via `useTheme`

### UI partagé
- `src/shared/components/ui/MacOSWindowBar.tsx`

---

## 7. Patterns récurrents

### Arrière-plan de carte/modale

```tsx
// ✅ Correct
style={{ background: "var(--color-surface-card)" }}

// ❌ À ne jamais faire
style={{ background: "white" }}
style={{ background: "#ffffff" }}
style={{ background: "#fff" }}
```

### Bouton secondaire / d'annulation — contraste GARANTI (règle racine)

> Un bouton ne doit **jamais** reprendre la couleur de fond de la surface qui le
> porte : sinon il devient invisible (surtout en dark, ex. le « Annuler » d'une
> modale sur `--color-surface-card`). Le motif de référence est le bouton
> « Se déconnecter » de la `DangerZone`.

```tsx
// ✅ Classe racine dédiée (globals.css) — fond `surface-raised` (un cran SOUS
//    la carte `surface-card`) + bordure. Contraste assuré en light ET dark.
<button className="nc-btn-secondary" style={{ padding: "11px 20px", borderRadius: 12 }}>
  Annuler
</button>

// ❌ À ne jamais faire pour un bouton secondaire posé dans une carte/modale
style={{ background: "transparent" }}          // hérite visuellement de la surface
style={{ background: "var(--color-surface-card)" }} // = fond de la modale en dark
```

Pour un **dropdown/menu** posé sur une carte de même surface (feed = carte
`surface-card`, menu = `surface-card`), ajouter `.nc-dropdown-elevated` au
panneau : la bordure est renforcée en dark pour le délimiter clairement.

### Bouton CTA sombre (ex. "Réserver", "Dupliquer")

```tsx
// ✅ S'inverse automatiquement : noir en light, crème en dark
style={{
  background: "var(--nc-btn-dark-bg)",  // #1a1a1a / #ede9e6
  color: "var(--nc-btn-dark-text)",      // #fff / #141211
}}
```

### Tooltip dark (fond sombre en light, clair en dark)

```tsx
// ✅ Le même token — toujours lisible grâce à l'inversion
style={{
  background: "var(--nc-btn-dark-bg)",
  color: "var(--nc-btn-dark-text)",
}}
```

### Onglet/tab actif (pill blanche sur fond gris)

```tsx
// ✅ Reste visible en dark mode
style={{
  background: active ? "var(--nc-segmented-active-bg)" : "transparent",
  color: active ? "var(--nc-segmented-active-text)" : "var(--color-text-muted)",
}}
```

### Textes secondaires

```tsx
// ✅ Adaptatifs
color: "var(--color-text-primary)"    // #000 / #f2edeb
color: "var(--color-text-secondary)"  // #52525b / #a89e9b
color: "var(--color-text-muted)"      // #64748b / #857a77

// ❌ Hardcodés à ne jamais utiliser
color: "#000"
color: "#52525b"
color: "#6b7280"
color: "#9ca3af"
```

### Logo en dark mode (fond transparent → invisible)

```tsx
// ✅ Inversion Tailwind pour logo noir sur fond transparent
<Image src={logoUrl} className="dark:invert" ... />
```

### BottomNav mobile

```tsx
// ✅ Pill glassmorphism
style={{
  background: "var(--nc-bottom-nav-bg)",
  border: "0.5px solid var(--nc-bottom-nav-border)",
}}
```

### Override dans un CSS Module

```css
/* Dans un fichier .module.css */
:global(.dark) .maClasse {
  /* override spécifique dark mode */
  box-shadow: ...; /* shadows plus profondes en dark */
}
```

---

## 8. Problèmes résolus et leurs causes

### Fond blanc sur les composants en dark mode

**Cause** : `background: "white"` hardcodé, imperméable à la cascade `.dark {}`.

**Fix** : remplacement systématique par `var(--color-surface-card)`.

### Boutons CTA noirs invisibles en dark

**Cause** : `background: "#000"` / `"#18181b"` sur fond `#141211` → indiscernables.

**Fix** : token `--nc-btn-dark-bg` qui s'inverse (`#1a1a1a` → `#ede9e6` en dark).

### Bouton d'annulation invisible en dark (même couleur que le fond)

**Cause** : un bouton secondaire (« Annuler » de `DeletePostConfirmDialog`, items
de dropdown, etc.) en `background: transparent` reprend visuellement la surface
qui le porte — sur `--color-surface-card` en dark, il devient invisible. Le
`background: "white"` inline écrasait aussi la classe `dark:bg-*` (spécificité).

**Fix** : classe racine `.nc-btn-secondary` (fond `--color-surface-raised`
contrasté + bordure), motif du bouton « Se déconnecter ». Règle documentée en §7.
Pour les menus flottants sur carte de même surface : `.nc-dropdown-elevated`
(bordure renforcée en dark).

### Texte blanc sur fond blanc (widget feedback)

**Cause** : `--color-text-primary` adaptait à dark (`#f2edeb`) mais `--color-surface-card` restait `#ffffff` par conflit de spécificité entre `.dark {}` et le `:root` généré par `@theme inline` Tailwind v4.

**Fix** : bloc `html.dark {}` en toute fin de `globals.css` avec spécificité `[0,1,1]`.

### Icônes invisibles en dark (FeedbackWidget hub)

**Cause** : `.iconBlue` utilisait `rgba(0,0,0,0.08)` comme fond — sur `#2a2725`, la différence est imperceptible.

**Fix** : override `:global(.dark) .iconBlue { background: rgba(255,255,255,0.07); }`.

### Chevron select invisible en dark

**Cause** : SVG inline dans `background-image` avec couleur hex hardcodée `%2364748b` (gris).

**Fix** : override `:global(.dark) .select { background-image: url("...%23a89e9b..."); }` avec la couleur text-secondary dark.

### Status badges illisibles en dark (FeedbackWidget)

**Cause** : `STATUS_COLORS` avec `text: "#92400e"` (ambre foncé), `"#1e40af"` (bleu foncé), etc. — couleurs claires-sur-sombre invalides.

**Fix** : `STATUS_COLORS` étendu avec `textLight`/`textDark`, `useTheme()` pour sélectionner la bonne valeur au rendu.

### Halo rouge en dark mode

**Cause** : La classe `.nc-page-halo::before` avait une version dark avec `rgba(224, 99, 90, 0.15)` — trop proche de la couleur de fond et incohérent avec l'identité dark.

**Fix** : `.dark .nc-page-halo::before { background: none; }` — le fond uni `#141211` suffit.

### Conflit de merge au rebase (NotificationsSection)

**Cause** : PR #68 avait restructuré `NotificationsSection` avec une matrice grid (ajout de `...baseGrid`, `alignItems: stretch`, `borderBottom`) pendant que ma branche avait simplement tokenisé le `background: "white"`. Le diff git a mal aligné les blocs.

**Fix** : gardé la structure de `main` (PR #68), corrigé le `background: "white"` restant sur le conteneur externe.

---

## 9. Ce qui reste à faire

### Priorité haute

- [ ] **`viewport.themeColor` dans `layout.tsx`** — changer `"#f5f2f2"` (seule valeur light) par un tableau :
  ```tsx
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#141211" },
    { media: "(prefers-color-scheme: light)", color: "#f5f2f2" },
  ]
  ```
  → Affecte la barre de statut iOS en dark mode (reste rose en dark sans ce fix)

### Priorité moyenne

- [ ] **FeedbackWidget en dark réel à valider** — les CSS Modules avec `:global(.dark)` fonctionnent en théorie, mais pas encore testé visuellement sur un déploiement

- [ ] **Audit visuel des pages branchées Supabase** — une fois `/coaching`, `/formation`, `/ressources` branchées sur des données réelles, refaire un pass dark mode visuel (les composants mockés sont OK, les futurs composants "live" pourraient introduire de nouvelles couleurs hardcodées)

### Priorité basse

- [ ] **`FeedbackWidget.module.css` dark mode systématique** — actuellement seulement les overrides critiques sont en `:global(.dark)`. Un audit complet de tous les hover states, focus rings, etc. en dark mode serait idéal

- [ ] **`nc-blink-dot` en dark mode** — le point rouge animé (`.nc-blink-dot`) fonctionne en dark (rouge reste rouge), mais son `box-shadow` rouge pourrait être atténué

- [ ] **Shadows en dark mode** — les `--nc-shadow-2` et `--nc-shadow-3` sont définis une seule fois. En dark mode, les ombres sont moins efficaces sur fond sombre. On pourrait définir des variantes dark avec des opacités plus élevées

### Ne pas faire (décisions actées)

- **Pas de dark mode dans FeedbackWidget.module.css via `prefers-color-scheme`** — on gère via la classe `.dark` sur `<html>` pour être cohérent avec le ThemeProvider
- **Pas de `data-theme` attribut** — la classe `.dark` sur `<html>` est la source de vérité unique
- **Le halo rouge ne revient pas en dark** — décision DA définitive, fond uni `#141211`

---

## 10. Prompt de reprise de contexte

Copier-coller en début de nouvelle session :

---

> **Contexte dark mode — NotionClub Infrastructure**
>
> Le dark mode est implémenté sur la branche `claude/funny-johnson-LDm9e` (PR #67). Tout est documenté dans `docs/dark-mode/README.md`.
>
> **Architecture** : CSS custom properties uniquement. La classe `.dark` est appliquée à `<html>` par le `ThemeProvider` (`src/shared/components/theme/ThemeProvider.tsx`). Tous les tokens sont dans `src/app/globals.css`.
>
> **Règle critique** : les tokens NC dark sont définis dans DEUX endroits en parallèle dans `globals.css` — d'abord dans `.dark {}` (pour la cascade standard), puis dans `html.dark {}` tout à la fin du fichier (spécificité `[0,1,1]` pour garantir la victoire sur les variables `:root` de Tailwind v4 `@theme inline`). Si tu ajoutes un nouveau token dark, **ajoute-le dans les deux blocs**.
>
> **Système de tokens** :
> - `--color-surface-card: #2a2725` → fond de card/modale/dropdown
> - `--color-surface-raised: #201d1b` → fond d'input/conteneur secondaire
> - `--color-surface-page: #141211` → fond de page
> - `--nc-btn-dark-bg: #ede9e6` / `--nc-btn-dark-text: #141211` → CTA sombres inversés
> - `--nc-bottom-nav-bg/border` → pill BottomNav mobile
> - `--nc-segmented-active-bg/text` → tab/toggle actif
>
> **Règle absolue** : ne jamais hardcoder une couleur dans un composant — utiliser les tokens CSS. Si un token n'existe pas encore, l'ajouter dans `globals.css` dans les deux blocs (`:root {}` pour light, `html.dark {}` pour dark).
>
> **Pour les CSS Modules** (fichiers `.module.css`) : les `var(--color-*)` héritent normalement, mais les overrides spécifiques dark nécessitent `:global(.dark) .maClasse { }`.
>
> **Ce qui reste** : voir `docs/dark-mode/README.md` §9.

---

*Document généré suite aux sessions de développement dark mode du 2026-05-24.*
