# Spec — Transitions de navigation Notion Club

**Date :** 2026-05-25
**Statut :** Décisions finalisées, prêt pour implémentation PR3/PR4
**Contexte :** Suite à l'audit `docs/audits/2026-05-25-navigation-audit.md`

---

## Prérequis techniques à valider avant implémentation

Deux bugs identifiés en audit bloquent le fonctionnement des transitions, indépendamment de leur design.
Ces corrections font partie de PR3 (elles sont le prérequis, pas le sujet).

| Bug | Fichier | Fix |
|---|---|---|
| `BottomNav` utilise `<a>` natifs — full page reload sur mobile | `src/shared/components/dashboard/mobile/BottomNav.tsx` L53–89 | Remplacer tous les `<a>` par `<Link>` de `next/link` |
| Dashboard refait 2 appels Supabase déjà faits dans le layout | `src/app/(app)/dashboard/page.tsx` | `getGreetingFirstName()` doit lire depuis `ProfileIdentityContext` |

Sans le premier fix, aucune transition ne fonctionne sur mobile. La View Transitions API nécessite une navigation client-side initiée par le router Next.js.

---

## Matrice de transitions finalisée

| Source → Destination | Scénario | Motif |
|---|---|---|
| Navigation latérale via Topbar ou BottomNav (n'importe quelle section → section) | **A — global** | Même niveau hiérarchique, pas de direction imposée |
| `/formation` → `/formation/[programSlug]` | **A — global** | Drill-down, mais image de couverture du programme non répercutée dans le header → illusion non crédible sans refonte |
| `/formation/[programSlug]` → `/formation/[programSlug]/[moduleSlug]/[lessonSlug]` | **A — global** | Idem |
| `/communaute` → `/communaute/post/[id]` | **A — global** | PostCard n'a pas de `view-transition-name` actuellement |
| `/ressources` → `/ressources/ressource/[slug]` | **C — illusion shared element** | `view-transition-name: card-${slug}` déjà posé sur les deux côtés |
| `/ressources` → `/ressources/template/[slug]` | **C — illusion shared element** | Idem |
| Tout autre flux interne à `(app)/` | **A — global** | Par défaut |

**Note sur le Scénario B :** Le brief ne mentionne pas de Scénario B — j'assume que le plan initial distinguait A (global) et C (shared element). Si un Scénario B (ex. slide horizontal) était prévu, il a été écarté. Je confirme ce choix en section A ci-dessous.

---

## Scénario A — Transitions globales

### Décision 1 : type d'animation

**Choix : cross-fade avec scale entrant subtil (0.97 → 1.00) sur le contenu.**

Pas de slide. Raisonnement :

- La navigation entre Accueil / Formation / Communauté / Coaching / Ressources est **tabulaire** — ces sections sont au même niveau, sans relation parent/enfant. Un slide horizontal imposerait une direction arbitraire et créerait de la confusion (pourquoi Formation est-elle "à droite" de Accueil ?).
- Le slide vertical existe déjà dans le design system via `nc-mode-in` (`translateY(8px)→0`) et est réservé aux **éléments qui apparaissent dans une page** (widgets, toasts, modales). L'utiliser pour les transitions de page brouillerait la grammaire visuelle.
- Le scale 0.97→1.00 sur la page entrante est le pattern natif iOS/iPadOS pour la navigation par onglets — il donne un sentiment de "focus" sans direction. Il est imperceptible individuellement mais très sensible à l'absence.
- La page **sortante** disparaît en **fade simple sans transform** — elle ne doit pas s'éloigner, elle s'efface. La symétrie scale-in / fade-out crée une hiérarchie visuelle claire (le nouveau contenu "arrive", l'ancien "part").

### Décision 2 : durées et easing

Nouveau token de durée de page à déclarer dans `globals.css` :

```css
--nc-duration-page: 240ms;
```

| Phase | Durée | Easing | Transform |
|---|---|---|---|
| Page sortante — fade out | 160ms | `cubic-bezier(0.4, 0, 1, 1)` (accélération) | Aucun |
| Page entrante — fade in | 240ms | `--nc-ease` = `cubic-bezier(0.22, 1, 0.36, 1)` | `scale(0.97) → scale(1.00)` |
| Chevauchement (overlap) | Les deux démarrent en même temps | — | — |

La page sortante s'efface en 160ms (elle part vite, ne gêne pas). La page entrante prend 240ms avec l'easing décéléré du design system — elle s'installe, elle ne surgit pas. Le chevauchement des deux crée un vrai cross-fade fluide et non une séquence fade-out/fade-in saccadée.

**Pourquoi `--nc-ease` pour l'entrant et non un easing symétrique ?**

`cubic-bezier(0.22, 1, 0.36, 1)` est une courbe de décélération marquée : départ rapide, atterrissage progressif. C'est précisément ce qu'on veut sur une page qui arrive — elle apparaît franchement, puis se pose. Pour la sortie, la décélération serait contre-intuitive (l'élément devrait accélérer pour disparaître, pas ralentir).

### Décision 3 : mobile vs desktop

**Même animation.** Pas de variation par breakpoint.

Raisonnement : la différence de timing mobile (10–20ms plus rapide) ne justifie pas la complexité d'un second jeu de tokens. Si des tests utilisateurs révèlent une latence perçue sur mobile, ajuster `--nc-duration-page` à 200ms globalement.

### Décision 4 : navigation "back" navigateur

**Même animation que forward** pour cette première itération.

Le back devrait idéalement inverser (page entrante sort de derrière, sans scale). Mais différencier back/forward dans Next.js App Router avec View Transitions nécessite d'intercepter `popstate` et d'écrire un wrapper autour de `useRouter` — c'est un chantier PR5+, pas PR3. Signalé ici comme dette connue.

### Séquence frame par frame — Scénario A

```
T0        Utilisateur clique un lien Topbar ou BottomNav (via <Link>)
          │
T0–T20ms  Next.js router démarre la navigation côté client.
          View Transitions API déclenche document.startViewTransition().
          Browser capture un screenshot de l'état actuel (::view-transition-old(root)).
          │
T20ms     Browser lance le fetch de la nouvelle page (ou la trouve en cache prefetch).
          ⚠️ Si la page met >0ms à répondre → loading.tsx s'affiche ICI
             (voir section "cas dégradés" plus bas).
          │
T20–T40ms Browser capture le nouvel état DOM (::view-transition-new(root)).
          Les deux pseudo-éléments old/new sont superposés.
          │
T40ms →   Animation démarre :
          - ::view-transition-old(root) : opacity 1→0 en 160ms, easing accélération
          - ::view-transition-new(root) : opacity 0→1 + scale 0.97→1.0 en 240ms, --nc-ease
          │
T280ms    Animation terminée. Nouvel état visible.
          Les éléments de contenu de la nouvelle page jouent leur propre
          animation nc-mode-in (translateY(8px)→0) si applicable — c'est
          une animation de contenu, pas de page, elle est orthogonale.
```

### CSS à écrire (décisions visuelles, pas d'implémentation)

```css
/* Dans globals.css, section "View transitions" existante */

/* Scénario A : root cross-fade */
::view-transition-old(root) {
  animation-duration: 160ms;
  animation-timing-function: cubic-bezier(0.4, 0, 1, 1);
  /* pas de transform */
}

::view-transition-new(root) {
  animation-duration: var(--nc-duration-page); /* 240ms */
  animation-timing-function: var(--nc-ease);
  /* transform: scale(0.97) → scale(1.0) géré par animation keyframe */
}
```

Les keyframes précises (`@keyframes nc-page-enter`) seront définies dans PR3.

---

## Scénario C — Illusion shared element (ressources et templates)

### Principe

La View Transitions API morphe un élément nommé de sa position/taille source vers sa position/taille destination. Ici :

- **Source** : la `ResourceCard` (ou `TemplateCard`) sur laquelle l'utilisateur clique — `view-transition-name: card-${slug}` déjà posé
- **Destination** : l'élément correspondant dans la page detail — même nom déjà posé en L176 de `ressources/ressource/[slug]/page.tsx`

L'illusion fonctionne si les deux éléments partagent une DNA visuelle suffisante : même couleur de fond, même image (ou image cohérente), même rayon de bordure ou transition visible de l'un à l'autre.

### Vérification de crédibilité — décision à prendre

**⚠️ Ce point requiert une validation manuelle que je ne peux pas faire en audit statique.**

Questions à répondre avant PR4 :

1. La `ResourceCard` a-t-elle un thumbnail/image en haut de carte ?
2. Le header de `ressources/ressource/[slug]/page.tsx` a-t-il le même thumbnail en position dominante (hero) ?
3. Les `border-radius` sont-ils proches (morph visible mais cohérent) ?

**Règle de décision :**
- Si les deux éléments ont **image + même fond coloré ou neutre** → illusion crédible, on garde Scénario C.
- Si la card est **essentiellement textuelle** (titre + tags sans visuel fort) et le header detail est **structurellement différent** → basculer en Scénario A pour cette route. L'illusion textuelle-vers-héro est trop abstraite pour être lisible.

Je tranche par défaut sur **Scénario C maintenu** pour les deux routes ressources, en partant du principe que les cards ont un visuel (sinon c'est un ajustement de composant, pas de strategy de transition).

### Ajustements de composants nécessaires pour la crédibilité

| Composant | Ajustement |
|---|---|
| `ResourceCard.tsx` | Le `view-transition-name` doit être sur l'élément **carte entière** (wrapper container), pas uniquement sur l'image. Le morph sur le conteneur entier est plus lisible qu'un morph d'image isolée. |
| `ressources/ressource/[slug]/page.tsx` | Le même `view-transition-name` doit être sur l'élément **header/hero** qui occupe une zone visuellement comparable. Si c'est un `<div>` pleine largeur vs une card compacte, le morph sera aggressif — envisager de le mettre uniquement sur le bloc titre+image sans le padding pleine largeur. |
| `TemplateCard.tsx` | Même règle. |
| `ressources/template/[slug]/page.tsx` | Même règle. |

### Séquence frame par frame — Scénario C

```
T0        Utilisateur clique la ResourceCard (via <Link href="/ressources/ressource/slug">)
          │
T0–T30ms  Visual feedback immédiat : la card répond au :active
          (background légèrement assombri — géré par CSS existant, pas par la transition).
          browser capture ::view-transition-old(card-${slug}) + ::view-transition-old(root).
          │
T30ms     Next.js démarre la navigation. Fetch de la page detail.
          Si la page met >500ms → voir cas dégradé.
          │
T30–T80ms Browser attend que le nouveau DOM soit prêt (ou que loading.tsx soit monté).
          La page actuelle reste visible. Pas de flash.
          │
T80ms     DOM prêt. Browser capture ::view-transition-new(card-${slug}) + ::view-transition-new(root).
          │
T80ms →   Animation en 3 couches superposées :

          COUCHE 1 — Morph de la carte (370ms, commence à T80ms)
            - Position  : interpolation de (x,y) card → (x,y) header detail
            - Taille    : interpolation de (w,h) card → (w,h) hero/header
            - Easing    : cubic-bezier(0.25, 0.46, 0.45, 0.94) — voir note
            - Opacité   : 1 → 1 (le morph est visible tout du long)

          COUCHE 2 — Fade out du reste de la page ressources (180ms, T80ms–T260ms)
            - ::view-transition-old(root) : opacity 1→0, easing accélération
            - Les autres cards, le header, le background disparaissent

          COUCHE 3 — Fade in du contenu de la page detail (180ms, T200ms–T380ms)
            - ::view-transition-new(root) : opacity 0→1, --nc-ease
            - Délai de 120ms depuis T80ms pour que le morph soit dominant visuellement
              avant que le contenu detail n'apparaisse autour

T450ms    Tout terminé. Page detail fully visible.
```

**Note sur l'easing du morph (Couche 1) :**

`cubic-bezier(0.25, 0.46, 0.45, 0.94)` est un easing symétrique (ease-in-out modéré). Pour un morph de position/taille, un easing symétrique est plus lisible qu'une décélération pure — la carte accélère en partant (pour sembler "répondre") et décélère en arrivant (pour se "poser"). L'`--nc-ease` (décélération pure) n'est pas adapté ici car le début de mouvement serait trop brusque.

**Cohérence border-radius :**

Si `ResourceCard` a `border-radius: var(--nc-radius-sm)` (16px) et le hero detail a `border-radius: 0` (pleine largeur), le morph des coins sera visible et peut paraître bizarre. Options :

- **Option recommandée** : donner au `view-transition-name` de la detail page un conteneur interne avec `border-radius: var(--nc-radius-md)` (24px). Le morph 16px→24px est cohérent (la carte "s'ouvre").
- **Option de repli** : border-radius identique sur les deux. Moins intéressant visuellement.

### Cas dégradé — page detail met >500ms à charger

**Pré-condition** : `loading.tsx` dans `src/app/(app)/ressources/` est implémenté (PR2).

```
T0        Clic sur la card
T0–T80ms  Browser attend le nouveau DOM
T80ms     loading.tsx est monté (skeleton de la page detail)
          Browser capture le skeleton comme ::view-transition-new
          │
T80–T450ms Animation Scénario C vers le skeleton :
           - La carte morphe vers l'emplacement du skeleton hero
           - Le skeleton est visuellement neutre (fond --color-surface-raised)
             → le morph arrive sur une zone plate, acceptable si le skeleton
               a la même emprise que le hero réel
T450ms    Skeleton visible. Real data streame dans les Server Components.
          Les zones de données se remplissent sans transition supplémentaire
          (elles remplacent les placeholders en place).
```

**Décision sur le skeleton hero :** Le skeleton doit réserver un espace de hauteur identique au hero réel (ex. `min-height: 240px`), sinon le morph de la carte arrivedans un espace vide et l'illusion s'effondre. Ce point est une contrainte de design du `loading.tsx` ressources à documenter dans PR2.

---

## Comportement `prefers-reduced-motion`

**Principe** : aucune animation, transition instantanée. Pas de fade rapide (même un fade 100ms peut provoquer des malaises chez les utilisateurs sensibles).

```css
/* Déjà dans globals.css L589–595, à vérifier qu'il couvre aussi les nouvelles rules */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*),
  ::view-transition-group(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}
```

Pour le layer `motion` (JS) — si des animations in-page sont gérées par la lib :

```tsx
const shouldReduceMotion = useReducedMotion(); // hook motion
const duration = shouldReduceMotion ? 0 : 0.24;
```

Le comportement reduced-motion doit être **instantané**, pas "juste plus rapide". Cette distinction est médicalement significative.

---

## Récapitulatif des valeurs à implémenter

### Nouveaux tokens CSS

```css
--nc-duration-page: 240ms;         /* durée page entrante scénario A */
--nc-duration-page-exit: 160ms;    /* durée page sortante scénario A */
--nc-duration-morph: 370ms;        /* durée morph scénario C */
--nc-ease-out: cubic-bezier(0.4, 0, 1, 1);          /* exit accélération */
--nc-ease-morph: cubic-bezier(0.25, 0.46, 0.45, 0.94); /* morph symétrique */
```

### Table des animations par route

| Route / contexte | Scénario | Élément animé | Durée | Easing | Transform |
|---|---|---|---|---|---|
| Navigation latérale (tabs) | A | Page entière (root) entrant | 240ms | `--nc-ease` | `scale(0.97)→scale(1)` + `opacity 0→1` |
| Navigation latérale (tabs) | A | Page entière (root) sortant | 160ms | `--nc-ease-out` | `opacity 1→0` |
| Navigation hiérarchique forward | A | Idem — même animation | — | — | — |
| Navigation hiérarchique back | A | Idem — même animation (dette PR5+) | — | — | — |
| `ResourceCard` → detail | C | Morph `card-${slug}` | 370ms | `--nc-ease-morph` | Position + taille morphés |
| `ResourceCard` → detail | C | Root sortant | 180ms | `--nc-ease-out` | `opacity 1→0` |
| `ResourceCard` → detail | C | Root entrant | 180ms (délai 120ms) | `--nc-ease` | `opacity 0→1` |
| `TemplateCard` → detail | C | Identique ResourceCard → detail | — | — | — |

---

## Dette et décisions différées

| Sujet | Décision différée | Cible |
|---|---|---|
| Back navigation différenciée (forward ≠ back) | Nécessite wrapper `useRouter` + detection `popstate` | PR5+ |
| Scénario C pour `/formation` → programme | Illusion non crédible sans image de couverture dans le header detail. Si l'image est ajoutée, porter en C. | Lors de la refonte Formation |
| Scénario C pour `/communaute` → post | `PostCard` n'a pas de `view-transition-name`. À évaluer quand le design PostCard est stabilisé. | Lors de la refonte Communauté |
| Variation de timing mobile | `--nc-duration-page` à 200ms si tests montrent une latence perçue | Tests utilisateurs |
| Validation crédibilité Scénario C | Vérifier visuellement que ResourceCard et detail hero partagent un visuel fort avant d'implémenter C | Début PR4 |

---

## Dépendances entre PRs

```
PR2 (fix waterfalls + loading.tsx)
  └── prérequis pour : skeleton dans cas dégradé Scénario C
      └── PR3 : fix BottomNav <a>→<Link> + Scénario A global
            └── PR4 : Scénario C ressources/templates
```

PR3 peut démarrer sans PR2 terminée, mais le cas dégradé Scénario C sera non couvert tant que PR2 n'est pas mergée.
