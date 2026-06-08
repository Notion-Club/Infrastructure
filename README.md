<div align="center">

<img src="https://res.cloudinary.com/dceobxyts/image/upload/v1777034233/Notion_Club_-_Black_-_Sans_BG_hcvk9k.png" alt="Notion Club" height="72" />

# Notion Club — Infrastructure

**La plateforme de delivery du Notion Club.**
Formation, communauté, coaching et ressources — réunis dans une seule app, installable comme une vraie application mobile.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Notion](https://img.shields.io/badge/Notion-CMS%20live-000000?logo=notion&logoColor=white)](https://notion.so/)
[![Vercel](https://img.shields.io/badge/Vercel-deploy-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](#-pwa--installable-comme-une-vraie-app)

</div>

---

## 🪄 C'est quoi le Notion Club ?

Le Notion Club accompagne ses membres pour devenir des **experts (et consultants) Notion**. Cette app est le **produit livré aux clients** : l'endroit unique où ils suivent leur formation, échangent avec la communauté, réservent leurs appels de coaching et téléchargent leurs templates.

L'idée directrice : **un membre, une app.** Tout ce qu'il a acheté — challenge gratuit, formation payante, accompagnement premium — s'ouvre ou se verrouille automatiquement selon son offre, sans qu'on ait à jongler entre dix outils.

En coulisses, l'équipe pilote le contenu **depuis Notion** (formations, ressources, comptes-rendus d'appels, paiements). L'app le synchronise et le rend dans une interface soignée, rapide, installable sur le téléphone comme une application native.

> **En une phrase :** Notion est le back-office de l'équipe, cette app est la vitrine premium pour le membre.

---

## ✨ Les grandes briques

| Brique | Pour le membre | Sous le capot |
|---|---|---|
| 🔐 **Auth & comptes** | Inscription, connexion, vérification email, profil, abonnement | Supabase Auth, profils, offres & capabilities, soft-delete RGPD |
| 🎓 **Formation** | Programmes → modules → leçons vidéo, progression, prise de notes | Contenu piloté depuis Notion, progression stockée dans Supabase |
| 💬 **Communauté** | Fil de posts, réactions, commentaires, mentions, messagerie privée | RLS « deux silos », emails de notif DM, médias hébergés |
| 🎧 **Coaching** | Réservation d'appels, historique, résumés & transcriptions | Lecture live Notion + Fathom, deep-links signés vers ChatGPT/Claude |
| 📚 **Ressources** | Bibliothèque de ressources & templates Notion, gating par offre | Synchro Notion → Supabase, accès par capability |
| 🛠️ **Feedback admin** | (admin) Annoter n'importe quel élément de la page d'un clic | Widget intégré → crée des tickets dans une base Notion roadmap |

Chaque membre ne voit que ce que son offre débloque. Le verrouillage est **calculé côté serveur** (jamais juste masqué côté écran) via un système de *capabilities*.

---

## 🏗️ Architecture en un coup d'œil

```
                         ┌──────────────────────────────┐
       Équipe Notion ───▶│            NOTION             │  ← back-office contenu
   (formations, calls,   │  formations · ressources ·   │
    paiements, membres)  │  appels · paiements · roadmap│
                         └───────────────┬──────────────┘
                                         │  sync / lecture live (API + webhooks)
                                         ▼
   ┌────────────┐   Server Actions  ┌──────────────────────────────┐
   │  Membre    │◀────────────────▶ │      NEXT.JS 16 (App Router)  │
   │ (PWA web)  │   RSC + Client    │  modules: auth · formation ·  │
   └────────────┘                   │  community · coaching ·       │
                                    │  ressources · onboarding      │
                                    └───────┬───────────────┬───────┘
                                            │               │
                          RLS / capabilities│               │ emails transactionnels
                                            ▼               ▼
                                    ┌────────────┐   ┌──────────────┐
                                    │  SUPABASE  │   │    RESEND    │
                                    │ Postgres · │   └──────────────┘
                                    │ Auth·Storage│
                                    └────────────┘
                          déployé sur ▶ VERCEL (+ Cron quotidien)
```

**Le principe :** Notion est la source de vérité du *contenu*, Supabase la source de vérité de l'*utilisateur et de sa progression*, Next.js orchestre les deux et applique les droits d'accès.

---

## 🧱 La stack technique

### Front
- **Next.js 16.2** (App Router + Turbopack) — React Server Components par défaut, View Transitions activées.
- **React 19**.
- **Tailwind CSS v4** (config CSS-first via `@import "tailwindcss"`, design tokens en variables CSS).
- **shadcn/ui** (style *new-york*) → `src/shared/components/ui/`, icônes **lucide-react**.
- **next-themes** — light / dark / system, sans flash au chargement (script inline pré-paint).
- **Police signature** : **SF Pro Display** (graisses 400 / 500 / 600 / 700) self-hostée via `next/font/local` — zéro appel réseau au runtime. ([source des `.otf`](https://github.com/sahibjotsaggu/San-Francisco-Pro-Fonts))

### Back / données
- **Supabase** — Postgres (auth, profils, offres, communauté, formation, coaching), Auth, Storage (avatars + médias communauté). **RLS activé sur toutes les tables exposées.**
- **Notion** comme CMS live — formations, ressources, appels de coaching, paiements, membres, roadmap de feedback.
- **Resend** — emails transactionnels (vérification email, notifications DM).
- **Fathom** — enregistrements & transcriptions d'appels coaching.
- **Fillout** — formulaires de réservation embarqués.
- **Zod** — validation des entrées, **bcryptjs** — historique de mots de passe.

### Infra
- **Vercel** — hébergement + **Cron** (`vercel.json`, 1×/jour à 9h UTC pour drainer la queue d'emails DM).
- **PWA** — manifest dynamique + service worker, installable iOS / Android.

---

## 📂 Organisation du code — *modular monolith*

Le repo applique une **architecture modulaire stricte** : chaque brique métier est *self-contained* et **ne peut pas importer le code d'une autre brique** (règle ESLint `no-restricted-imports`). Le partage passe obligatoirement par `@/shared/*` ou une orchestration depuis `app/`.

```
src/
├── app/                     # Routes Next.js (App Router)
│   ├── (auth)/              # login · signup · reset / update password
│   ├── (app)/               # zone authentifiée (layout commun, redirect si non loggé)
│   │   ├── dashboard/       #   accueil membre
│   │   ├── formation/       #   programmes → modules → leçons
│   │   ├── communaute/      #   fil + posts + DM
│   │   ├── coaching/        #   appels, résumés, transcriptions
│   │   ├── ressources/      #   ressources & templates
│   │   └── settings/        #   profil, sécurité, abonnement, apparence
│   └── api/                 # Route Handlers (sync, cron, paiements, feedback, …)
│
├── modules/                 # 🧩 briques métier isolées
│   ├── auth/                #   auth · profils · memberships · capabilities
│   ├── formation/           #   programmes (branché Notion + Supabase)
│   ├── community/           #   feed · réactions · commentaires · messagerie
│   ├── coaching/            #   appels · éligibilité · transcriptions Notion
│   ├── ressources/          #   bibliothèque · gating par capability
│   ├── onboarding/          #   parcours d'onboarding
│   ├── notion-sync/         #   socle de synchro Notion ↔ Supabase
│   └── settings/            #   réglages du compte
│
└── shared/                  # transverse : ui/, components/, lib/, hooks/, types/
    ├── components/          #   dashboard, settings, coaching, feedback-widget, theme, pwa…
    ├── lib/                 #   supabase/ · notion/ · security/ · fonts · utils
    └── types/               #   capabilities (source de vérité unique)

supabase/
├── migrations/              # 34 migrations SQL versionnées (001_… → 034_…)
└── seed.sql                 # données de bootstrap idempotentes
```

Chaque module suit la même sous-structure : `components/` · `hooks/` · `lib/` · `server/` (Server Actions, Route Handlers, code DB) · `index.ts` (API publique) · `types.ts`.

👉 Détails et règles dans **[CONVENTIONS.md](./CONVENTIONS.md)**.

---

## 🔑 Le cœur du métier : *capabilities* & accès

Tout le contrôle d'accès repose sur un système simple et défendable côté serveur.

Un membre a une **offre** (`offers`) liée par une **membership** active. Chaque offre porte des colonnes booléennes — les *capabilities* — qui décrivent ce qu'elle débloque :

| Capability | Débloque |
|---|---|
| `can_access_challenge_program` | Le challenge gratuit |
| `can_access_paid_programs` | Les formations payantes |
| `can_view_paid_content` | Le contenu premium |
| `can_view_community` | Le fil communautaire |
| `can_message_admins` | La messagerie vers l'équipe |
| `can_book_calls` | La réservation d'appels |
| `can_view_call_summaries` | Les résumés / transcriptions d'appels |
| `can_access_templates_library` | La bibliothèque de templates |

La vérification se fait via les fonctions SQL `user_has_capability()` / `get_user_capabilities()` (RPC Supabase), appliquées **avant** de servir le contenu. Le type TypeScript `Capability` (`src/shared/types/capabilities.ts`) est la **source de vérité unique**, tenue strictement alignée sur les migrations SQL.

> Conséquence : une ressource « Formation » est invisible *et* inaccessible pour un membre qui n'a que le challenge gratuit — le gating n'est pas cosmétique.

---

## 🔄 La synchro Notion ↔ Supabase

C'est la pièce qui rend l'app vivante sans back-office maison.

- **Formations & ressources** : la structure (programmes → modules → leçons, ressources & templates) est éditée dans Notion, puis **synchronisée vers Supabase** via `POST /api/formation/sync` et `POST /api/ressources/sync`. Autorisation par session admin **ou** `Bearer CRON_SECRET` (machine).
- **Appels de coaching** : lus **en direct** depuis Notion à chaque visite de `/coaching` (statut, date, coach, résumé, lien Fathom). Les blocs de la page Notion font office de transcription.
- **Paiements** : lus en live depuis la base Notion `Paiements`, matchés par la relation `Membre`.
- **Membres** : au signup, une page membre est créée dans Notion (mapping `UUID Supabase ↔ page Notion`) — best-effort, le signup réussit même si l'étape échoue.
- **Transcriptions pour l'IA** : chaque appel passé expose un lien `/transcript/<token>` signé **HMAC-SHA256** (expiration 24h) — un bouton « Demander à ChatGPT / Claude » que l'assistant suit pour lire la transcription brute en `text/plain`.

---

## 📱 PWA — installable comme une vraie app

- **Manifest dynamique** (`src/app/manifest.ts`) + **service worker** → installation depuis l'écran d'accueil iOS / Android, mode `standalone` (plus de barre navigateur).
- Métadonnées `apple-mobile-web-app-*`, `viewport-fit=cover` (gère l'encoche iPhone via `env(safe-area-inset-*)`), zoom au focus désactivé pour un ressenti natif.
- Header `Cache-Control` strict sur `/sw.js` pour que les nouvelles versions se propagent immédiatement après un déploiement Vercel.
- Navigation **desktop** (Topbar fixe) et **mobile** (top actions flottantes + BottomNav pill) pensées séparément.

---

## 🎨 Design system

Identité rouge Notion Club (`--color-brand: #e0625a`) sur fond chaud pinkish (`#f5f2f2`), tokens centralisés dans `src/app/globals.css` (couleurs, rayons, ombres, easings). Dark mode élégant *near-black* chaud (pas de noir pur), documenté dans **[docs/dark-mode/README.md](./docs/dark-mode/README.md)**.

Quelques signatures maison : `.nc-page-halo` (halo radial de fond), `.nc-shine-card` (bordure conic-gradient animée), `.nc-blink-dot`, `.nc-btn-shine`.

---

## 🚀 Démarrer en local

> ⚠️ **Cette version de Next.js a des breaking changes** par rapport à ce que tu connais peut-être. Avant d'écrire du code, lis le guide concerné dans `node_modules/next/dist/docs/` — cf. **[AGENTS.md](./AGENTS.md)**.

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env.local
#    puis renseigner Supabase / Resend / Notion (détails commentés dans .env.example)

# 3. Lancer le serveur de dev (Turbopack)
npm run dev        # → http://localhost:3000

# Autres scripts
npm run build      # build de production
npm run start      # serveur de production
npm run lint       # ESLint (dont la règle d'isolation des modules)
```

### Variables d'environnement clés

| Domaine | Variables |
|---|---|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **App** | `NEXT_PUBLIC_APP_URL` |
| **Emails** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL` |
| **Notion** | `NOTION_API_TOKEN`, `NOTION_WEBHOOK_SECRET`, `NOTION_MEMBERS_DATABASE_ID`, `NOTION_CALLS_DATABASE_ID`, `NOTION_DATABASE_ID` (feedback) |
| **Coaching / IA** | `TRANSCRIPT_SIGNING_KEY`, `NEXT_PUBLIC_FILLOUT_COACHING_URL` |
| **Cron** | `CRON_SECRET` |

Le détail complet (où trouver chaque clé, schémas Notion attendus) est documenté **dans les commentaires de [`.env.example`](./.env.example)**.

---

## 🗄️ Base de données

34 migrations SQL versionnées dans `supabase/migrations/` (préfixées `NNN_`), idempotentes quand possible, **RLS activé partout**. Grandes familles de tables :

- **Auth & offres** — `organizations`, `profiles`, `offers`, `memberships`, `membership_changes`, historique de mots de passe, soft-delete.
- **Formation** — `formations`, `formation_modules`, `formation_courses`, `formation_access`, `formation_course_progress`, `formation_course_notes`.
- **Communauté** — `posts`, `comments`, `comment_replies`, `conversations`, `messages`, et les tables de réactions (`post_reactions`, `comment_reactions`, `message_reactions`) — RLS « deux silos » + bypass admin.
- **Ressources** — `resources`, `resources_access`.
- **Coaching** — `coaching_calls`.

Déploiement via `supabase db push` / `supabase migration up`.

---

## 📚 Documentation interne

| Doc | Contenu |
|---|---|
| **[CONVENTIONS.md](./CONVENTIONS.md)** | Architecture modulaire, règles d'isolation, nommage, migrations |
| **[AGENTS.md](./AGENTS.md)** | ⚠️ Spécificités de cette version de Next.js |
| **[docs/dark-mode/README.md](./docs/dark-mode/README.md)** | Architecture CSS du dark mode, palette, patterns |
| **[docs/feedback-widget/README.md](./docs/feedback-widget/README.md)** | Outil de feedback admin → tickets Notion |
| **[docs/audits/](./docs/audits/)** | Audits (navigation, loading states, transitions) |
| **[docs/design/](./docs/design/)** | Notes de design (transitions de navigation) |

---

<div align="center">

**Notion Club** · plateforme de delivery — *formation · communauté · coaching · ressources*

</div>
