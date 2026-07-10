# Conventions — Notion Club Infra

## Architecture modulaire stricte

Chaque brique métier vit dans `src/modules/<brique>/` et est **self-contained**.

```
src/
  app/                   Next.js routes (pages + layouts)
  modules/               9 briques (liste synchronisée avec eslint.config.mjs → MODULES)
    auth/                auth, profiles, memberships, capabilities
    formation/           programmes de formation (sync Notion)
    community/           fil communautaire, DM, notifs, push
    coaching/            calls, summaries, transcriptions signées
    ressources/          bibliothèque + gating capability
    onboarding/          parcours d'onboarding
    settings/            réglages du compte
    admin/               actions admin (push broadcast, listes membres)
    notion-sync/         coquille vide — cf. docs/architecture/notion-sync.md
  shared/
    components/ui/       composants shadcn/ui (générés)
    components/          composants réutilisables transversaux
    lib/                 utils (cn, fetchers, etc.)
    hooks/               hooks React transversaux
    types/               types globaux
supabase/
  migrations/            SQL versionné (préfixé 001_, 002_…)
  seed.sql               données de bootstrap (idempotent)
```

Gabarit de référence d'un module :

```
src/modules/<brique>/
  components/            UI Client/Server Components
  hooks/                 hooks React spécifiques au module
  lib/                   pure functions, types, helpers métier
  server/                Server Actions, Route Handlers, code DB
  index.ts               API publique (re-exports explicites)
  types.ts               types publics
```

**Le gabarit est une cible, pas un invariant** — l'état réel diverge et c'est assumé :
- `auth`, `formation`, `coaching`, `onboarding` suivent le gabarit complet.
- `community` va au-delà : dossiers `types/` (définitions) + `types.ts` (barrel), `utils/`, `mocks/`, `routes/`.
- `settings` : `index.ts` + `lib/` + `server/` seulement (pas de `components/`, `hooks/`, `types.ts`).
- `ressources` : pas de `hooks/`.
- `admin` : `server/` seul (pas d'`index.ts` ni `types.ts`) — surface minimale d'actions admin.
- `notion-sync` : **coquille vide** (`index.ts`/`types.ts` = `export {}`, sous-dossiers `.gitkeep`). La sync Notion vit en réalité dans chaque module concerné — cf. `docs/architecture/notion-sync.md`.

> Toute nouvelle brique doit être ajoutée à `eslint.config.mjs` (`MODULES`) pour que la règle d'isolation s'applique.

## Règles d'isolation (ESLint)

**Imports interdits** — ESLint bloque (`no-restricted-imports`) :

```ts
// ❌ Dans src/modules/auth/, importer depuis un autre module
import { CommunityFeed } from "@/modules/community/components/CommunityFeed";
```

**Imports autorisés** :
- ✅ Code interne au module (`./` ou `../`)
- ✅ `@/shared/*` (utilitaires partagés)
- ✅ Packages npm externes
- ✅ Depuis `src/app/*` vers `@/modules/<brique>` (orchestration)

**Si tu as besoin de partager du code entre 2 modules** :
1. Le code est-il vraiment transverse ? → déplace dans `@/shared/*`.
2. Le module A a-t-il vraiment besoin d'appeler le module B ? → repense l'API, orchestre depuis `app/` ou via une Server Action.

## Nommage

| Élément | Convention | Exemple |
|---|---|---|
| Fichier composant | `PascalCase.tsx` | `SignupForm.tsx` |
| Fichier hook | `camelCase.ts` (préfixe `use`) | `useCurrentUser.ts` |
| Fichier server action | `camelCase.ts` | `signUp.ts` |
| Type / interface | `PascalCase` | `UserProfile` |
| Variable / fonction | `camelCase` | `getCurrentUser` |
| Constante | `SCREAMING_SNAKE_CASE` | `MAX_RETRY` |
| Table SQL | `snake_case`, pluriel | `user_memberships` |
| Colonne SQL | `snake_case` | `created_at` |
| Migration | `NNN_brique_description.sql` | `003_auth_offers_memberships.sql` |

## Path aliases (tsconfig)

- `@/*` → `src/*`
- `@/modules/*` → `src/modules/*`
- `@/shared/*` → `src/shared/*`

## shadcn/ui

- Installé via `npx shadcn@latest add <component>` — cible `src/shared/components/ui/`
- **Ne pas modifier directement** un composant shadcn juste après l'install. Si tu as besoin d'un variant custom, étends-le via `cva()` ou wrap dans un composant maison dans `@/shared/components/`.
- Config dans [components.json](./components.json), alias dans [tsconfig.json](./tsconfig.json).

## Supabase migrations

- Une migration = un fichier SQL préfixé `NNN_` séquentiel (état actuel : `001_` → `050_`, **51 fichiers**).
- Exception existante : `039b_notifications_archive.sql` (suffixe alpha, intercalé). Éviter d'en créer d'autres — préférer le prochain numéro libre.
- **Idempotent quand possible** (`CREATE TABLE IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`)
- RLS activé sur **toutes** les tables exposées (`ENABLE ROW LEVEL SECURITY`)
- Tout déploiement passe par `supabase db push` ou `supabase migration up`
