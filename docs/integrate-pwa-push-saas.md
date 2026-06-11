# Intégrer une PWA installable + notifications Web Push à un SaaS

> Guide d'implémentation portable, extrait du chantier PWA de Notion Club (8 PR
> entre #62 et #152). Objectif : permettre à une équipe produit/dev d'embarquer
> sur ce système sans avoir à reconstituer le contexte à la main.
>
> Stack de référence : **Next.js 15+ (App Router) + Supabase + Vercel + iOS
> Safari 16.4+**. La plupart des patterns sont stack-agnostiques — les sections
> spécifiques à Next/Supabase/Vercel sont signalées 🔧.

---

## Table des matières

1. [Ce que tu obtiens à la fin](#1-ce-que-tu-obtiens-à-la-fin)
2. [Stack de référence et pré-requis](#2-stack-de-référence-et-pré-requis)
3. [Architecture en 1 schéma](#3-architecture-en-1-schéma)
4. [Étape 1 — Manifest PWA + icônes](#étape-1--manifest-pwa--icônes)
5. [Étape 2 — Métadonnées iOS et edge-to-edge](#étape-2--métadonnées-ios-et-edge-to-edge)
6. [Étape 3 — Service Worker](#étape-3--service-worker)
7. [Étape 4 — Génération des clés VAPID](#étape-4--génération-des-clés-vapid)
8. [Étape 5 — Schéma DB (push_subscriptions)](#étape-5--schéma-db-push_subscriptions)
9. [Étape 6 — Module serveur web-push](#étape-6--module-serveur-web-push)
10. [Étape 7 — Routes API (subscribe / unsubscribe / send)](#étape-7--routes-api)
11. [Étape 8 — Hook client + UI toggle](#étape-8--hook-client--ui-toggle)
12. [Étape 9 — Test end-to-end](#étape-9--test-end-to-end)
13. [Pitfalls et erreurs courantes](#pitfalls-et-erreurs-courantes)
14. [Pour aller plus loin](#pour-aller-plus-loin)

---

## 1. Ce que tu obtiens à la fin

- Une PWA installable depuis Safari (iOS) et Chrome/Edge/Firefox (Android/desktop) :
  l'utilisateur peut « Ajouter à l'écran d'accueil » et lancer l'app en plein écran,
  sans le chrome du navigateur.
- Sur iOS, immersion edge-to-edge : status bar translucide, contenu qui passe
  sous le notch sans saut, gestion du `safe-area-inset-*`.
- Auto-zoom iOS désactivé sur le focus des inputs (le pattern qui zoome
  l'écran quand on tape dans un champ < 16px).
- Notifications Web Push :
  - L'utilisateur active/désactive depuis ses réglages.
  - Le serveur envoie une notif via une route protégée (cron / webhook /
    panel admin).
  - Sur iOS, la notif arrive sur l'écran de verrouillage et tap → ouvre la
    PWA à l'URL voulue.
- Gestion automatique des souscriptions périmées (PWA désinstallée, permission
  révoquée) sans purge manuelle.

---

## 2. Stack de référence et pré-requis

### Stack
- **Next.js 15 ou 16** — App Router, Server Components, Server Actions, Route Handlers.
- **Supabase** — auth + Postgres + RLS. Le pattern marche identiquement avec
  Prisma + n'importe quel Postgres ; il faut juste adapter les requêtes.
- **Vercel** (ou tout host qui supporte le SSR Next.js).
- **iOS Safari 16.4+** côté client pour le push (sinon : Chrome, Firefox, Edge,
  Safari macOS 16.1+).

### Pré-requis techniques
- HTTPS obligatoire (le SW et le push ne fonctionnent pas en HTTP, sauf `localhost`).
- Un domaine custom configuré sur la prod (`https://app.tonsaas.com`) pour
  que les utilisateurs puissent installer la PWA proprement.
- Node 20+ pour générer les clés VAPID via `npx web-push`.

### Dépendances à ajouter

```bash
npm install web-push
npm install -D @types/web-push
```

C'est la seule dépendance runtime nécessaire. Pas besoin de `next-pwa`, `workbox`,
ou autre lib lourde — Next.js gère le manifest natif et un SW custom suffit.

---

## 3. Architecture en 1 schéma

```
┌─────────────────────────────────────────────────────────────────────┐
│                          NAVIGATEUR / iOS                            │
│                                                                      │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │  Page React     │    │  Hook            │    │  Service       │  │
│  │  (Settings UI)  │───▶│  usePush         │───▶│  Worker        │  │
│  │   toggle        │    │  Subscription    │    │  (sw.js)       │  │
│  └─────────────────┘    └──────────────────┘    └────────────────┘  │
│                                  │                       ▲           │
│                                  ▼                       │           │
└──────────────────────────────────┼───────────────────────┼──────────┘
                                   │ POST /subscribe       │ push event
                                   │                       │ depuis APNs/FCM
┌──────────────────────────────────┼───────────────────────┼──────────┐
│                          SERVEUR / VERCEL                            │
│                                  ▼                       │           │
│  ┌────────────────────────────────────┐                  │           │
│  │  Route /api/push/subscribe         │                  │           │
│  │  Upsert dans DB                    │                  │           │
│  └──────────┬─────────────────────────┘                  │           │
│             ▼                                            │           │
│  ┌──────────────────────────┐    ┌────────────────────────────────┐ │
│  │  Table push_subscriptions │    │  sendWebPushToUser(userId, p)  │ │
│  │  (user_id, endpoint, keys)│◄───┤  Boucle souscriptions actives  │ │
│  └──────────────────────────┘    │  + web-push.sendNotification   │─┘
│             ▲                    └────────────────────────────────┘  │
│             │                                  ▲                     │
│  ┌──────────┴──────────┐         ┌─────────────┴──────────────┐     │
│  │  Cron Vercel        │         │  Route /api/push/send      │     │
│  │  Webhook tiers      │────────▶│  Bearer $CRON_SECRET       │     │
│  │  Server Action admin│         └────────────────────────────┘     │
│  └─────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────┘
```

Trois cycles distincts :

1. **Souscription** : user clique toggle → hook demande permission au browser →
   PushSubscription créée par le navigateur → POST sur ton API → ligne DB.
2. **Envoi** : un caller serveur (cron, webhook, action admin) appelle
   `sendWebPushToUser(userId, payload)` → lit les souscriptions actives → signe
   le payload avec VAPID → push envoyé à APNs (iOS) / FCM (Chrome) / Mozilla Push.
3. **Réception** : APNs/FCM réveille le SW → handler `push` → `showNotification`
   → user tape la notif → handler `notificationclick` → ouvre la PWA à l'URL.

---

## Étape 1 — Manifest PWA + icônes

### `public/manifest.webmanifest` (ou `src/app/manifest.ts` avec Next.js 🔧)

```ts
// src/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ton SaaS",
    short_name: "Ton SaaS",
    description: "Description courte",
    start_url: "/dashboard",     // page d'accueil après install
    scope: "/",
    display: "standalone",        // critique : retire le chrome navigateur
    orientation: "portrait",
    background_color: "#ffffff",  // splash screen au lancement
    theme_color: "#ffffff",       // status bar Android
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

### Icônes à générer

À partir de ton logo carré (idéalement ≥ 1024×1024) :

| Fichier | Taille | Usage |
|---|---|---|
| `apple-touch-icon.png` | 180×180 | iOS home screen icon |
| `icon-192.png` | 192×192 | Android home screen |
| `icon-512.png` | 512×512 | Android splash + manifest |
| `icon-512-maskable.png` | 512×512 | Android adaptive icons (logo dans une zone safe de 80% du rayon) |

⚠️ **Maskable** : Android peut découper l'icône en cercle / squircle / etc. Le
logo doit tenir dans un cercle inscrit (≈ zone safe centrale de 80%). Sinon il
sera coupé sur certains téléphones. Outil pratique : [Maskable.app](https://maskable.app/).

Tous les fichiers vont dans `public/icons/`.

---

## Étape 2 — Métadonnées iOS et edge-to-edge

### `src/app/layout.tsx` 🔧

```tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Ton SaaS",
  appleWebApp: {
    capable: true,
    title: "Ton SaaS",
    statusBarStyle: "black-translucent",  // status bar transparente, app dessous
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,           // ← désactive le pinch-zoom
  userScalable: false,       // ← désactive l'auto-zoom au focus input < 16px
  viewportFit: "cover",      // ← contenu s'étend sous le notch (safe-area utilisable)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#000000" },
  ],
};
```

### CSS — gérer le `safe-area-inset`

Quand `viewportFit: "cover"` est activé, le body s'étend sous la status bar et
le home indicator. Il faut compenser dans le layout :

```css
/* globals.css */
.app-shell {
  min-height: 100dvh;
  /* Pousse le contenu sous le notch */
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

/* Tout élément fixed haut (topbar mobile, etc.) doit aussi compenser */
.mobile-top-bar {
  position: fixed;
  top: 0;
  padding-top: env(safe-area-inset-top);
}

/* Tout élément fixed bas (bottom nav iPhone) */
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Désactiver l'auto-zoom iOS sur les inputs

Le `maximumScale: 1` + `userScalable: false` ci-dessus suffisent. Belt-and-suspenders :
forcer `font-size: 16px` minimum sur tous les `<input>` / `<select>` / `<textarea>`
— c'est le seuil en-dessous duquel iOS zoome.

```css
input, textarea, select { font-size: 16px; }
```

---

## Étape 3 — Service Worker

### `public/sw.js`

C'est un fichier statique, servi directement. **Ne pas** l'écrire en TypeScript
sauf à mettre en place un build dédié.

```js
// public/sw.js
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const HTML_CACHE = `html-${VERSION}`;

// Routes à laisser passer (pas de cache, network only)
const NETWORK_ONLY_PREFIXES = ["/api/", "/auth/"];

// ── Lifecycle ────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Purge les vieux caches versionnés
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// ── Fetch — stratégies ───────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API / auth → pass-through (jamais de cache)
  if (NETWORK_ONLY_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    return;
  }

  // 2. Assets Next (_next/static, fonts, images icons) → cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 3. Navigation HTML → network-first (toujours essayer le réseau, fallback cache)
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, HTML_CACHE));
    return;
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Offline");
  }
}

// ── Push handler ─────────────────────────────────────────────────────────
// CRITIQUE : iOS Safari 16.4+ exige que ce handler soit déclaré AVANT
// que pushManager.subscribe() soit appelé. Sinon la souscription échoue
// silencieusement.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data?.text() ?? "Notification" };
  }

  const title = payload.title || "Notification";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag,
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click handler ───────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window" });
      // Si la PWA est déjà ouverte, on focus et on navigue
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })(),
  );
});
```

### Enregistrer le SW côté client

```tsx
// src/shared/components/ServiceWorkerRegistrar.tsx
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Only in prod (en dev, le SW peut gêner le HMR)
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.error("[sw] registration failed", err));
  }, []);

  return null;
}
```

Monter ce composant dans le layout racine :

```tsx
// src/app/layout.tsx
import { ServiceWorkerRegistrar } from "@/shared/components/ServiceWorkerRegistrar";

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
```

---

## Étape 4 — Génération des clés VAPID

VAPID (Voluntary Application Server Identification) — une paire de clés
cryptographiques qui prouvent au push service que c'est bien ton serveur qui
envoie. Sans elles, le navigateur refuse la souscription.

### Générer une seule fois

```bash
npx web-push generate-vapid-keys
```

Sortie :

```
Public Key:
BLab1234... (88 caractères, base64url)

Private Key:
abc123... (43 caractères, base64url)
```

### Ajouter aux variables d'environnement (Vercel 🔧)

Settings → Environment Variables (cocher Preview + Production) :

| Variable | Visibilité | Rôle |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client | Lue par le navigateur dans `pushManager.subscribe({ applicationServerKey })` |
| `VAPID_PRIVATE_KEY` | Serveur seul | Signe chaque push envoyé via `web-push` |
| `VAPID_SUBJECT` | Serveur seul | `mailto:contact@tonsaas.com` — utilisé pour t'identifier auprès du push service |

⚠️ **Ne PAS cocher Sensitive** sur Vercel pour `CRON_SECRET` si tu prévois de le
lire un jour via `vercel env pull` (Sensitive = la valeur n'est plus jamais
lisible après création).

### `.env.example`

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:contact@tonsaas.com
CRON_SECRET=
```

---

## Étape 5 — Schéma DB (push_subscriptions)

### Migration SQL (Postgres / Supabase 🔧)

```sql
-- migrations/XXX_push_subscriptions.sql
create extension if not exists "pgcrypto";

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null unique,        -- l'URL APNs/FCM unique par device
  p256dh        text not null,               -- clé publique du browser
  auth          text not null,               -- secret partagé pour le chiffrement
  user_agent    text,                        -- pour debug / stats device
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expired_at    timestamptz                  -- non null = souscription morte (404/410)
);

-- Index partiel pour lookups serveur rapides
create index if not exists push_subscriptions_active_idx
  on public.push_subscriptions (user_id)
  where expired_at is null;

-- ── RLS user-scoped ──────────────────────────────────────────────────────
alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_self
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscriptions_insert_self
  on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy push_subscriptions_update_self
  on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_subscriptions_delete_self
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
```

L'envoi server-side bypasse RLS via le `service_role` client (cf. étape 6).

---

## Étape 6 — Module serveur web-push

### Lecture VAPID

```ts
// src/lib/push/vapid.ts
type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function getServerVapidConfig(): VapidConfig {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:contact@tonsaas.com";
  if (!publicKey || !privateKey) {
    throw new Error("Web Push : VAPID keys manquantes (cf. .env.example).");
  }
  return { publicKey, privateKey, subject };
}

// Côté client — renvoie null si la var n'est pas définie pour que l'UI
// puisse désactiver le toggle proprement au lieu de crasher.
export function getClientVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}
```

### Types

```ts
// src/lib/push/types.ts
export type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

export type PushPayload = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: { url?: string; [k: string]: unknown };
};
```

### Helper d'envoi

```ts
// src/lib/push/webPush.ts
import webpush from "web-push";

import { createAdminClient } from "@/lib/db/admin"; // service_role bypass RLS
import { getServerVapidConfig } from "./vapid";
import type { PushPayload } from "./types";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const { publicKey, privateKey, subject } = getServerVapidConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export type SendPushResult = {
  sent: number;
  expired: number;
  failed: number;
  failures: Array<{ endpoint: string; error: string }>;
};

export async function sendWebPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<SendPushResult> {
  ensureVapidConfigured();
  const admin = createAdminClient();

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .is("expired_at", null);

  if (!subs || subs.length === 0) {
    return { sent: 0, expired: 0, failed: 0, failures: [] };
  }

  const result: SendPushResult = { sent: 0, expired: 0, failed: 0, failures: [] };
  const expiredIds: string[] = [];
  const seenIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        result.sent += 1;
        seenIds.push(sub.id);
      } catch (err) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        if (status === 404 || status === 410) {
          // Endpoint définitivement mort : PWA désinstallée ou permission révoquée
          expiredIds.push(sub.id);
          result.expired += 1;
        } else {
          result.failed += 1;
          result.failures.push({
            endpoint: sub.endpoint,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }),
  );

  if (expiredIds.length > 0) {
    await admin
      .from("push_subscriptions")
      .update({ expired_at: new Date().toISOString() })
      .in("id", expiredIds);
  }
  if (seenIds.length > 0) {
    await admin
      .from("push_subscriptions")
      .update({ last_seen_at: new Date().toISOString() })
      .in("id", seenIds);
  }

  return result;
}
```

---

## Étape 7 — Routes API

### `/api/push/subscribe` (POST, cookies user)

```ts
// src/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/db/server";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload invalide" }, { status: 400 });

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: request.headers.get("user-agent"),
      last_seen_at: new Date().toISOString(),
      expired_at: null,  // re-subscribe : on remet à null si elle était périmée
    },
    { onConflict: "endpoint" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

### `/api/push/unsubscribe` (POST, cookies user)

```ts
// src/app/api/push/unsubscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/db/server";

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Payload invalide" }, { status: 400 });

  // RLS impose user_id = auth.uid() — pas besoin de re-vérifier
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
```

### `/api/push/send` (POST, Bearer CRON_SECRET)

Pour usage machine-to-machine (cron Vercel, webhook tiers, script admin).

```ts
// src/app/api/push/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendWebPushToUser } from "@/lib/push/webPush";

const sendSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().max(400).optional(),
  url: z.string().url().optional(),
  tag: z.string().max(80).optional(),
});

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  const result = await sendWebPushToUser(parsed.data.userId, {
    title: parsed.data.title,
    body: parsed.data.body,
    tag: parsed.data.tag,
    data: parsed.data.url ? { url: parsed.data.url } : undefined,
  });

  return NextResponse.json(result);
}
```

---

## Étape 8 — Hook client + UI toggle

### Hook `usePushSubscription`

```ts
// src/lib/hooks/usePushSubscription.ts
"use client";

import { useEffect, useState } from "react";
import { getClientVapidPublicKey } from "@/lib/push/vapid";

type Support =
  | { supported: true }
  | { supported: false; reason: "no_browser_api" | "no_vapid_key" };

type Status = "idle" | "subscribing" | "unsubscribing";

export function usePushSubscription() {
  const [support, setSupport] = useState<Support>({ supported: true });
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    (async () => {
      // 1. Détection support
      if (typeof window === "undefined") return;
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setSupport({ supported: false, reason: "no_browser_api" });
        return;
      }
      if (!getClientVapidPublicKey()) {
        setSupport({ supported: false, reason: "no_vapid_key" });
        return;
      }

      // 2. Lecture état initial
      setPermission(Notification.permission);
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(!!existing);
    })();
  }, []);

  async function subscribe() {
    if (!support.supported) return { ok: false, message: "Notifications non supportées." };

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") {
      return { ok: false, message: "Permission refusée." };
    }

    setStatus("subscribing");
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(getClientVapidPublicKey()!),
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        // Rollback côté browser pour éviter un fantôme device-side
        await sub.unsubscribe().catch(() => {});
        setStatus("idle");
        return { ok: false, message: "Erreur serveur." };
      }
      setSubscribed(true);
      setStatus("idle");
      return { ok: true };
    } catch (err) {
      setStatus("idle");
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async function unsubscribe() {
    setStatus("unsubscribing");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setStatus("idle");
      return { ok: true };
    } catch (err) {
      setStatus("idle");
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  return { support, permission, subscribed, status, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}
```

### UI : toggle dans les Settings

```tsx
"use client";

import { usePushSubscription } from "@/lib/hooks/usePushSubscription";

export function PushToggle() {
  const { support, subscribed, status, subscribe, unsubscribe } = usePushSubscription();

  if (!support.supported) {
    return (
      <p style={{ color: "var(--text-muted)" }}>
        {support.reason === "no_vapid_key"
          ? "Notifications désactivées (config serveur)."
          : "Ton navigateur ne supporte pas les notifications push."}
      </p>
    );
  }

  async function handleClick() {
    const result = subscribed ? await unsubscribe() : await subscribe();
    if (!result.ok) alert(result.message);  // remplace par ton système de toast
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status !== "idle"}
    >
      {subscribed ? "Désactiver les notifications" : "Activer les notifications"}
    </button>
  );
}
```

⚠️ **Critique iOS** : `subscribe()` ne peut être appelé que depuis un **user gesture**
(clic explicite). Ne JAMAIS le mettre dans un `useEffect` au mount — la souscription
échoue silencieusement.

---

## Étape 9 — Test end-to-end

### Sur iPhone (iOS 16.4+)

1. Ouvrir `https://app.tonsaas.com` dans Safari (HTTPS obligatoire).
2. Tap sur le bouton Partager → « Sur l'écran d'accueil » → confirmer.
3. **Fermer Safari**, lancer la PWA depuis l'icône de l'écran d'accueil.
4. Naviguer vers la page Réglages → tap sur « Activer les notifications ».
5. Accepter la popup permission iOS.
6. Vérifier en DB qu'une ligne est créée dans `push_subscriptions`.

### Envoi de test

```bash
curl -X POST 'https://app.tonsaas.com/api/push/send' \
  -H 'Authorization: Bearer TON_CRON_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "UUID_DE_TON_USER",
    "title": "🎉 Première notif",
    "body": "Tout fonctionne !",
    "url": "https://app.tonsaas.com/dashboard"
  }'
```

Réponse attendue : `{"sent":1,"expired":0,"failed":0,"failures":[]}`.

La notif arrive sur l'écran de verrouillage dans 1-5 secondes. Tap dessus → la
PWA s'ouvre sur l'URL passée.

---

## Pitfalls et erreurs courantes

### 1. Sur iOS, la souscription échoue silencieusement

**Symptôme** : `pushManager.subscribe()` throw `AbortError` ou résout avec une
souscription qui ne reçoit jamais de push.

**Causes** :
- La PWA n'est pas installée sur l'écran d'accueil. iOS Web Push N'EST PAS
  supporté en Safari classique, **uniquement** en PWA standalone.
- Le handler `push` du SW n'est pas déclaré. iOS vérifie au moment du
  `subscribe()` qu'il y a un listener.
- Le `subscribe()` est appelé hors d'un user gesture (useEffect au mount).
- Le `manifest.webmanifest` n'est pas chargé ou est invalide.

### 2. L'URL `url` dans le payload n'est pas absolue

**Symptôme** : `/api/push/send` renvoie `{"error":"Payload invalide"}`.

**Cause** : la validation `z.string().url()` exige `https://…`, pas `/dashboard`.

**Fix** : côté client, préfixer avec `window.location.origin` avant POST.

### 3. CRON_SECRET marquée "Sensitive" sur Vercel

**Symptôme** : impossible de la relire via `vercel env pull`, et la valeur a été
perdue.

**Fix** : ne JAMAIS marquer "Sensitive" un secret que tu veux pouvoir lire un
jour. Pour les secrets vraiment critiques (privées VAPID), Sensitive est OK
parce que le serveur les lit via `process.env` au runtime. Pour le `CRON_SECRET`
que tu vas utiliser en curl, garde-le non-Sensitive ou stocke-le dans un
password manager dès la création.

### 4. Push arrive mais le tap ne navigue pas

**Symptôme** : la notif s'affiche, mais cliquer dessus ouvre la PWA à `/` au
lieu de l'URL voulue.

**Cause** : le payload n'a pas `data.url` (champ imbriqué, pas champ racine).

**Fix** : côté serveur, passer `data: { url: "..." }`, pas `url: "..."` directement.

### 5. Plusieurs souscriptions par user

**Symptôme** : un user reçoit la même notif plusieurs fois.

**Cause normale** : l'user a installé la PWA sur plusieurs devices (iPhone +
desktop). Chaque device a son `endpoint` unique → c'est OK.

**Cause anormale** : tu fais des `insert` au lieu d'`upsert` sur `endpoint`,
créant des doublons à chaque re-subscribe.

**Fix** : `.upsert({ ... }, { onConflict: "endpoint" })`.

### 6. Migration drift entre l'environnement de dev et la prod

**Symptôme** : `supabase db push` échoue avec PK violation ou table déjà existante.

**Fix** : toujours `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`
dans les migrations. Idempotence = re-jouable sans casser.

### 7. Le SW garde une version cachée après update

**Symptôme** : tu déploies du code, mais la PWA continue d'utiliser l'ancien.

**Fix** : bumper la constante `VERSION` dans `sw.js`. Le handler `activate`
purge les anciens caches. Pour forcer le refresh côté user : `chrome://serviceworker-internals`
sur Chrome, ou désinstaller/réinstaller la PWA sur iOS.

### 8. iOS auto-zoome au focus d'un input

**Symptôme** : taper dans un champ déclenche un zoom plein écran iOS.

**Fix** : combiner `viewport.maximumScale: 1` + `userScalable: false` + forcer
`font-size: 16px` minimum sur tous les inputs.

---

## Pour aller plus loin

### Filtrer les envois selon les préférences user

Tu peux ajouter une table `notification_preferences (user_id, category, channel, enabled)`
pour permettre aux users d'opt-out par catégorie (rappels / messages / facturation / …).

Dans `sendWebPushToUser`, lire cette table avant d'envoyer et skip si
`enabled = false` pour la catégorie en question.

### Convention iOS pour les notifs messaging

iOS impose d'afficher le `manifest.name` en seconde ligne sous le titre
(anti-phishing, non masquable). Pattern recommandé :

- **Title** = expéditeur ou source (« Marie Dupont », « Nouveau commentaire »,
  « Call demain avec Tom »)
- **Body** = contenu (preview du message)
- **Sous-titre** = ton app name (figé)

C'est exactement comme iMessage / WhatsApp / Slack.

### Dev tool admin pour envoyer depuis l'UI

Pour tester sans toucher au `CRON_SECRET`, ajouter une Server Action
`sendAdminPushAction` qui :
1. Vérifie `auth.uid()` + `profiles.role === 'admin'`
2. Appelle `sendWebPushToUser` directement (pas via la route HTTP)
3. Retourne `{ sent, expired, failed }` au composant client

Permet à un admin de tester n'importe quelle notif depuis un panneau dans
l'interface, sans devoir générer / sauvegarder un secret HTTP.

### Cron Vercel pour les rappels périodiques

```ts
// src/app/api/cron/daily-reminders/route.ts
import { NextResponse } from "next/server";
import { sendWebPushToUser } from "@/lib/push/webPush";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // Logique métier : lister les users à notifier
  const usersToNotify = await getUsersWithReminderToday();

  let total = 0;
  for (const u of usersToNotify) {
    const r = await sendWebPushToUser(u.id, {
      title: "Rappel quotidien",
      body: `${u.firstName}, ton check-in du jour t'attend.`,
      data: { url: `/check-in/${u.id}` },
    });
    total += r.sent;
  }

  return NextResponse.json({ notified: total });
}
```

Et dans `vercel.json` :

```json
{
  "crons": [
    { "path": "/api/cron/daily-reminders", "schedule": "0 9 * * *" }
  ]
}
```

### Multi-device avec dédoublonnage logique

Un user qui a la PWA sur iPhone + sur desktop reçoit la notif sur les deux. Si
tu veux que ce soit dismissé partout dès qu'il la lit sur un device, utilise le
champ `tag` + écris côté SW :

```js
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Ferme aussi les notifs avec le même tag sur les autres devices :
  // pas possible directement via le browser, mais tu peux émettre un
  // event "marked_read" depuis le client qui re-push une notif vide avec
  // le même tag → remplace l'ancienne (showNotification avec un tag
  // existant écrase la précédente).
});
```

### Plus de détails par OS

- [Apple — Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [W3C — Push API spec](https://www.w3.org/TR/push-api/)
- [`web-push` lib docs](https://github.com/web-push-libs/web-push)
- [MDN — Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN — Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

---

## Récap : checklist d'implémentation

À cocher dans l'ordre :

- [ ] `manifest.webmanifest` (ou `manifest.ts` Next.js) + 4 icônes dans `public/icons/`
- [ ] Métadonnées iOS dans `layout.tsx` (apple-mobile-web-app-capable, status-bar-style black-translucent, viewport fit cover, maximumScale 1)
- [ ] CSS `safe-area-inset-*` sur les éléments fixed
- [ ] `font-size: 16px` minimum sur les inputs
- [ ] `public/sw.js` avec handlers `push` et `notificationclick`
- [ ] `<ServiceWorkerRegistrar />` monté dans le layout racine
- [ ] `npx web-push generate-vapid-keys` exécuté une fois
- [ ] 3 env vars VAPID + `CRON_SECRET` ajoutés sur Vercel (Preview + Production)
- [ ] Migration SQL `push_subscriptions` appliquée
- [ ] Lib `vapid.ts`, `types.ts`, `webPush.ts`
- [ ] Routes `/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/send`
- [ ] Hook `usePushSubscription` + composant `<PushToggle />`
- [ ] Test : installer la PWA sur iPhone + activer toggle + curl `/api/push/send` → réception confirmée

Une fois tout coché, ton SaaS a la même brique « comme une vraie app » que les
gros (Linear, Notion, Vercel) — sans App Store, sans dépendance lourde, en
quelques jours de travail.
