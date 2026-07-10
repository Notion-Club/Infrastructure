# Contexte projet — Notion Club Infra

> Fichier chargé automatiquement à chaque session (via `@.claude/context.md` dans `CLAUDE.md`).
> Il doit rester **fidèle à l'état réel du repo**. En cas de doute, le code fait foi ;
> mettre ce fichier à jour plutôt que de le laisser dériver.

## Repo & workflow
- Dépôt : **`notion-club/infrastructure`** (org GitHub), défaut sur `main`.
- Théo et d'autres poussent sur `main` en parallèle → **toujours `git fetch origin` + vérifier l'ancêtre `origin/main` avant tout merge/push de PR** (cf. règle absolue dans `CLAUDE.md`).
- Format de PR imposé (français, sections fixes, style PR #33/#38) : cf. `CLAUDE.md`.

---

## Ce qu'est l'app
Plateforme de delivery du Notion Club : **formation · communauté · coaching · ressources**, réunies dans une seule PWA installable. Un membre = une app ; ce qu'il voit dépend de son offre, via un système de **capabilities** calculé côté serveur (jamais un simple masquage UI).

Notion = back-office contenu (formations, ressources, appels, paiements, membres, roadmap feedback).
Supabase = source de vérité utilisateur (auth, profils, offres, progression, communauté).
Next.js orchestre les deux et applique les droits d'accès.

---

## Stack (réelle, cf. `package.json`)
- **Next.js 16.2.6** (App Router + Turbopack) + **React 19.2.4** — RSC par défaut, View Transitions.
- **Tailwind CSS v4** (`@import "tailwindcss"`, tokens en variables CSS dans `src/app/globals.css`).
- **shadcn/ui** (new-york) → `src/shared/components/ui/`, **lucide-react** 1.16, **radix-ui**.
- **next-themes** — light / dark / system, sans flash (script inline pré-paint).
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) — **branché partout**, RLS activé, **51 migrations** dans `supabase/migrations/`.
- **Resend** (emails), **web-push** (push web/PWA), **Zod v4** (validation), **bcryptjs** (historique mdp).
- Police **SF Pro Display** self-hostée (`next/font/local`).
- Déploiement **Vercel** + Cron quotidien (`vercel.json`).

> ⚠️ Cette version de Next.js a des breaking changes — lire `node_modules/next/dist/docs/` avant d'écrire du code (cf. `AGENTS.md`).

---

## Architecture — modular monolith (cf. `CONVENTIONS.md`)
```
src/
  app/                    Routes (App Router)
    (auth)/               login · signup · reset-password · update-password
    (app)/                zone authentifiée (layout commun, redirect si non loggé)
      dashboard/ formation/ communaute/ coaching/ ressources/ membres/ settings/
    api/                  Route Handlers (sync, cron, push, billing, payments, feedback, webhooks…)
    transcript/[token]/   deep-link transcription signé HMAC (hors /api)
    lab/                  bancs d'essai (morph, notion, zoom) — non prod
    privacy/ terms/       pages légales
  modules/                briques métier isolées (règle ESLint no-restricted-imports)
  shared/                 transverse : components/ (ui, dashboard, notion, theme, pwa,
                          feedback-widget, badges…), lib/, hooks/, types/
supabase/migrations/      51 migrations SQL versionnées (001_ → 050_, dont 039b_)
```

**Modules réels (9)** — la liste doit rester synchronisée dans `README.md`, `CONVENTIONS.md` **et** `eslint.config.mjs` (`MODULES`) :
| Module | État |
|---|---|
| `auth` | auth, profils, memberships, **capabilities** (source de vérité autorisation) |
| `formation` | programmes → modules → leçons, progression, sync Notion |
| `community` | feed (morph + keyset), réactions, commentaires, mentions, DM, notifs, push |
| `coaching` | appels, éligibilité, transcriptions Notion live, deep-links HMAC |
| `ressources` | bibliothèque ressources/templates, gating capability, morph d'ouverture |
| `onboarding` | parcours d'onboarding |
| `settings` | réglages compte (structure minimale : `index.ts` + `lib/` + `server/`) |
| `admin` | actions admin (push broadcast, listes membres) — structure minimale `server/` |
| `notion-sync` | **coquille vide** (`export {}`) — la sync vit éparpillée dans chaque module (voir `docs/architecture/notion-sync.md`) |

Isolation : un module n'importe que son propre code, `@/shared/*`, `@/app/*` (rare) ou des packages npm. Jamais un autre module.

---

## Autorisation — capabilities (le cœur, bien tenu)
8 capabilities booléennes portées par `offers`, débloquées via la `membership` active. Source de vérité TS : **`src/shared/types/capabilities.ts`**, tenue strictement alignée avec les migrations SQL (`003`, `013`) et les fonctions `user_has_capability()` / `get_user_capabilities()` (RPC, mig `032`). Détail complet : **`docs/architecture/authorization-capabilities.md`**.

---

## Flux applicatif
`/ → /login` → (auth Supabase réelle) → `/dashboard`. Les pages `/formation`, `/communaute`, `/coaching`, `/ressources`, `/membres`, `/settings` sont **toutes livrées et branchées** (Supabase + Notion selon la brique). Des mocks subsistent ponctuellement (`src/shared/lib/mock/`) mais l'app n'est plus « zéro Supabase ».

---

## Outil de feedback admin (widget intégré)
> Point d'entrée : **`docs/feedback-widget/README.md`**.

Intégré au **dropdown de la DevToolbox** (plus de bouton flottant ni de hub modal), via `useRegisterFeedbackTools` + `FeedbackToolboxPanel`. Le composant `FeedbackWidget.tsx` ne rend que les overlays (sélection d'élément, formulaire, toasts).

**2 flows** : feedback sur un élément (inspection visuelle) · feedback général (page entière). Plus une vue « Tickets envoyés » (lecture/suppression via `/api/tickets`).

**Routes** (3, toutes **admin-gated** via `isRequestAdmin`, rôle `profiles.role='admin'`) : `/api/feedback` (POST → Notion), `/api/tickets` (GET/DELETE), `/api/feedback-schema` (options dynamiques `Action` + `/End`).

**Base Notion** : `c4209ec9-5e2b-4968-88c8-43e6c4672eda` (défaut hardcodé), token `NOTION_API_TOKEN`, override `NOTION_DATABASE_ID`. Schéma réel = **6 propriétés** : `Composant` (Select), `Action` (Select), `/End` (**multi_select** — Frontend/Backend), `Feedback` (rich_text), `User Agent` (rich_text), `URL` (url).

---

## Design system
Accent rouge `--color-brand: #e0625a` sur fond chaud `#f5f2f2`. Tokens dans `src/app/globals.css` (couleurs, rayons `--nc-radius-*`, ombres `--nc-shadow-*`, easings). Dark mode near-black chaud (pas de noir pur) — cf. `docs/dark-mode/README.md`. Pour toute transition/animation : skill `transitions-dev` (cf. `AGENTS.md`), pas de `@keyframes` ad hoc.

Signatures maison : `.nc-page-halo`, `.nc-shine-card`, `.nc-blink-dot`, `.nc-btn-shine`.

---

## Carte de la documentation
| Sujet | Doc |
|---|---|
| Architecture, isolation, nommage, migrations | `CONVENTIONS.md` |
| Spécificités de cette version de Next.js | `AGENTS.md` |
| Modèle d'autorisation / capabilities | `docs/architecture/authorization-capabilities.md` |
| Transcriptions coaching (HMAC signé) | `docs/architecture/coaching-transcript.md` |
| Module admin (push broadcast) | `docs/architecture/admin.md` |
| Sync Notion (réalité éclatée) | `docs/architecture/notion-sync.md` |
| Inventaire des secrets d'env | `docs/architecture/env-secrets.md` |
| Module communauté | `docs/community/etat-module-communaute.md` |
| Module ressources (sync + gating) | `docs/ressources/README.md` |
| Morph d'ouverture des ressources | `docs/ressources-morph/README.md` |
| Feedback widget admin | `docs/feedback-widget/README.md` |
| Dark mode (palette, tokens) | `docs/dark-mode/README.md` |
| PWA / thème / Safari | `docs/pwa/` |

Les fichiers `docs/audits/`, `docs/design/`, `docs/migrations/` et les `passation-*`/`retrospective-*` sont des **archives datées** : utiles pour le « pourquoi » historique, mais ne décrivent pas forcément l'état courant (bandeau en tête).
