@AGENTS.md
@.claude/context.md

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

---

# Règle absolue — enrichissement systématique du README à chaque PR

Le `README.md` est la vitrine et la carte mentale du projet (cf. la version de référence rédigée le 2026-06-08). Il doit **rester vivant** : à partir de maintenant, toute PR qui introduit une **modification structurelle** DOIT mettre à jour le README **dans la même PR**, avant le merge. Le README ne doit jamais prendre du retard sur le code.

## Ce qui déclenche une mise à jour du README

Mettre à jour le README **dès** que la PR contient l'un de ces changements (liste non exhaustive — au moindre doute, mettre à jour) :

- 🧩 **Nouveau module** ou suppression/renommage d'un module dans `src/modules/` → maj de l'arbre « Organisation du code » et du tableau des briques.
- 🗄️ **Nouvelle migration structurelle** (`supabase/migrations/`) : nouvelle table, nouveau bucket storage, changement de modèle RLS → maj de la section « Base de données » (familles de tables + nombre de migrations).
- 🔑 **Nouvelle capability** ou changement du modèle d'accès → maj du tableau « capabilities & accès » (à garder aligné sur `src/shared/types/capabilities.ts`).
- 🔄 **Nouvelle route API**, nouvelle synchro Notion, nouvelle intégration tierce (Resend, Fathom, Fillout, etc.) → maj des sections « Synchro Notion ↔ Supabase » et/ou « Stack technique ».
- 🔐 **Nouvelle variable d'environnement** requise → maj du tableau « Variables d'environnement clés ».
- 🏗️ **Décision d'architecture** ou changement de stack (version majeure, lib remplacée) → maj des sections concernées.
- 📚 **Nouveau document** dans `docs/` → ajout dans le tableau « Documentation interne ».

## Ce qui NE déclenche PAS de mise à jour

Pour éviter le bruit, **ne pas** toucher au README pour : un fix de bug local, un ajustement CSS/copywriting, un refacto interne sans impact sur l'API publique d'un module, l'ajout d'un composant mineur. Le README documente la **structure et le contexte global**, pas chaque commit.

## Comment procéder

1. Mettre à jour **uniquement** les parties réellement impactées — enrichir, pas réécrire. Garder le ton existant (alternance copywriting / technique, texte aéré, emojis en tête de sous-section).
2. Vérifier la cohérence : tout chiffre cité (nombre de migrations, de modules), tout lien interne et tout nom de table/capability/variable doit refléter l'état réel du repo après la PR.
3. Ajouter dans le corps de la PR, sous **« Qu'est-ce qui a été fait »**, une ligne explicite type : `📖 README mis à jour — section(s) X, Y`.
4. Ajouter dans la **« Checklist de test manuel »** de la PR la case : `[ ] README enrichi des changements structurels de cette PR (ou : aucun changement structurel)`.

## Quand cette règle s'applique

- À chaque création/mise à jour de PR contenant un changement structurel listé ci-dessus.
- Avant tout merge : si la PR touche à la structure mais pas au README, **compléter le README AVANT d'annoncer la fin du travail** à l'utilisateur.
