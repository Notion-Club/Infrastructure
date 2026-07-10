# Module admin

Surface d'administration de la plateforme : gestion des membres (page `/membres`) et envoi de notifications push. C'est une **surface sensible** — une faille de garde y donnerait à un utilisateur standard le pouvoir de changer des rôles, révoquer des accès payants ou broadcaster un push à tous les abonnés.

## Structure du module — minimale

```
src/modules/admin/
  server/
    sendPushAction.ts        ← envoi de push (self / users / all)
    getAdminListsAction.ts   ← pickers du dev tool (membres + arbre d'URLs)
    getMembersAdminAction.ts ← données + mutations de la page /membres
```

> **Note de structure** : contrairement aux autres modules, `admin` n'a **pas** d'`index.ts` ni de `types.ts`. Il ne contient qu'un dossier `server/`. Les types sont exportés directement depuis chaque fichier d'action. Aucune API publique formelle n'est déclarée — les Server Actions sont importées directement par les composants consommateurs.

---

## Double garde admin

Toute la sécurité du module repose sur une **défense en profondeur à deux niveaux**, appliquée de façon homogène :

1. **Garde UI** — les cartes/pages admin ne sont montées que pour les admins :
   - La carte push (`AdminPushDevCard`) n'apparaît dans le DevToolbox que pour les admins.
   - La route `/membres` redirige les non-admins vers `/dashboard`.

2. **Garde serveur** — chaque Server Action **re-vérifie** `role = 'admin'` dans `public.profiles` avant tout accès. C'est le contrôle qui compte réellement : sans lui, n'importe quel utilisateur authentifié pourrait poster directement vers l'action (les Server Actions sont des endpoints HTTP) et contourner le masquage UI.

Le pattern serveur est répété (helper `ensureAdmin()` local dans chaque fichier, ou re-check inline) :

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return /* not_authenticated */;
const { data: profile } = await supabase
  .from("profiles").select("role").eq("id", user.id).maybeSingle();
if (profile?.role !== "admin") return /* forbidden */;
```

### `isRequestAdmin()` — `src/shared/lib/auth/requireAdmin.ts`

Helper partagé qui encapsule ce même check (`session Supabase + profiles.role = 'admin'` → `boolean`). Utilisé pour fermer les **routes API** d'administration — notamment celles du widget de feedback (`/api/feedback`, `/api/tickets`) qui écrivent/lisent/suppriment dans la base Notion roadmap via le token privilégié partagé. Avant l'ajout de ce garde, ces routes étaient totalement ouvertes (un anonyme pouvait archiver n'importe quelle page Notion ou lire le backlog interne).

> Les Server Actions du module `admin` n'utilisent **pas** `isRequestAdmin()` : elles ré-implémentent le même check en local, parfois en renvoyant en plus l'`organization_id` (cf. `getMembersAdminAction.ts`) pour scoper les données à l'organisation de l'admin appelant. Une consolidation vers `isRequestAdmin()` est envisageable mais non faite à ce jour.

---

## `getMembersAdminAction.ts` — page `/membres`

Couche de données de la page « Membres Admin » (le design Claude Design tournait sur des mocks ; ici on branche les vraies tables).

- **Lecture** `getMembersAdminData()` : après `ensureAdmin()`, lit via le **client service_role** (bypass RLS) et scope à `organization_id` de l'admin. Agrège en `Promise.all` : `profiles`, `memberships` (+ `offers` joint), `offers` actives, `formations` / `formation_courses` / `formation_course_progress`, `coaching_calls`, `companies`, et les emails depuis `auth.users` (`admin.auth.admin.listUsers`). Calcule pour chaque membre : offre courante, total encaissé, avancement par formation, nombre d'appels / no-shows, prochain appel.
- **Mutations** (toutes `ensureAdmin()` + `revalidatePath('/membres')`) :
  - `setMemberRoleAction` — change `profiles.role` (`member` / `mentor` / `admin`).
  - `setMemberBannedAction` — bascule `profiles.is_banned`.
  - `grantOfferAction` — insère une `membership` `active` `source = 'admin_grant'`, calcule `expires_at` depuis `offers.default_duration_days`.
  - `revokeMembershipAction` — passe une membership en `cancelled` (jamais de suppression : on garde la trace).

Le bypass RLS via service_role n'intervient **qu'après** le contrôle admin.

---

## `sendPushAction.ts` — push broadcast

`sendAdminPushAction(raw)` alimente le dev tool admin. Après le check `role = 'admin'`, valide le payload avec Zod (`title` requis, `body`/`url` optionnels) et une `target` en union discriminée :

- `self` → l'admin lui-même.
- `users` → liste d'UUID (1 à 200), dédoublonnée.
- `all` → tous les user_id ayant une souscription active (`push_subscriptions` où `expired_at IS NULL`), lus via le **client service_role** (bypass RLS).

Pour chaque destinataire, appelle `sendWebPushToUser` (VAPID) et agrège `sent` / `expired` / `failed`. Insère en fire-and-forget une notification in-app `admin_push` par destinataire (`createAdminPushNotifications`) pour que le push apparaisse aussi dans la cloche, indépendamment du succès de l'envoi push.

---

## `getAdminListsAction.ts` — pickers du dev tool

Deux actions qui nourrissent les pickers de la carte push :

- `listAdminMembersAction()` — liste des membres (pour le picker multi-membres). **Pas** de bypass RLS ici : lecture via le client cookies-aware, la policy `profiles_select_same_org` (migration 025) garantit que l'admin voit les profils de son organisation. Renvoie `[]` si non-admin.
- `getAdminUrlTreeAction()` — arbre hiérarchique d'URLs cibles pour la notif (racines statiques + branche Formation construite dynamiquement depuis `formations` / `formation_modules` / `formation_courses`). Renvoie le `STATIC_TREE` de repli si non-admin.

---

## Points de vigilance

- La sécurité repose entièrement sur le re-check serveur `role = 'admin'`. Toute nouvelle Server Action ou route admin **doit** le reproduire (ou appeler `isRequestAdmin()`) avant tout accès aux données.
- Le check est un simple `role === 'admin'` — pas de notion de `super_admin` (dégradée en `admin` par la migration 013).
- Duplication du helper `ensureAdmin()` dans plusieurs fichiers : à consolider éventuellement vers `requireAdmin.ts`.
