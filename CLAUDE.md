@AGENTS.md
@.claude/context.md

---

# Règle absolue — toujours à jour avec `main` avant tout merge

**Avant CHAQUE merge (et avant de préparer/pousser une PR), il FAUT vérifier qu'on est à jour avec les dernières modifications distantes.** Cette vérification est systématique et se fait **de mon côté, sans qu'on ait à me le demander**.

Théo (et d'autres) poussent sur `main` en parallèle. Merger une branche en retard risquerait d'écraser leur travail ou de partir sur une base périmée. C'est non négociable.

## Procédure obligatoire avant tout merge

1. `git fetch origin` — récupérer l'état distant le plus frais (juste avant le merge, pas seulement en début de session).
2. Vérifier que `origin/main` n'a pas avancé depuis le départ de la branche :
   - `git log --oneline <ma-branche>..origin/main` → doit être **vide**.
   - `git merge-base --is-ancestor origin/main <ma-branche>` → doit réussir.
3. Si `origin/main` a avancé :
   - mettre `main` local à jour (`git pull --ff-only origin main`),
   - vérifier que les nouveaux commits **ne touchent pas les mêmes fichiers** que ma branche (`git show <sha> --stat`),
   - rebaser/réintégrer ma branche sur le `main` à jour **avant** de merger,
   - ne JAMAIS force-push ni merger d'une façon qui écraserait un commit distant.
4. Vérifier `mergeable: MERGEABLE` + CI verte avant de lancer le merge.
5. Après merge : `git checkout main && git pull --ff-only origin main` pour resynchroniser.

## Quand cette règle s'applique

- À chaque `gh pr merge` / merge de branche.
- À chaque `git push` qui prépare ou met à jour une PR.
- Même si une vérification a déjà été faite plus tôt dans la session : **on re-fetch juste avant le merge** (quelqu'un a pu pousser entre-temps).

---

# Règle absolue — format de chaque pull request

À CHAQUE `git push` qui prépare ou met à jour une pull request sur ce repo, le corps de la PR DOIT respecter exactement la structure ci-dessous, dans cet ordre, en français, avec des sous-titres `##` et `###`, des tableaux Markdown quand pertinent, et des emojis en tête de section comme dans les PR #33 et #38 du repo (référence de style).

Le ton alterne **copywriting** (pour pitcher la fonctionnalité, accessible à un lecteur non-tech) et **technique** (pour qu'un agent comme Claude Code qui repasse derrière sache exactement quoi faire). Texte aéré : un saut de ligne entre chaque idée, jamais de paragraphe-bloc compact.

## Structure obligatoire

```
## Contexte
Pitch en 2-3 phrases : où on en est dans la roadmap, quelle brique, à quel
livrable précédent ça se rattache. Mode "copywriting" — un lecteur non-tech
doit comprendre l'intention.

---

## Qu'est-ce qui a été fait
Liste / tableau des changements concrets, regroupés par thème (composant,
flow, brique) avec un emoji par sous-section. Inclure pour chaque ligne :
- le composant ou fichier touché,
- la modification en une phrase, formulée du point de vue utilisateur
  (« la modale ne saute plus » plutôt que « z-index passé à 10001 »).

---

## Pourquoi ça a été fait
Le « why » derrière chaque grand bloc : quel besoin métier, quel bug
client, quelle dette technique. Une bullet par raison, sans répéter le
« quoi ». C'est la section qu'un product owner doit pouvoir lire seul.

---

## Comment ça fonctionne
La partie technique. Pour chaque composant ou flow significatif :
- pattern utilisé (portal, fixed positioning, useEffect, etc.),
- dépendances (lib, hook, util partagé),
- contraintes connues (deprecated API, browser quirk, isolation CSS).
Cette section sert de carte mentale à Claude Code pour itérer ensuite.

---

## Branchements à faire (front / back)
Deux sous-sections distinctes, sous forme de checklists `[ ]` exécutables :

### Côté back-end
- tables Supabase à créer / colonnes à ajouter, RLS, buckets storage,
- variables d'env Vercel à renseigner (avec nom exact et où les obtenir),
- intégrations tierces (Notion, Resend, etc.) à connecter.

### Côté front-end
- composants encore mockés à brancher sur les vraies queries,
- hooks `useCurrentUser`, `useXxx` qui passent du mock à la vraie source,
- pages / routes à câbler.

---

## Fichiers modifiés (optionnel, si > 5 fichiers)
Arbre `tree` minimal des fichiers touchés, avec un commentaire en fin de
ligne pour les fichiers non-triviaux.

---

## Checklist de test manuel (optionnel)
Liste `[ ]` de scénarios concrets à dérouler pour valider la PR à la main.
```

## Règles de forme

- **Toujours** les 5 premières sections (`Contexte`, `Qu'est-ce qui a été fait`, `Pourquoi ça a été fait`, `Comment ça fonctionne`, `Branchements à faire (front / back)`).
- **Toujours** une ligne `---` entre chaque section.
- **Toujours** rédigé en français.
- **Toujours** texte aéré (un saut de ligne entre les idées, pas de mur de texte).
- **Jamais** d'emoji dans le titre de la PR — uniquement dans le corps, en tête de sous-section.
- **Jamais** de mention « Generated with Claude Code » ou de note de session en clair dans le corps — utiliser uniquement le lien de session à la fin (`https://claude.ai/code/session_…`).
- Référence de style à imiter : PR #33 et PR #38 sur `notion-club/infrastructure`.

## Quand cette règle s'applique

- À chaque création de PR (`mcp__github__create_pull_request`).
- À chaque mise à jour du corps d'une PR existante (`mcp__github__update_pull_request`).
- À chaque push qui prépare implicitement une PR sur une branche de feature.

Si la PR ne respecte pas cette structure, la corriger AVANT d'annoncer la fin du travail à l'utilisateur.
