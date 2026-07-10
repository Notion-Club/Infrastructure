# Synchronisation Notion ↔ Supabase

## TL;DR

Le module `src/modules/notion-sync/` est une **coquille vide**. Toute la logique de synchronisation Notion ↔ Supabase vit **ailleurs**, éparpillée dans les modules `formation`, `ressources`, `coaching`, dans `shared/lib/notion/*` et dans un webhook. Ce document cartographie cette réalité et recommande de trancher : peupler le module ou le supprimer.

---

## 1. Le module `notion-sync/` est vide

```
src/modules/notion-sync/
  index.ts               → export {};        (aucune API publique)
  types.ts               → export {};        (aucun type)
  components/.gitkeep
  server/.gitkeep
  hooks/.gitkeep
  lib/.gitkeep
```

`index.ts` et `types.ts` ne contiennent qu'un `export {}` avec un commentaire de placeholder. Les quatre sous-dossiers ne contiennent qu'un `.gitkeep`. **Aucun code de synchronisation n'y réside.** Le module existe dans l'arborescence (probablement réservé lors du découpage initial « Brique 4 — Notion sync »), mais n'a jamais été peuplé.

---

## 2. Où vit réellement la synchronisation

### Client Notion partagé — `src/shared/lib/notion/`

Socle commun à tous les flows Notion (server-only, `NOTION_API_TOKEN`) :

| Fichier | Rôle |
|---|---|
| `client.ts` | Client Notion générique (fetch natif, `Notion-Version 2022-06-28`, Bearer token), `normalizeNotionId` |
| `router.ts` | **Routeur unifié** : point d'entrée unique de récupération + normalisation du body d'une page Notion (Formation / Coaching / Ressources) |
| `blocks.ts` | Ré-export de compat vers `router.ts` (`fetchPageBlocks`, types `NotionBlock` / `RichSpan`) |
| `blocksToPlainText.ts` | `NotionBlock[]` → texte markdown-light (transcriptions IA) |
| `filterNavBlocks.ts` | Retire les blocs de navigation en tête des pages d'appels |
| `video.ts` | Construit le `src` d'iframe vidéo en préservant la query string Tella |
| `write.ts` | **Écriture** Notion : `createNotionMember` (page dans la DB Membres au signup, mapping UUID Supabase ↔ page Notion) — consomme `NOTION_MEMBERS_DATABASE_ID` |

### Formation — `src/modules/formation/server/`

- `notion.ts` : lecture de l'arbre formations/modules/cours depuis Notion (`fetchFormationsTree`, `slugify`).
- `sync.ts` : upsert idempotent Notion → Supabase (structure légère uniquement, jamais le body) via le client admin (service_role). Déclenché par `/api/formation/sync`.

### Ressources — `src/modules/ressources/`

- `lib/notion.ts` : fetch des ressources & templates (`fetchResources`, `fetchTemplates`, `fetchResourceBySlug`, `slugToNotionId`) — consomme `NOTION_API_TOKEN`.
- `server/sync.ts` : upsert idempotent par `notion_id` (structure + body en blocs pour les ressources) via le client admin. Déclenché par `/api/ressources/sync` (protégé par admin **ou** `CRON_SECRET`).

### Coaching — `src/modules/coaching/server/`

- `notion.ts` : lecture **live** des appels d'un membre depuis la DB « Appels de suivi » (`NOTION_CALLS_DATABASE_ID`), filtrés par relation Membre. V1 = pas de sync Supabase (la table `coaching_calls` reste pour traçabilité future mais n'est pas peuplée par ce flow).
- `ensureNotionMemberPage.ts` : résout/matche la page Notion Membre de l'user courant.
- `getCallTranscriptionBlocks.ts` : lecture des blocs d'un appel avec garde d'appartenance.

### Webhook membres — `src/app/api/notion-webhooks/members/route.ts`

`POST /api/notion-webhooks/members` : Notion (automation sur la DB Membres) pousse un event quand l'offre ou la date de fin change. La route :

- Authentifie via header `X-Notion-Webhook-Secret` comparé en temps constant à **`NOTION_WEBHOOK_SECRET`** (pas de HMAC sur le body — les automations Notion ne signent pas le body).
- Parse trois formats de payload possibles (custom, Notion native imbriqué `data.properties`, Notion native flat).
- Délègue à `syncMembershipFromNotion` (dans `src/modules/auth/server/syncMembership.ts`) — c'est le module **`auth`**, pas `notion-sync`, qui porte la synchronisation des memberships.
- Best-effort : renvoie `200` même sur `no_profile_found` / `unknown_offer` pour éviter les retries Notion.

### Routes de déclenchement — `src/app/api/`

- `/api/formation/sync` — sync structure formation (admin ou `Bearer CRON_SECRET`).
- `/api/ressources/sync` — sync ressources (admin ou `Bearer CRON_SECRET`).
- `/api/notion-webhooks/members` — webhook membership (secret dédié).

---

## 3. Réalité architecturale

La synchronisation Notion n'est pas centralisée : elle suit le **découpage par brique métier**. Chaque module lit/écrit son propre périmètre Notion via le socle partagé `shared/lib/notion/*`, et la sync des memberships est portée par `auth/server/syncMembership.ts`. Le module `notion-sync/` dédié, lui, reste vide.

Cela fonctionne (le routeur `shared/lib/notion/router.ts` unifie déjà la partie fetch de blocs), mais crée une incohérence : un développeur cherchant « la synchronisation Notion » ouvrira naturellement `modules/notion-sync/` et n'y trouvera rien.

---

## 4. Recommandation (à trancher par l'équipe)

Deux options, à décider explicitement :

**Option A — Peupler le module `notion-sync/`.** Y regrouper le socle `shared/lib/notion/*`, les `sync.ts` de formation et ressources, le client webhook et `syncMembership`, en exposant une API publique via `index.ts`. Avantage : un point d'entrée unique et découvrable. Coût : refactor transverse + adaptation des imports (attention à la règle d'isolation ESLint — un module ne peut importer que son propre code, `@/shared/*` ou des packages npm ; centraliser la sync dans `notion-sync` obligerait formation/ressources/coaching à importer depuis un autre module, ce qui est interdit — donc cette option n'est viable que si le code sync consommé reste dans `@/shared/*`).

**Option B — Supprimer le module `notion-sync/`.** Acter que la synchronisation vit par brique métier + `shared/lib/notion/*`, et retirer la coquille vide pour ne pas induire en erreur. Avantage : zéro dette, cohérent avec l'architecture réelle. Coût : quasi nul.

> En l'état, **l'option B est la plus alignée** avec le code réel (la règle d'isolation ESLint rend l'option A lourde). Mais c'est une décision produit/archi à valider — d'où la mention explicite ici plutôt qu'une suppression unilatérale.
