# Module `ressources` — brique templates & ressources

Point d'entrée canonique du **module métier** `src/modules/ressources`. La
transition d'ouverture des cartes (le « morph ») a **sa propre doc** :
[`docs/ressources-morph/README.md`](../ressources-morph/README.md). Ici on
documente la brique elle-même : synchronisation Notion → Supabase, gating par
capability, queries serveur, routes/pages.

---

## Ce que porte la brique

`/Ressources` unifie deux natures de contenu dans **une seule table** et une
seule grille :

- **Ressources** (`category = 'resource'`) — pages éducatives avec un corps
  Notion riche (process, rediffusions).
- **Templates** (`category = 'template'`) — pages Notion publiques à dupliquer,
  avec éventuellement un embed vidéo Tella.

Le contenu vit dans Notion (source d'autorité éditoriale). Un job de
synchronisation le recopie dans un **cache Supabase** ; le gating (« qui a le
droit de voir quoi ») est porté par les capabilities Supabase.

---

## Structure du module

```
src/modules/ressources/
  index.ts                     ← barrel d'exports du module
  types.ts                     ← Resource | Template | ResourceItem, NotionBlock
                                 (ResourceVisibility ré-exporté de @/shared/types/capabilities)
  components/
    ResourcesGrid.tsx          ← grille (filtres/recherche) + registerItems (morph)
    ResourceCard.tsx           ← carte ressource (clic → open() du morph)
    TemplateCard.tsx           ← carte template
    NoResultsState.tsx / SuggestTemplateCard.tsx / FilloutModal.tsx
    shared/                    ← briques partagées overlay ↔ pages détail
      ResourceContentBody.tsx  ← corps ressource (accès + NotionRenderer / verrou)
      ResourceBadge.tsx  ResourceBreadcrumb.tsx  CapabilityLock.tsx
      TellaEmbed.tsx  ResourcePageFooter.tsx  TemplatePageFooter.tsx
    morph/                     ← transition carte → détail (doc dédiée)
      MorphSourceContext.tsx  ResourceMorphOverlay.tsx
  server/
    sync.ts                    ← synchro Notion → Supabase (upsert par notion_id)
    queries.ts                 ← lecture Supabase + gating server-side
    getResourceBody.ts         ← Server Action : corps d'une ressource (overlay)
  lib/
    notion.ts                  ← client Notion (fetchResources / …BySlug / …Templates)
    fetch.ts                   ← accès Notion direct — chemin actuel des pages
    spring.ts                  ← courbe ressort du morph
```

> Le module **n'a pas** de dossier `hooks/`. Les interactions client vivent
> dans les composants (`ResourcesGrid`, overlay du morph).

---

## Synchronisation Notion → Supabase

### `server/sync.ts` — `syncRessourcesFromNotion()`

Upsert **idempotent par `notion_id`** via le client admin
(`createSupabaseAdminClient`, bypass RLS — l'écriture de structure est réservée
au `service_role`).

Déroulé :

1. Pull de la liste légère des ressources (`fetchResources()`), puis pour
   chacune un **re-pull individuel** (`fetchResourceBySlug`) afin de récupérer
   le **body** (blocs Notion) — `fetchResources()` ne renvoie pas le corps par
   design. Coûteux (1 appel page + 1 appel blocs par ressource) mais borné à
   quelques dizaines d'items.
2. Pull des templates (`fetchTemplates()`) — **métadonnées uniquement** (pas de
   body ; `content = null`, on garde `url_notion_public_page` / `url_tella`).
3. `upsert` sur la table `resources` avec `onConflict: "notion_id"`.

Détails notables :

- Avant chaque écrasement de ressource, un **snapshot du `content` précédent**
  est écrit dans `content_backup` (sauvegarde single-version ; reste `null` sur
  un insert).
- **Pas de suppression** des items retirés de Notion : le cache conserve
  l'historique (un éventuel soft-delete est laissé à plus tard).
- Renvoie un `RessourcesSyncReport` (`fetched` / `upserted` / `failed` par
  catégorie + horodatage).

### Route `src/app/api/ressources/sync/route.ts` — `POST`

`isAuthorized(request)` accepte **deux voies** :

- un **appel machine** portant `Authorization: Bearer <CRON_SECRET>` (comparé à
  `process.env.CRON_SECRET`), **ou**
- un **admin authentifié** : session Supabase valide (`auth.getUser()`) dont
  `profiles.role === 'admin'`.

Sinon → `403 « Non autorisé »`. En succès → `{ ok: true, report }` ; toute
exception de la sync → `500`. Le `service_role` n'est **jamais** exposé (utilisé
uniquement en interne par `sync.ts`).

---

## Gating par capability

Le gating repose sur les **vraies capabilities Supabase** du user courant — plus
de mock (l'ancien `lib/access.ts` + `mockCurrentUser` a été retiré).

### Le check unique — `hasAccessToVisibility(visibilite, caps)`

Une seule fonction, pure et partagée, dans `src/shared/types/capabilities.ts` :

```ts
hasAccessToVisibility(visibility: ResourceVisibility, caps: UserCapabilities): boolean
// → true si VISIBILITY_TO_CAPABILITY[visibility] === null (public),
//   ou si caps[required] === true.
```

Les vraies capabilities viennent de `getCurrentUserCapabilities()`
(`@/shared/lib/auth/capabilities.ts`, RPC Supabase `get_user_capabilities`),
appelé **côté serveur** aux points d'entrée :

- **pages serveur** (`ressources/page.tsx`, `ressource/[slug]`, `template/[slug]`,
  `layout.tsx` pour l'overlay) : résolvent `caps` puis les passent en prop
  (objet booléen sérialisable) aux composants client (`ResourcesGrid`, cartes,
  overlay) et calculent `hasAccess` pour `ResourceContentBody` / footers ;
- **`getResourceBody`** (Server Action) : re-résout `caps` et **renvoie `[]`** si
  l'accès n'est pas accordé → le contenu payant ne quitte jamais le serveur.

> Conséquence : les pages ressources sont en **rendu dynamique** (`ƒ`) — un
> gating par user interdit la mise en cache statique. La **source de données**
> reste Notion direct (`lib/fetch.ts`) ; seul l'**input du gating** est passé du
> mock aux vraies capabilities.

### Le mapping canonique — `VISIBILITY_TO_CAPABILITY` + `resources_access`

Le mapping visibilité → capability vit dans
`src/shared/types/capabilities.ts` :

| Visibilité (Notion) | Capability requise |
|---|---|
| `Publique` | `null` (aucun gating — tout user authentifié) |
| `Challenge Gratuit` | `can_access_challenge_program` |
| `Formation` | `can_access_paid_programs` |
| `Accompagnement` | `can_access_paid_programs` |

Ce mapping est le miroir applicatif de la table `resources_access`
(migration **`031_ressources_schema.sql`**), qui pose aussi la table `resources`
et la **RLS de lecture** (`resources_select`) : un user ne voit une ligne que si
`resources_access.required_capability` est `null`, ou si
`user_has_capability(auth.uid(), required_capability)` est vrai (les admins
voient tout). L'écriture reste `service_role`.

> La capability **`can_access_templates_library`** existe dans le socle
> capabilities (`Capability`, table `offers`, migrations 003 / 032) mais
> **n'est pas** mappée dans `VISIBILITY_TO_CAPABILITY` ni dans le seed
> `resources_access` (qui ne référence que `can_access_challenge_program` et
> `can_access_paid_programs`). Le gating des templates repose donc aujourd'hui
> sur leur **visibilité**, pas sur cette capability dédiée — réservée à un
> affinage ultérieur.

---

## Queries serveur

### `server/queries.ts`

Lecture depuis le **cache Supabase** avec gating server-side du contenu payant.

- `getAllResourceItems()` — liste **sans le body** (`content` exclu, lourd) ;
  la RLS `resources_select` filtre déjà par capability côté DB. Trié par
  `date_creation desc`.
- `resolveResourceAccess(slug)` — résout l'accès d'un item :
  - `null` si absent / non visible (RLS bloque) ;
  - `{ hasAccess: false, resource sans content }` si visible mais capability
    manquante (pour afficher le verrou) ;
  - `{ hasAccess: true, resource avec content }` sinon.

  Point clé sécurité : **si `!hasAccess`, le `content` n'est jamais chargé** →
  aucun contenu payant ne fuit au client, même si le composant UI est altéré.
  Le body est refetché séparément (`loadWithContent`) pour ne pas payer la
  colonne TOAST sur les requêtes de liste.

### `server/getResourceBody.ts`

Server Action (`'use server'`) utilisée par l'**overlay de morph** : la carte
s'ouvre instantanément avec le header (déjà en mémoire) puis charge le corps.

```ts
getResourceBody(slug): Promise<NotionBlock[]>
```

Recharge la ressource (`getResourceBySlug`), résout les vraies capabilities
(`getCurrentUserCapabilities`), applique `hasAccessToVisibility(...)` et
**renvoie `[]` si l'accès n'est pas accordé** (l'overlay affiche alors le
`CapabilityLock`). Même source que la page détail → rendu identique.

---

## Routes & pages

Toutes sous `src/app/(app)/ressources/` (donc derrière l'auth du groupe
`(app)`).

| Fichier | Rôle |
|---|---|
| `layout.tsx` | Monte `<MorphSourceProvider>` (contrôleur du morph). Plus de slot `@modal` ni de route interceptée. |
| `page.tsx` | Index : header + `<ResourcesGrid items={…} />`. |
| `loading.tsx` | Skeleton de la grille. |
| `ressource/[slug]/page.tsx` | Page détail ressource (accès direct / refresh / cmd-clic). Skeleton + `ResourceContentBody`. |
| `template/[slug]/page.tsx` | Page détail template (embed Tella + footer). |

> **Câblage actuel des données** : `page.tsx` et les pages `[slug]` importent
> `getAllResourceItems` / `getResourceBySlug` depuis **`lib/fetch.ts`** (accès
> Notion direct), pas depuis `server/queries.ts` (Supabase). Le **gating**, lui,
> est déjà branché sur les vraies capabilities Supabase (cf. section Gating).
> Le couple `sync.ts` + `queries.ts` + migration 031 constitue le chemin
> **données** Supabase (cache + RLS), prêt mais pas encore branché sur les pages :
> le basculer (`resolveResourceAccess` / `getAllResourceItemsCached`) reste une
> évolution possible pour économiser les appels Notion.

---

## Rendu du contenu Notion

Le corps d'une ressource est rendu par le **renderer Notion unifié**
`@/shared/components/notion/NotionRenderer` (via `ResourceContentBody`), partagé
avec Formation / Coaching. Il n'y a **plus** de renderer propre au module (l'ancien
`shared/renderBlock.tsx` a été supprimé). Détails de l'intégration dans la doc
du morph.
