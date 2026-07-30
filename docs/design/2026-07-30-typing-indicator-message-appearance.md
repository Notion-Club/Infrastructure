# Spec — Indicateur de frappe & apparition des messages (Messages Privés)

**Date :** 2026-07-30
**Statut :** Implémenté
**Module :** `community` — Messages Privés
**Référence externe :** [interior.dev — Typing indicator](https://www.interior.dev/docs/typing-indicator)
**Référence interne (design system) :** skill `transitions-dev` (`.agents/skills/transitions-dev/`)

---

## Contexte

Le thread de messages privés (`ConversationThread`) affichait déjà un indicateur
« X écrit… » (3 points qui rebondissent) et faisait apparaître les nouveaux
messages **sans aucune transition** : la bulle surgissait d'un coup dans le fil.

L'objectif de cette itération : intégrer l'animation du typing indicator
d'[interior.dev](https://www.interior.dev/docs/typing-indicator) — une bulle
« vivante » qui **entre** et **sort** en douceur, avec une vague de points plus
organique — et **prolonger la même grammaire** à l'apparition des nouveaux
messages, pour que l'ensemble « frappe → message reçu » forme une séquence
cohérente et fluide.

> **Note d'implémentation — accès réseau.** La page interior.dev est bloquée par
> la *network policy* de l'environnement d'exécution (403 à la volée). L'animation
> a donc été **retranscrite en CSS pur** sur les tokens du design system
> NotionClub, dans l'esprit du typing indicator interior.dev (bulle qui *pop*,
> vague de points en scale + opacité, sortie en fondu-scale), et alignée sur la
> référence canonique du repo pour les animations front (`transitions-dev`,
> courbes `--nc-ease` / spring). Aucune lib de motion ajoutée.

---

## Vue d'ensemble

Trois animations distinctes, toutes en **CSS pur** (pas de frame-loop JS), toutes
avec un guard `@media (prefers-reduced-motion: reduce)` :

| # | Animation | Élément | Déclencheur |
|---|---|---|---|
| 1 | **Entrée / sortie de la bulle** de frappe | enveloppe `.nc-typing-presence` | l'autre commence / arrête de taper |
| 2 | **Vague des 3 points** | `.nc-typing-dot` | en boucle tant que la bulle vit |
| 3 | **Apparition d'un nouveau message** | bulle `MessageBubble` (`.nc-msg-enter`) | message reçu (Realtime) ou envoi optimiste |

Toutes les règles vivent dans **`src/app/globals.css`** (bloc « Messages privés —
indicateur de frappe + apparition des messages »). Les composants ne portent que
les *hooks* (classes + `transformOrigin` / `animationDelay` inline).

---

## 1 · Entrée / sortie de la bulle de frappe

### Rendu

- **Entrée** : la bulle *pop* depuis le coin **bas-gauche** (`transform-origin:
  left bottom` — l'ancrage visuel d'un message reçu), avec un léger *overshoot*
  (spring) : `scale(0.8) + translateY(8px) + opacity 0 → scale(1)`.
- **Sortie** : fondu-scale vers le bas (`scale(0.85) + translateY(4px) + opacity
  0`), plus court et sans overshoot — une disparition « calme ».

### Keyframes (`globals.css`)

```css
@keyframes nc-typing-in {
  from { opacity: 0; transform: translateY(8px) scale(0.8); }
  to   { opacity: 1; transform: translateY(0)   scale(1);   }
}
@keyframes nc-typing-out {
  from { opacity: 1; transform: translateY(0)  scale(1);    }
  to   { opacity: 0; transform: translateY(4px) scale(0.85); }
}
.nc-typing-presence {
  transform-origin: left bottom;
  animation: nc-typing-in 260ms cubic-bezier(0.34, 1.4, 0.64, 1) both;
}
.nc-typing-presence[data-exit="true"] {
  animation: nc-typing-out 170ms var(--nc-ease) both;
}
```

### Orchestration React — présence auto-gérée

Un simple `{visible && <TypingIndicator/>}` **coupe** la bulle net à la
disparition (l'animation de sortie n'a pas le temps de jouer). `TypingIndicator`
gère donc lui-même sa **présence différée** :

- Props : `visible: boolean` (dérivé de `otherIsTyping` côté `ConversationThread`)
  + `authorName`.
- États internes : `mounted` (le nœud est-il dans le DOM — reste `true` pendant
  la sortie) et `exiting` (bascule l'attribut `data-exit` → `nc-typing-out`).
- `visible → true` : on annule un éventuel timer de sortie, `exiting = false`,
  `mounted = true` → l'entrée rejoue.
- `visible → false` : `exiting = true` (la bulle joue `nc-typing-out`), puis un
  `setTimeout(EXIT_MS = 190ms)` démonte réellement le nœud (`mounted = false`).

> **Patron reconnu :** c'est le patron « présence animée » de
> *AnimatePresence* / *react-transition-group*. Garder le nœud monté via `mounted`
> évite un **frame vide (flicker)** qu'un démontage immédiat provoquerait. Le
> `setState` piloté par effet est donc assumé ici (règle ESLint
> `react-hooks/set-state-in-effect` désactivée **localement**, avec justification
> dans le code).

Côté `ConversationThread`, l'ancien rendu conditionnel :

```tsx
{otherIsTyping && !isDeleted && <TypingIndicator authorName={…} />}
```

devient un rendu **permanent** piloté par `visible` (le composant décide seul de
se monter / démonter) :

```tsx
<TypingIndicator
  visible={otherIsTyping && !isDeleted}
  authorName={conversation.participant.name}
/>
```

---

## 2 · Vague des 3 points

Chaque point **monte, grossit et s'éclaircit** à son tour, puis retombe à une
opacité basse (état « au repos ») le reste du cycle. Le décalage
d'`animation-delay` (0s / 0.15s / 0.3s, posé **inline** sur chaque `Dot`) crée
l'onde de gauche à droite.

```css
@keyframes nc-typing-wave {
  0%, 70%, 100% { transform: translateY(0)    scale(1);    opacity: 0.35; }
  35%           { transform: translateY(-4px) scale(1.18); opacity: 1;    }
}
.nc-typing-dot { animation: nc-typing-wave 1.3s ease-in-out infinite; }
```

Différence avec l'ancienne version (`nc-typing-bounce`, supprimée) : on anime
désormais **scale + opacité** en plus du `translateY`, et la fenêtre « repos »
(`70% → 100%`) est plus longue → un rythme plus organique, plus proche du feeling
interior.dev, moins « mécanique ».

---

## 3 · Apparition d'un nouveau message

### Rendu

La bulle **éclot** depuis le coin bas du côté de son expéditeur : montée + scale
depuis `right bottom` (message envoyé) ou `left bottom` (reçu).

```css
@keyframes nc-msg-in {
  from { opacity: 0; transform: translateY(10px) scale(0.94); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
.nc-msg-enter {
  animation: nc-msg-in 340ms cubic-bezier(0.34, 1.35, 0.64, 1) both;
}
```

Le `transform-origin` (droite/gauche) est posé **inline** dans `MessageBubble`
selon `isSelf`.

### Quels messages animent — et lesquels n'animent PAS

C'est le point délicat. On veut animer **uniquement les nouveaux messages** qui
arrivent **en bas** du fil, jamais :

- l'historique **déjà présent à l'ouverture** (sinon les ~20 bulles *poperaient*
  toutes à chaque ouverture de conversation — et ça parasiterait le
  saut-en-bas initial) ;
- les messages **plus anciens** chargés en pagination (bouton « Charger les
  messages précédents ») — ils s'insèrent **en haut**, ce ne sont pas de
  « nouveaux » messages ;
- l'**écho serveur de mon propre envoi** — le message optimiste a déjà *popé*,
  rejouer l'animation sur la ligne DB ferait un double *pop*.

**Mécanique (`ConversationThread`)** :

```tsx
// Lot présent à l'ouverture, capturé UNE fois (useState lazy, jamais réécrit).
// Lire un STATE au render est sûr (contrairement à une ref) et ne déclenche
// aucun re-render.
const [initialIds] = useState(() => new Set(conversation.messages.map(m => m.id)));
const olderIdsSet = useMemo(() => new Set(olderMessages.map(m => m.id)), [olderMessages]);

// « À animer » = pas dans le lot initial ET pas un message paginé (prepend haut).
const animatedIds = useMemo(() => {
  const out = new Set<string>();
  for (const m of messages) {
    if (!initialIds.has(m.id) && !olderIdsSet.has(m.id)) out.add(m.id);
  }
  return out;
}, [messages, olderIdsSet, initialIds]);
```

`animateIn={animatedIds.has(msg.id)}` est passé à chaque `MessageBubble`.

**Mécanique (`MessageBubble`)** — capture au montage :

```tsx
// La bulle est keyée par msg.id → un vrai nouveau message monte une instance
// FRAÎCHE. Capturer la valeur au montage via useState suffit (insensible aux
// re-renders ultérieurs). (!isSelf || isPending) : on anime les reçus et
// l'envoi optimiste, PAS l'écho DB de mon propre message (évite le double pop).
const [playEnter, setPlayEnter] = useState(animateIn && (!isSelf || isPending));
```

`playEnter` pose la classe `.nc-msg-enter`. À la fin de l'animation
(`onAnimationEnd`, filtré sur `animationName === "nc-msg-in"`), on **retire** la
classe (`setPlayEnter(false)`) pour ne pas laisser de `transform` résiduel qui
créerait un *stacking context* parasite gênant la superposition des toolbars
voisines.

### Pourquoi ça n'affecte pas le scroll

Les animations n'utilisent que `transform` (+ `opacity`), qui **ne modifie pas le
layout** (pas de reflow, `scrollHeight` inchangé). Le saut-en-bas d'ouverture, le
ré-ancrage de pagination et l'auto-scroll « nouveau message » continuent de
fonctionner tels quels.

---

## Accessibilité — `prefers-reduced-motion`

Un unique guard neutralise les trois animations et fige les points à une opacité
lisible :

```css
@media (prefers-reduced-motion: reduce) {
  .nc-typing-presence,
  .nc-typing-presence[data-exit="true"],
  .nc-msg-enter { animation: none !important; }
  .nc-typing-dot { animation: none !important; opacity: 0.55 !important; }
}
```

L'attribut `aria-live="polite"` / `aria-atomic="true"` de l'indicateur est
conservé (le lecteur d'écran annonce « X écrit… » sans dépendre de l'animation).

---

## Fichiers touchés

```
src/app/globals.css                                              # keyframes + classes .nc-typing-* / .nc-msg-enter + guard reduced-motion
src/modules/community/components/messages/TypingIndicator.tsx    # présence auto-gérée (enter/exit) + vague des points
src/modules/community/components/messages/MessageBubble.tsx      # prop animateIn + .nc-msg-enter au montage (gating sender/pending)
src/modules/community/components/messages/ConversationThread.tsx # calcul animatedIds + nouveau contrat <TypingIndicator visible=…>
```

---

## Tunables (résumé)

| Variable / valeur | Où | Effet |
|---|---|---|
| `nc-typing-in` 260ms · spring `cubic-bezier(0.34, 1.4, 0.64, 1)` | bulle entrée | *pop* + overshoot |
| `nc-typing-out` 170ms · `--nc-ease` | bulle sortie | fondu-scale calme |
| `EXIT_MS = 190ms` | `TypingIndicator.tsx` | délai avant démontage (doit couvrir `nc-typing-out`) |
| `nc-typing-wave` 1.3s · délais 0 / 0.15 / 0.3s | points | vitesse + décalage de l'onde |
| `nc-msg-in` 340ms · spring `cubic-bezier(0.34, 1.35, 0.64, 1)` | nouveau message | intensité du *pop* d'entrée |

---

## Checklist de test manuel

- [ ] Ouvrir une conversation → l'historique s'affiche **sans** *pop* en cascade.
- [ ] L'autre participant tape → la bulle « X écrit… » **entre** en *pop*
      bas-gauche ; les 3 points ondulent.
- [ ] L'autre arrête de taper → la bulle **sort** en fondu-scale (pas de coupure
      nette).
- [ ] Recevoir un message → la bulle reçue **éclot** depuis la gauche.
- [ ] Envoyer un message → la bulle envoyée **éclot** depuis la droite **une
      seule fois** (pas de double *pop* quand la ligne DB remplace l'optimiste).
- [ ] « Charger les messages précédents » → les anciens messages s'insèrent en
      haut **sans** animation d'entrée, et le scroll reste ancré.
- [ ] Activer *Réduire les animations* (OS) → aucune animation ; les points
      restent visibles, l'indicateur reste annoncé par le lecteur d'écran.
```
