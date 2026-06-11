# PWA Notion Club — Récap technique complet

> **Reprise de contexte** : ce document est le point d'entrée canonique pour
> tout agent (Claude Code ou autre) qui reprend le chantier PWA après une
> session. Il décrit l'état actuel, les PR ouvertes/mergées, la chaîne
> Web Push, le schéma Supabase, et la dette technique restante.
>
> **Branche active** : `claude/dazzling-turing-qLoW4`
>
> **Dernière mise à jour** : 2026-06-11

---

## 🎯 Objectif produit

Distribuer Notion Club « comme une vraie app » sur iPhone, sans App Store,
via une PWA installable depuis Safari.

Critères de Done :

1. **Installation** : l'utilisateur ajoute la page à son écran d'accueil depuis Safari.
2. **Standalone immersif** : l'app s'ouvre en plein écran, zéro chrome Safari.
3. **Notifications push** : un événement serveur déclenche une notification iOS, l'utilisateur peut accepter / refuser.
4. **Sensation d'app native** : pas d'auto-zoom au focus d'input, frosted glass haut de page, transitions internes propres.

Tous les critères sont aujourd'hui **techniquement remplis dans le code**. Reste à finir la config infra (VAPID, déploiement final) et le test iPhone réel.

---

## 📦 Récap chronologique des PR

| # | Titre | Périmètre | État |
|---|---|---|---|
| #62 | `feat(pwa): mode standalone iOS + service worker (sans push)` | Manifest, balises iOS, viewport-fit=cover, sw.js avec handlers `push`/`notificationclick` déjà déclarés, ServiceWorkerRegistrar, icônes placeholders | ✅ Mergée |
| #65 | `Finitions PWA : fix nav mobile + vraies icônes` | Fix safe-area BottomNav (`bottom: calc(10px + env(safe-area-inset-bottom))`), vraies icônes générées depuis le logo Cloudinary, sharp retiré de devDeps | ✅ Mergée |
| #128 | `PWA : désactive l'auto-zoom iOS sur focus d'input` | `maximumScale: 1` + `userScalable: false` dans viewport | ✅ Mergée |
| #143 | `PWA iOS : immersion edge-to-edge` | `statusBarStyle: black-translucent`, scrim sombre light mode, MobileTopActions poussé sous le notch | ✅ Mergée |
| #144 | `Hotfix PWA iOS : rétablit la position du contenu` | `padding-top: env(safe-area-inset-top)` sur `.nc-page-halo` pour compenser le body étendu sous la status bar | ✅ Mergée |
| #146 | `Frosted glass haut de page mobile` | `GradualBlurOverlay anchor="top"` remplace le scrim sombre, étendu d'un prop `anchor` | ✅ Mergée |
| #148 | `Web Push notifications — DB + routes + UI + hook client` | Migration `036_push_subscriptions`, lib `@/shared/lib/push/`, 3 routes API, hook `usePushSubscription`, 4ème canal Push dans NotificationsSection | 🔄 **Ouverte** |

---

## 🔧 Stack Web Push — état actuel

### Service Worker (`public/sw.js`, version `v1`)

- Handlers `push` (l. 134-151) et `notificationclick` (l. 153-175) **déjà déclarés depuis #62**.
- iOS Safari ≥ 16.4 exige que le SW ait un listener `push` enregistré au moment de `pushManager.subscribe()` — c'est satisfait sans modification.
- Stratégies de cache : `_next/static` cache-first, HTML navigation network-first, `/api/*` et `/auth/*` pass-through.

### Métadonnées PWA (`src/app/layout.tsx`)

```ts
appleWebApp: {
  capable: true,
  title: "Notion Club",
  statusBarStyle: "black-translucent",
}

viewport: {
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2f2" },
    { media: "(prefers-color-scheme: dark)",  color: "#141211" },
  ],
}
```

### Manifest (`src/app/manifest.ts`)

- `display: standalone`, `start_url: /dashboard`, `scope: /`
- 4 icônes : 192, 512, 512 maskable, 180 apple-touch
- Background + theme color = `#f5f2f2` (cream)

### Frosted glass haut de page (`src/shared/components/GradualBlurOverlay.tsx`)

- Composant existant étendu d'un prop `anchor: "top" | "bottom"`.
- Monté dans `layout.tsx` en `md:hidden` avec `anchor="top" height={100} zIndex={35}`.
- `zIndex` < `MobileTopActions.zIndex (40)` → les boutons restent nets, c'est uniquement la page qui se floute en passant derrière.

### Module Web Push serveur (`src/shared/lib/push/`)

| Fichier | Rôle |
|---|---|
| `vapid.ts` | Lecture env vars + erreurs explicites. Côté client : getter qui renvoie `null` si VAPID absent → UI désactive le toggle proprement. |
| `webPush.ts` | `sendWebPushToUser(userId, payload)` — boucle sur les souscriptions actives, gère 404/410 → `expired_at`, met à jour `last_seen_at`, retourne `{ sent, expired, failed, failures[] }`. |
| `types.ts` | `PushSubscriptionJSON` + `PushPayload` (consommé par le SW). |

### Routes API

| Route | Méthode | Auth | Rôle |
|---|---|---|---|
| `/api/push/subscribe` | POST | Cookies Supabase | Upsert sur `endpoint` (UNIQUE). |
| `/api/push/unsubscribe` | POST | Cookies Supabase | Delete par endpoint, RLS user-scoped. |
| `/api/push/send` | POST | `Authorization: Bearer $CRON_SECRET` | Machine-to-machine (cron, webhook, curl admin). |

### Hook client (`src/shared/lib/hooks/usePushSubscription.ts`)

- Détection support (SW + PushManager + Notification API + VAPID key dispo)
- `subscribe()` : `Notification.requestPermission()` → `pushManager.subscribe()` → POST `/api/push/subscribe` (rollback browser side si DB fail)
- `unsubscribe()` : POST `/api/push/unsubscribe` puis `subscription.unsubscribe()`
- **Toujours appelé depuis un user gesture** (iOS Safari refuse `subscribe()` hors clic).

### UI — `NotificationsSection.tsx`

- 4ᵉ colonne « Push » (icône `Smartphone` lucide) ajoutée à la matrice 5 catégories × 4 canaux.
- Le toggle Push déclenche le hook au clic au lieu d'un simple `setState`.
- Grid passée de `repeat(3, 56px)` à `repeat(4, 52px)` mobile et `repeat(4, 88px)` desktop.

---

## 🗄️ Schéma Supabase

### Table `push_subscriptions` (créée par migration 036)

```sql
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expired_at    timestamptz
);
```

- **4 RLS policies user-scoped** : select / insert / update / delete avec `user_id = (select auth.uid())`.
- **Index partiel** sur `(user_id) WHERE expired_at IS NULL` → lookups serveur rapides.
- Le service_role (utilisé par `/api/push/send`) bypasse RLS.

### CHECK constraints étendus

| Table | Avant | Après |
|---|---|---|
| `notification_preferences.channel` | `('email', 'in_app', 'whatsapp')` | `('email', 'in_app', 'whatsapp', 'push')` |
| `channel_preferences.channel` | idem | idem |

### État d'application

| Env | `channel_preferences` | `push_subscriptions` | CHECK push |
|---|---|---|---|
| **Prod** (`mpxruqpmwtxakrtobndx`) | ✅ pré-existante | ✅ créée le 2026-06-11 | ✅ étendu |
| **Preview** (`mtucieghovawtailfony`) | ✅ créée par moi le 2026-06-11 (migration 012 jamais appliquée auparavant) | ✅ créée le 2026-06-11 | ✅ étendu |

Migrations appliquées via MCP Supabase, donc enregistrées dans le tracker.

---

## 🔑 Variables d'environnement Vercel

Ajoutées par Théo le 2026-06-11 (Preview + Production) :

| Variable | Visibilité | Rôle |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client | `PushManager.subscribe({ applicationServerKey })` |
| `VAPID_PRIVATE_KEY` | Serveur only | Signe chaque push envoyé via `web-push` |
| `VAPID_SUBJECT` | Serveur | `mailto:theo@gouman.fr` |

`CRON_SECRET` (déjà en place pour `/api/cron/send-dm-emails`) sert aussi
à protéger `/api/push/send`.

---

## ⚠️ Dette technique identifiée

### 1. Drift massif entre `supabase/migrations/` et le tracker

**État au 2026-06-11** :

| Env | Migrations trackées | Tables réelles | Δ |
|---|---|---|---|
| **Prod** | 19 entries | 30 tables | ~16 migrations appliquées via SQL direct hors tracker |
| **Preview** | 16 entries | 24 tables | ~12 migrations appliquées hors tracker |

**Conséquence** : un `supabase db push` rejoue des migrations sur des tables qui existent déjà → erreurs si elles n'ont pas `IF NOT EXISTS`. C'est ce qui a fait apparaître les bugs de cette session (Nathan FK, doublon `031_`).

**Action recommandée (PR dédiée, hors scope du chantier PWA)** :

- Auditer les 30 tables de Prod, identifier quelle migration a créé chacune.
- Re-générer le tracker `supabase_migrations.schema_migrations` pour refléter l'état réel.
- Aligner Preview sur Prod (appliquer les migrations manquantes, sans rejouer les déjà-appliquées).
- Mettre en place un workflow CI qui empêche les `CREATE TABLE` sans `IF NOT EXISTS` dans les futures migrations.

### 2. Conflits de version dans `supabase/migrations/` — résolus

| Migration | Souci | Fix appliqué |
|---|---|---|
| `025_profiles_same_org_visibility.sql` | `INSERT VALUES` en dur sur l'UUID Nathan, FK explose si l'auth user absent | Bascule en `INSERT … SELECT … WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = …)` |
| `031_avatars_storage_limit_25mb.sql` | Même clé `031_` que `031_ressources_schema.sql` → violation PK 23505 sur le tracker | Renommée en `037_avatars_storage_limit_25mb.sql` (slot libre après 036) |
| `notificationSettingsUpdateSchema` | `.max(15)` et `.max(3)` en dur, dépassés par l'ajout du 4ᵉ canal | Remplacés par `NOTIFICATION_CATEGORIES.length * NOTIFICATION_CHANNELS.length` et `NOTIFICATION_CHANNELS.length` |

### 3. Lockfile `package-lock.json` mal aligné

Sur main, `package.json` contient `"border-beam": "^1.2.0"` mais le lockfile ne la liste pas. Vercel build passe parce qu'il fait `npm install` (pas `npm ci`), mais c'est fragile. À nettoyer dans une PR de maintenance.

### 4. Per-category × push : pas encore branché sur l'envoi

La matrice 5 catégories × 4 canaux persiste bien les préférences en DB
(notification_preferences) mais aucun caller ne consulte ces lignes
pour filtrer les envois. À brancher quand on câblera les rappels coaching,
nouveaux modules, etc.

### 5. Side-effect : push notifications désactivées si VAPID absent

Côté client, `getClientVapidPublicKey()` renvoie `null` si la variable
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` n'est pas définie. Le toggle Push affiche
alors un toast d'erreur explicite au clic au lieu de crasher. Mais le
toggle reste cliquable visuellement — futur enhancement : le griser
proactivement (cf. `usePushSubscription` retourne `support.supported = false`).

---

## ✅ Checklist front/back pour shipper

### Côté back (Théo)

- [x] Générer les VAPID keys (`npx web-push generate-vapid-keys`)
- [x] Ajouter les 3 env vars à Vercel (Preview + Production)
- [x] Migration `036_push_subscriptions` appliquée sur Prod (via MCP)
- [x] Migration `012_channel_preferences` + `036_push_subscriptions` appliquées sur Preview (via MCP)
- [ ] Merger PR #148 (en attente que le build Vercel passe avec les 3 derniers fix : Nathan WHERE EXISTS, 031 → 037, max() paramétriques)

### Côté front (Théo, après merge)

- [ ] **Désinstaller + réinstaller la PWA sur iPhone** (Safari cache le viewport meta + status-bar-style à l'install)
- [ ] Vérifier le frosted glass haut de page (mobile)
- [ ] Vérifier le toggle Push dans Réglages → Notifications : popup permission iOS, souscription créée
- [ ] Tester l'envoi end-to-end via curl :
  ```bash
  curl -X POST https://app.notionclub.fr/api/push/send \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"userId":"<ton-uuid>","title":"Test","body":"Ça marche !","url":"/dashboard"}'
  ```
- [ ] Vérifier la réception sur l'écran de verrouillage iPhone + clic ouvre la PWA sur l'URL fournie

---

## 🧠 Pour une prochaine session — points de reprise

### Si tu reprends pour avancer

1. **Lire ce document** en entier avant de toucher au code PWA.
2. **Toujours vérifier l'état du tracker Supabase** via MCP `list_migrations` avant d'appliquer une migration — le drift est encore là.
3. **Sur iOS PWA** : `PushManager.subscribe()` ne peut être appelé que depuis un user gesture. Ne jamais le mettre dans un `useEffect` au mount.
4. **`safe-area-inset-top`** vaut ~44px en standalone (status bar transparente) et 0 en Safari classique — design défensif obligatoire pour tout layout fixed en haut.
5. **`backdrop-filter: blur`** : l'élément doit avoir un `z-index` strictement entre le contenu de page (qui doit être flou) et l'UI qui doit rester nette (boutons, etc.).

### Si tu reprends pour debugger

1. **Erreur push côté client** : vérifier `getClientVapidPublicKey()` → `null` = manque env var.
2. **Notification reçue mais sans navigation** : payload manque `data.url`, le SW retombe sur `/dashboard`.
3. **Souscription disparaît silencieusement** : `expired_at` non-null en DB → 404/410 remonté par le push service au précédent envoi (PWA désinstallée, permission révoquée).
4. **Toggle Push grisé / erreur "no_vapid_key"** : env vars pas propagées sur le preview testé, ou serveur pas re-build après ajout des vars.

### Si tu reprends pour étendre

- Filtrer les envois par catégorie : lire `notification_preferences` dans `sendWebPushToUser` avant l'envoi.
- UI admin de broadcast : nouvelle route `/api/push/broadcast` qui itère sur tous les users actifs.
- Badge sur l'icône d'app : non supporté en PWA iOS (uniquement Android Chrome via `navigator.setAppBadge`).
- Re-subscription silencieuse au launch : déjà supportée côté hook (`existing ?? subscribe`), mais pas de retry périodique si l'utilisateur ne lance pas la PWA pendant > 30 jours (TTL iOS).

---

## 📂 Inventaire complet des fichiers touchés par le chantier PWA

```
.env.example                                                  ← +3 VAPID env vars
package.json, package-lock.json                               ← +web-push, +@types/web-push
next.config.ts                                                ← inchangé depuis #62

public/
├── sw.js                                                     ← SW avec push handlers, version v1
└── icons/                                                    ← 4 PNG (180, 192, 512, 512 maskable)
    ├── apple-touch-icon.png
    ├── icon-192.png
    ├── icon-512.png
    └── icon-512-maskable.png

src/
├── app/
│   ├── api/push/                                             ← NEW
│   │   ├── subscribe/route.ts
│   │   ├── unsubscribe/route.ts
│   │   └── send/route.ts
│   ├── globals.css                                           ← .nc-page-halo padding-top safe-area, grid 4 cols
│   ├── layout.tsx                                            ← metadata PWA, viewport, GradualBlurOverlay top, SW registrar
│   └── manifest.ts                                           ← display:standalone, scope:/, 4 icônes
├── modules/settings/lib/validation.ts                        ← NOTIFICATION_CHANNELS +'push', .max() paramétriques
├── shared/
│   ├── components/
│   │   ├── GradualBlurOverlay.tsx                            ← prop anchor: "top"|"bottom"
│   │   ├── pwa/ServiceWorkerRegistrar.tsx                    ← client component, prod only
│   │   ├── dashboard/mobile/
│   │   │   ├── BottomNav.tsx                                 ← bottom: calc(10px + env(safe-area-inset-bottom))
│   │   │   └── MobileTopActions.tsx                          ← top: calc(12px + env(safe-area-inset-top))
│   │   └── settings/NotificationsSection.tsx                 ← 4ᵉ colonne Push, hook au click
│   └── lib/
│       ├── hooks/usePushSubscription.ts                      ← NEW client hook
│       └── push/                                             ← NEW server lib
│           ├── types.ts
│           ├── vapid.ts
│           └── webPush.ts

supabase/migrations/
├── 025_profiles_same_org_visibility.sql                      ← Nathan backfill en WHERE EXISTS
├── 036_push_subscriptions.sql                                ← NEW
└── 037_avatars_storage_limit_25mb.sql                        ← renamed de 031_ (conflit version)

docs/pwa/
└── README.md                                                 ← ce fichier
```

---

## 🔗 Liens utiles

- [PR #148 — Web Push notifications](https://github.com/Notion-Club/Infrastructure/pull/148)
- [Apple — Web Push for Web Apps on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [W3C — Push API spec](https://www.w3.org/TR/push-api/)
- [`web-push` lib docs](https://github.com/web-push-libs/web-push)
- [Supabase RLS Auth UID best practices](https://supabase.com/docs/guides/database/postgres/row-level-security#using-auth-uid-in-policies)
