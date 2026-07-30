# Spec — Animation « filter-grid » de la grille Ressources

**Date :** 2026-07-30
**Statut :** Implémenté
**Module :** `ressources` — page `/ressources` (grille filtrable)
**Référence externe :** [interior.dev — Filter grid](https://www.interior.dev/docs/filter-grid)
**Hook concerné :** `src/shared/hooks/useGridChoreography.ts`

---

## Contexte

Le changement de **catégorie** dans la grille des Ressources (boutons **Tout /
Ressources / Templates**) jouait jusqu'ici une transition **directionnelle
« panneau »** (`mode: 'tab'`) : toutes les cartes glissaient horizontalement de
la gauche ou de la droite selon la position de l'onglet cliqué, avec un léger
flou.

L'objectif : remplacer **uniquement cette transition de changement de catégorie**
par le morph **filter-grid** d'[interior.dev](https://www.interior.dev/docs/filter-grid)
— les cartes qui restent se **réorganisent** (FLIP) pour combler les trous,
celles qui sortent se **rétractent**, celles qui entrent **éclosent** — le tout
sans direction imposée.

> **Contrainte respectée :** l'**animation d'ouverture** de la page (`reveal()`,
> cascade au premier montage) n'est **pas** touchée. Les autres transitions
> restent inchangées : recherche texte (`mode: 'reflow'`), filtres type-métier et
> réinitialisation (`mode: 'tab'`).

> **Note d'implémentation — accès réseau.** La page interior.dev est bloquée par
> la *network policy* de l'environnement (403). L'animation a donc été
> retranscrite dans l'esprit du filter-grid interior.dev (FLIP des survivants +
> pop/rétraction d'échelle centrée pour entrée/sortie, spring settle, sans flou
> ni direction), sur la mécanique FLIP déjà en place dans `useGridChoreography`.

---

## Ce qui a été fait

Un nouveau mode **`'filter'`** ajouté à `useGridChoreography`, câblé au seul
handler `onPrimaryFilter` (`ResourcesGrid.tsx`) :

```diff
- animateTo(buildVisibleIds(searchQuery, filter, nextTypes), { mode: 'tab', direction: dir });
+ animateTo(buildVisibleIds(searchQuery, filter, nextTypes), { mode: 'filter' });
```

La logique directionnelle (`dir`) devient inutile pour ce handler → supprimée.

---

## Comment ça fonctionne

Le hook applique le patron **FLIP** (First-Last-Invert-Play) déjà utilisé par les
modes `reflow` / `tab`. Le mode `filter` se distingue par ses états de départ /
arrivée :

| Rôle de la carte | Départ | Arrivée | Easing | Flou |
|---|---|---|---|---|
| **Survivant** (reste visible) | translaté à son ancienne position (FLIP) | glisse vers la nouvelle (`translateZ(0)`) | `--ease-back` (spring), `--enter-dur` | — |
| **Entrant** (nouvellement visible) | `opacity 0` + `scale(0.82)` centré | `opacity 1` + `scale(1)` | `--ease-back` (spring), `--enter-dur` | — |
| **Sortant** (filtré) | en place (`position: absolute` figé) | `opacity 0` + `scale(0.82)` centré | `--ease-out`, `--exit-dur` | — |

Points clés :

- **Aucun `filter: blur()`** dans ce mode (contrairement à `tab`/`reflow`). C'est
  un choix de *performance* : l'animation de flou est coûteuse sur **iOS Safari /
  PWA iOS** et provoque des saccades. Le pop d'échelle + fondu suffit à l'effet.
- **Pas de direction** : le morph est le même quel que soit l'onglet cliqué (on
  ne « pousse » plus la grille latéralement).
- **Stagger** doux en **ordre de lecture** (haut→bas, gauche→droite) : survivants
  `stag(i, 140, 14)`, entrants `stag(i, 160, 16)` → les cartes « se rangent »
  sans à-coup ni cascade trop marquée.
- Les cartes sortantes passent en `position: absolute` à leur position First →
  elles ne décalent pas le flux pendant que les survivants FLIP se réorganisent.

### Constantes / tokens

| Nom | Valeur | Rôle |
|---|---|---|
| `FILTER_SCALE` | `0.82` | échelle de pop (entrée) / rétraction (sortie) |
| `--enter-dur` | `360ms` | durée d'entrée + glisse des survivants |
| `--exit-dur` | `240ms` | durée de rétraction des sortants |
| `--ease-back` | `cubic-bezier(0.34, 1.28, 0.64, 1)` | settle spring (léger overshoot) |
| `--ease-out` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | fondus opacity |
| `CLEANUP_MS` | `680ms` | purge des styles inline (> durée max d'une jambe) |

---

## Compatibilité navigateurs

- **iOS Safari / PWA iOS** : transforms `scale` / `translate` composités GPU
  (`will-change: transform`, `backface-visibility: hidden` déjà posés sur
  `.nc-grid-card`), **sans flou animé** → pas de jank. `getBoundingClientRect` +
  double `requestAnimationFrame` : comportement identique à WebKit desktop.
- **Web Android (Chromium)** : mécanique FLIP standard, déjà éprouvée par les
  modes existants.
- **`prefers-reduced-motion`** : le hook bascule la visibilité (`.is-hidden`)
  **instantanément**, sans animation (branche déjà en place, couvre `filter`).

---

## Fichiers touchés

```
src/shared/hooks/useGridChoreography.ts            # nouveau mode 'filter' (enter/exit scale, FLIP survivants)
src/modules/ressources/components/ResourcesGrid.tsx # onPrimaryFilter → { mode: 'filter' } (au lieu de 'tab'+dir)
```

---

## Checklist de test manuel

- [ ] Ouvrir `/ressources` → la **cascade d'ouverture** joue comme avant
      (inchangée).
- [ ] Cliquer **Ressources** → les templates se **rétractent** en place, les
      ressources restantes **se réorganisent** en FLIP pour combler, sans
      glissement latéral.
- [ ] Cliquer **Templates** → symétrique ; les cartes entrantes **éclosent**
      (scale 0.82 → 1).
- [ ] Cliquer **Tout** → réapparition des cartes filtrées en pop d'échelle.
- [ ] Rechercher un texte → animation **reflow** inchangée (avec flou).
- [ ] Cocher un filtre **type métier** (sous Tout/Ressources) → animation `tab`
      inchangée.
- [ ] iOS Safari + PWA installée : aucun scintillement / saccade au changement
      de catégorie ; pas de résidu de carte.
- [ ] *Réduire les animations* activé → bascule instantanée, sans transition.
```
