# Conventions — Notion Club Infra

## Architecture modulaire stricte

Chaque brique métier vit dans `src/modules/<brique>/` et est **self-contained**.

```
src/
  app/                   Next.js routes (pages + layouts)
  modules/
    auth/                Brique 1 — auth, profiles, memberships
    formation/           Brique 2 — programmes de formation
    community/           Brique 3 — fil communautaire
    notion-sync/         Brique 4 — sync Notion ↔ Supabase (amorce)
    coaching/            Brique 5 — calls, summaries
    onboarding/          Brique 6 — parcours d'onboarding (pré-écrit, à câbler)
    settings/            Brique 7 — réglages du compte
    ressources/          Brique 8 — bibliothèque & templates
    admin/               Brique 9 — actions admin (listes, membres, push)
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

Chaque module suit la même sous-structure :

```
src/modules/<brique>/
  components/            UI Client/Server Components
  hooks/                 hooks React spécifiques au module
  lib/                   pure functions, types, helpers métier
  server/                Server Actions, Route Handlers, code DB
  index.ts               API publique (re-exports explicites)
  types.ts               types publics
```

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

- Une migration = un fichier SQL préfixé `NNN_` séquentiel
- **Idempotent quand possible** (`CREATE TABLE IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`)
- RLS activé sur **toutes** les tables exposées (`ENABLE ROW LEVEL SECURITY`)
- Tout déploiement passe par `supabase db push` ou `supabase migration up`
