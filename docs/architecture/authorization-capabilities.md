# Autorisation & capabilities

Le modèle d'autorisation de la plateforme repose sur une chaîne unique et alignée de bout en bout :

```
offers (colonnes booléennes)
   └── memberships (lien user ↔ offer, statut + expiration)
         └── capabilities (droits agrégés par OR sur les memberships actives)
               └── RLS / RPC (gating réel côté Postgres et côté serveur Next.js)
```

C'est le point le mieux tenu du back-end : une **source de vérité TypeScript** est maintenue strictement alignée sur les migrations SQL, et toute dérive est explicitement signalée dans les commentaires des fichiers concernés.

---

## 1. Source de vérité TypeScript

`src/shared/types/capabilities.ts` définit le type `Capability` — la liste canonique des 8 capabilities :

| Capability | Sens métier |
|---|---|
| `can_access_challenge_program` | Accès au programme challenge (gratuit) |
| `can_access_paid_programs` | Accès aux programmes payants (formation, accompagnement) |
| `can_message_admins` | Peut écrire aux admins |
| `can_view_community` | Accès au feed communauté |
| `can_view_paid_content` | Voit le contenu marqué `paid_only` dans la communauté |
| `can_book_calls` | Peut réserver des appels coaching |
| `can_view_call_summaries` | Voit les résumés d'appels |
| `can_access_templates_library` | Accès à la bibliothèque de templates |

Le fichier expose aussi :

- `UserCapabilities` = `Record<Capability, boolean>`.
- `DEFAULT_USER_CAPABILITIES` : tout à `false`, utilisé comme valeur de repli pour les users sans membership active ou en cas d'erreur silencieuse serveur.
- `VISIBILITY_TO_CAPABILITY` : mapping des visibilités de ressources Notion vers la capability requise (voir §5).
- `hasAccessToVisibility()` : helper de check côté logique partagée.

L'en-tête du fichier documente noir sur blanc la procédure d'ajout d'une capability (reprise en §6).

---

## 2. Colonnes SQL sur `offers`

Le catalogue d'offres porte chaque capability comme colonne booléenne `not null default false`.

**Migration `003_auth_offers_memberships.sql`** crée la table `public.offers` avec 7 des 8 colonnes :

```
can_access_challenge_program
can_access_paid_programs
can_message_admins
can_view_community
can_book_calls
can_view_call_summaries
can_access_templates_library
```

**Migration `013_role_alignment_and_paid_content.sql`** ajoute la 8ᵉ colonne :

```sql
alter table public.offers
  add column if not exists can_view_paid_content boolean not null default false;
```

Sémantique de `can_view_paid_content` : indépendante de `can_view_community` — un user peut accéder au feed sans avoir débloqué le contenu `paid_only` (ex. offre challenge gratuite).

La table `memberships` (migration 003) relie `profile_id` ↔ `offer_id` avec un `status` (`active` / `expired` / `cancelled` / `refunded` / `paused`) et un `expires_at` nullable (`NULL` = accès à vie). Une membership compte pour l'autorisation si et seulement si :

```
status = 'active'
AND (expires_at IS NULL OR expires_at > now())
AND offers.is_active = true
```

---

## 3. Fonction SQL `user_has_capability()` — whitelist anti-injection

Définie en migration 003, **recréée en migration 013** pour inclure `can_view_paid_content`.

Signature : `public.user_has_capability(p_profile_id uuid, p_capability text) returns boolean`.

Propriétés de sécurité :

- `security definer` + `set search_path` : isole le contexte d'exécution.
- **Whitelist explicite** des 8 noms de capability : tout nom hors liste déclenche `raise exception 'Capability inconnue'`. Sans ce garde, un appelant pourrait injecter un nom de colonne arbitraire, car la requête construit dynamiquement le nom de colonne via `format(%I, p_capability)`.
- `stable` : Postgres peut mémoriser le résultat dans une même requête.

Logique : renvoie `TRUE` si l'user a **au moins une** membership active dont l'offre porte la capability à `TRUE` (logique OR — cumul d'offres possible).

> ⚠️ La whitelist SQL est un miroir manuel de la liste TS. Les deux migrations la hardcodent. C'est le point de vigilance principal : ajouter une capability sans mettre à jour cette whitelist rend la RLS dépendante toujours `false`.

---

## 4. RPC `get_user_capabilities()` — agrégat jsonb

**Migration `032_get_user_capabilities_rpc.sql`** ajoute `public.get_user_capabilities(p_user_id uuid default null) returns jsonb`.

- Récupère les **8 capabilities en une seule passe** `memberships JOIN offers` (via `bool_or` par colonne) au lieu de 8 appels successifs à `user_has_capability()`.
- `security definer` + garde d'autorisation : `v_target := coalesce(p_user_id, auth.uid())`. Si on demande les caps d'un **autre** user, il faut être `role = 'admin'`, sinon `raise exception 'Non autorisé'`.
- `coalesce(bool_or(...), false)` par clé, plus un repli explicite « tout false » si aucune ligne ne matche (user sans membership active).
- `grant execute ... to authenticated`.

### Miroir runtime côté serveur

`src/shared/lib/auth/capabilities.ts` consomme cette RPC :

- `getCurrentUserCapabilities()` : résout `auth.getUser()` puis délègue à `getUserCapabilitiesById()`. Renvoie tout `false` si non authentifié.
- `getUserCapabilitiesById(userId)` : appelle `supabase.rpc("get_user_capabilities", { p_user_id })`, puis **re-mappe explicitement les 8 clés** avec un `=== true` défensif et un repli sur `DEFAULT_USER_CAPABILITIES` par clé manquante. Ne throw jamais (best-effort serveur : log `console.error` + repli).

Consommateurs typiques : le `ProfileIdentityProvider` du layout `(app)` (hydrate le contexte) et les pages serveur ressources (gating ponctuel côté serveur).

---

## 5. Mapping visibilité ressource → capability

Deux miroirs du même mapping, à garder cohérents :

**Côté SQL — migration `031_ressources_schema.sql`** : table `resources_access` (clé = `visibilite`, colonne `required_capability` nullable) seedée ainsi :

| Visibilité Notion | `required_capability` |
|---|---|
| `Publique` | `NULL` (aucun gating) |
| `Challenge Gratuit` | `can_access_challenge_program` |
| `Formation` | `can_access_paid_programs` |
| `Accompagnement` | `can_access_paid_programs` |

La RLS `resources_select` autorise la lecture si `current_profile_role() = 'admin'` **ou** s'il existe une ligne `resources_access` dont la `required_capability` est `NULL` ou satisfaite par `user_has_capability(auth.uid(), ...)`.

**Côté TS — `capabilities.ts`** : `VISIBILITY_TO_CAPABILITY` reproduit exactement ce mapping (`Publique → null`, `Challenge Gratuit → can_access_challenge_program`, `Formation` et `Accompagnement → can_access_paid_programs`). Note : la contrainte CHECK SQL de `resources_access.required_capability` n'autorise que `can_access_challenge_program` ou `can_access_paid_programs` — les deux seules capabilities employées pour le gating ressources.

Décision actée (session 2026-06-04) : pas de capability coaching dédiée pour V1, `Accompagnement` réutilise `can_access_paid_programs`.

---

## 6. Procédure de maintenance — ajouter une capability

L'ajout d'une capability touche **5 emplacements** dans un ordre précis. En manquer un laisse le système silencieusement à `false`.

1. **Colonne SQL sur `offers`** — nouvelle migration :
   ```sql
   alter table public.offers
     add column if not exists can_xxx boolean not null default false;
   ```
2. **Whitelist de `user_has_capability()`** — recréer la fonction (`create or replace`) en ajoutant le nom à la liste `p_capability not in (...)`. Sans cette étape, tout check de la nouvelle capability lève `Capability inconnue`.
3. **RPC `get_user_capabilities()`** — recréer la fonction en ajoutant la clé au `jsonb_build_object` (les deux : la branche `bool_or` et la branche de repli « tout false »).
4. **Type TS `Capability`** — ajouter le littéral dans `src/shared/types/capabilities.ts`.
5. **`DEFAULT_USER_CAPABILITIES`** + le re-mapping explicite de `getUserCapabilitiesById()` dans `src/shared/lib/auth/capabilities.ts` — ajouter la clé (`can_xxx: false` puis `can_xxx: raw.can_xxx === true`).

Si la capability sert au gating d'une ressource, mettre aussi à jour `VISIBILITY_TO_CAPABILITY` (TS), le seed `resources_access` et éventuellement la contrainte CHECK sur `required_capability` (migration).

L'en-tête de `capabilities.ts` liste les étapes 1-5 comme contrat ; ce document en est la version détaillée avec les chemins exacts.
