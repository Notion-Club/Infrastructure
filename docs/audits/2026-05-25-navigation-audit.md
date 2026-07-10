# Audit — Navigation, loading states & transitions

> 🗄️ **ARCHIVE — snapshot du 2026-05-25, plusieurs constats depuis résolus.**
> Ne décrit PAS l'état courant. Exemples corrigés depuis : des `loading.tsx`
> existent désormais dans plusieurs routes ; `BottomNav` utilise `<Link>` (plus
> `<a>` natif) ; l'arbre des routes a changé (`(shell)`, `membres/`,
> `communaute/{feed,messages}`). Conservé pour la trace du raisonnement.

**Date :** 2026-05-25
**Scope :** `src/app/` (App Router), composants de navigation, config Next.js, globals.css
**Auteur :** Claude Code (audit statique, aucune modification de code)

---

## Section 1 — Cartographie des routes

### 1.1 Arbre complet `src/app/`

```
src/app/
├── layout.tsx                               ← Root layout (Server Component)
├── page.tsx                                 ← redirect → /login
├── globals.css
├── manifest.ts
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── reset-password/page.tsx
│   └── update-password/page.tsx
├── (app)/
│   ├── layout.tsx                           ← AppLayout (async Server Component)
│   ├── dashboard/page.tsx
│   ├── formation/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── [programSlug]/page.tsx
│   │   └── [programSlug]/[moduleSlug]/[lessonSlug]/page.tsx
│   ├── communaute/
│   │   ├── page.tsx
│   │   ├── CommunityPageClient.tsx
│   │   └── post/[id]/
│   │       ├── page.tsx
│   │       └── PostDetailClient.tsx
│   ├── ressources/
│   │   ├── page.tsx
│   │   ├── ressource/[slug]/page.tsx
│   │   └── template/[slug]/page.tsx
│   ├── coaching/page.tsx
│   └── settings/
│       ├── page.tsx
│       └── SettingsClient.tsx
└── api/
    ├── auth/callback/route.ts
    ├── feedback/route.ts
    ├── feedback-schema/route.ts
    ├── tickets/route.ts
    ├── verify-email/route.ts
    ├── payments/me/route.ts
    └── formation/sync/route.ts
```

### 1.2 Tableau par page

| Route | Chemin fichier | `"use client"` | `async` | `loading.tsx` (niveau ou parent) | `error.tsx` | `await` directs | `<Suspense>` |
|---|---|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | ❌ | ❌ | ❌ aucun | ❌ aucun | `redirect("/login")` | ❌ |
| `/login` | `src/app/(auth)/login/page.tsx` | ❌ | ❌ | ❌ aucun | ❌ aucun | Aucun | ✅ `fallback={null}` autour de `<AuthMockup>` |
| `/signup` | `src/app/(auth)/signup/page.tsx` | ❌ | ❌ | ❌ aucun | ❌ aucun | Aucun | ✅ `fallback={null}` autour de `<AuthMockup>` |
| `/reset-password` | `src/app/(auth)/reset-password/page.tsx` | ❌ | ❌ | ❌ aucun | ❌ aucun | Aucun | ❌ |
| `/update-password` | `src/app/(auth)/update-password/page.tsx` | ❌ | ❌ | ❌ aucun | ❌ aucun | Aucun | ✅ `fallback={null}` autour de `<UpdatePasswordForm>` |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | ❌ | ✅ | ❌ aucun | ❌ aucun | `getGreetingFirstName()` → 2 awaits Supabase internes | ✅ `fallback={null}` autour de `<EmailVerifiedToast>` |
| `/formation` | `src/app/(app)/formation/page.tsx` | ❌ | ✅ | ❌ aucun | ❌ aucun | `getAccessiblePrograms()` | ❌ |
| `/formation/[programSlug]` | `src/app/(app)/formation/[programSlug]/page.tsx` | ❌ | ✅ | ❌ aucun | ❌ aucun | `getProgramDetail()` + `redirect()` | ❌ |
| `/formation/[programSlug]/[moduleSlug]/[lessonSlug]` | `src/app/(app)/formation/[programSlug]/[moduleSlug]/[lessonSlug]/page.tsx` | ❌ | ✅ | ❌ aucun | ❌ aucun | `Promise.all([fetchLessonContent(), touchCourseAccess()])` | ❌ |
| `/communaute` | `src/app/(app)/communaute/page.tsx` | ❌ | ❌ | ❌ aucun | ❌ aucun | Aucun (délègue au client) | ✅ `fallback={null}` autour de `<CommunityPageClient>` |
| `/communaute/post/[id]` | `src/app/(app)/communaute/post/[id]/page.tsx` | ❌ | ✅ | ❌ aucun | ❌ aucun | Lookup synchrone mock | ❌ |
| `/ressources` | `src/app/(app)/ressources/page.tsx` | ❌ | ✅ | ❌ aucun | ❌ aucun | `getAllResourceItems()` | ✅ `fallback={null}` autour de `<ResourcesGrid>` |
| `/ressources/ressource/[slug]` | `src/app/(app)/ressources/ressource/[slug]/page.tsx` | ❌ | ✅ | ❌ aucun | ❌ aucun | `getResourceBySlug()` + `getRelatedResources()` séquentiels | ❌ |
| `/ressources/template/[slug]` | `src/app/(app)/ressources/template/[slug]/page.tsx` | ❌ | ✅ | ❌ aucun | ❌ aucun | `getTemplateBySlug()` + `getRelatedTemplates()` séquentiels | ❌ |
| `/coaching` | `src/app/(app)/coaching/page.tsx` | ✅ | ❌ | ❌ aucun | ❌ aucun | Aucun (tout client-side) | ❌ |
| `/settings` | `src/app/(app)/settings/page.tsx` | ❌ | ✅ | ❌ aucun | ❌ aucun | `getNotificationSettings()` | ❌ |

**Constats critiques :**

- **Aucun `loading.tsx` n'existe dans tout le projet** — ni à la racine de `(app)/`, ni dans aucune sous-route.

- **Aucun `error.tsx` n'existe dans tout le projet.**

- **Tous les `<Suspense>` utilisent `fallback={null}`** — ils existent uniquement pour satisfaire la contrainte de static prerendering de `useSearchParams`, pas pour afficher un état de chargement visible.

---

## Section 2 — Stratégie de data fetching

### 2.1 Routes les plus susceptibles d'être lentes

#### `/dashboard` — `src/app/(app)/dashboard/page.tsx`

```
AppLayout (src/app/(app)/layout.tsx)
  └── await supabase.auth.getUser()         ← round-trip 1
  └── await supabase.from("profiles")...    ← round-trip 2 (bloqué par RT1)
      └── DashboardPage
            └── getGreetingFirstName()
                  └── await supabase.auth.getUser()    ← round-trip 3 (dupliqué)
                  └── await supabase.from("profiles")  ← round-trip 4 (dupliqué)
```

**4 round-trips Supabase séquentiels pour afficher `/dashboard`.** Les rounds-trips 3 et 4 sont redondants avec ceux du layout parent — `getGreetingFirstName` recrée sa propre instance client et refait les mêmes appels.

#### `/formation/[programSlug]/[moduleSlug]/[lessonSlug]`

```
AppLayout → 2 round-trips séquentiels (voir ci-dessus)
  └── LessonPage
        └── Promise.all([fetchLessonContent(), touchCourseAccess()])  ← parallèle ✅
```

Bonne pratique locale, mais la waterfall du layout parent reste.

#### `/ressources/ressource/[slug]`

```
AppLayout → 2 round-trips séquentiels
  └── ResourceDetailPage
        └── await getResourceBySlug()      ← round-trip 3
        └── await getRelatedResources()    ← round-trip 4 (séquentiel, après RT3)
```

Les deux fetches de la page sont séquentiels alors qu'ils pourraient être parallélisés.

#### `/ressources/template/[slug]`

Même pattern : `getTemplateBySlug()` + `getRelatedTemplates()` séquentiels.

#### `/settings`

```
AppLayout → 2 round-trips séquentiels
  └── SettingsPage
        └── getNotificationSettings()
              └── Promise.all([notification_preferences, channel_preferences])  ← parallèle ✅
```

### 2.2 Tableau synthèse waterfalls

| Route | Fetches bloquants | Parallel ? | Waterfall ? |
|---|---|---|---|
| `(app)/layout.tsx` | `auth.getUser()` → `profiles.select()` | ❌ | ✅ **waterfall** |
| `dashboard/page.tsx` | `auth.getUser()` → `profiles.select()` (à l'intérieur de `getGreetingFirstName`) | ❌ | ✅ **waterfall + doublon layout** |
| `formation/page.tsx` | `getAccessiblePrograms()` | N/A | — |
| `formation/.../[lessonSlug]/page.tsx` | `fetchLessonContent()` + `touchCourseAccess()` | ✅ | ✅ résolu |
| `ressources/page.tsx` | `getAllResourceItems()` (lui-même `Promise.all` interne) | ✅ | ✅ résolu |
| `ressources/ressource/[slug]/page.tsx` | `getResourceBySlug()` → `getRelatedResources()` | ❌ | ✅ **waterfall** |
| `ressources/template/[slug]/page.tsx` | `getTemplateBySlug()` → `getRelatedTemplates()` | ❌ | ✅ **waterfall** |
| `settings/page.tsx` | `getNotificationSettings()` (interne `Promise.all`) | ✅ | ✅ résolu |

### 2.3 Fetches bloquant vs. streamables

Tous les `await` dans les Server Components **bloquent le rendu initial** — Next.js n'envoie aucun HTML au navigateur tant que le composant n'est pas résolu. En l'absence de `<Suspense>` avec un vrai fallback, aucun contenu n'est streamé.

---

## Section 3 — Navigation côté client

### 3.1 Usage de `<Link>` vs `<a>` natif vs `router.push`

| Composant | Type de navigation | Prefetch | Impact |
|---|---|---|---|
| `src/shared/components/dashboard/Topbar.tsx` | `<Link href={...}>` ✅ | Défaut Next.js (`true`) | Prefetch actif, View Transitions compatibles |
| `src/shared/components/dashboard/mobile/BottomNav.tsx` | **`<a href={...}>`** ❌ | ❌ aucun prefetch | **Full page reload — bypasse le router client-side ET les View Transitions** |
| `src/shared/components/dashboard/mobile/MobileTopActions.tsx` | `<Link href="/settings">` ✅ | Défaut | OK |
| Modules (`community/`, `ressources/`, `formation/`) | `router.push(url)` | ❌ (`push` ne prefetch pas) | Navigation client-side ✅ mais pas de prefetch |
| Auth forms (`LoginForm`, `SignupForm`) | `router.push("/dashboard")` | ❌ | Navigation client-side ✅ |

**Point critique — `BottomNav.tsx` lignes 53–89 :**

```tsx
// src/shared/components/dashboard/mobile/BottomNav.tsx L53
<a
  key={href}
  href={href}   // ← <a> natif, pas <Link>
  ...
>
```

Ce composant est la **navigation principale sur mobile**. L'usage de `<a>` natif signifie :

1. Le navigateur effectue une **requête HTTP complète** vers la route suivante.
2. Le router Next.js App Router n'est pas impliqué → **aucun prefetch**.
3. L'API View Transitions (`experimental.viewTransition: true`) ne se déclenche **jamais** sur mobile, car elle exige une navigation client-side initiée par le router.
4. Chaque tap dans le BottomNav recharge intégralement la page, incluant le layout, les polices, le CSS — le **sentiment d'app native disparaît entièrement**.

### 3.2 Désactivation du prefetch

Aucune occurrence de `prefetch={false}` dans le projet. Les `<Link>` de Topbar et MobileTopActions utilisent le défaut (`true`).

### 3.3 `router.refresh()`, `revalidatePath()`, `revalidateTag()`

| Appel | Fichier | Contexte |
|---|---|---|
| `revalidatePath("/formation", "layout")` | `src/modules/formation/server/actions.ts` L37 | Après action serveur de progression — déclenche un re-fetch du layout Formation |
| Aucun `router.refresh()` | — | Non utilisé |
| Aucun `revalidateTag()` | — | Non utilisé |

Le `revalidatePath` en formation est légitime (mise à jour de progression). Il ne devrait pas causer de recharge intempestive en navigation normale.

---

## Section 4 — Transitions et animations

### 4.1 Librairies d'animation

`package.json` — dépendances pertinentes :

| Package | Version | Usage |
|---|---|---|
| `tw-animate-css` | `^1.4.0` | Utilities Tailwind pour animations CSS |
| `sonner` | `^2.0.7` | Toasts animés |
| `next-themes` | `^0.4.6` | Bascule de thème |
| `framer-motion` | ❌ absent | — |
| `motion` | ❌ absent | — |
| `react-spring` | ❌ absent | — |

**Aucune librairie d'animation JS** — toutes les animations sont en CSS pur.

### 4.2 View Transitions API

**Configuration activée** dans `next.config.ts` L13–14 :

```typescript
experimental: {
  viewTransition: true,
}
```

**CSS configuré** dans `src/app/globals.css` L576–596 :

```css
::view-transition-group(*) {
  animation-duration: 350ms;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
::view-transition-old(*), ::view-transition-new(*) {
  animation-duration: 350ms;
}
/* prefers-reduced-motion respecté */
```

**`view-transition-name` appliqués** (shared element transitions carte → detail) :

| Composant source | Composant destination | Nom |
|---|---|---|
| `ResourceCard.tsx` | `ressources/ressource/[slug]/page.tsx` L176 | `card-${resource.slug}` |
| `TemplateCard.tsx` | `ressources/template/[slug]/page.tsx` L69 | `card-${template.slug}` |

**Verdict :** L'infrastructure View Transitions est correctement posée pour les ressources (config + CSS + noms). Elle ne fonctionne pas sur mobile à cause des `<a>` dans `BottomNav`. Sur desktop, les navigations via `<Link>` dans `Topbar` déclenchent bien le mécanisme — mais aucune page principale (dashboard, formation, communauté…) n'a de `view-transition-name` défini sur ses éléments de structure, donc la transition se limite au cross-fade par défaut de 350ms.

### 4.3 `AnimatePresence` et transitions inter-pages dans les layouts

Aucun usage de `AnimatePresence` (framer-motion absent). Aucun wrapping de `{children}` dans un composant d'animation dans `src/app/layout.tsx` ni dans `src/app/(app)/layout.tsx`.

### 4.4 Tokens de transition dans le design system

`src/app/globals.css` L121–124 :

```css
--nc-ease: cubic-bezier(0.22, 1, 0.36, 1);
--nc-duration-fast: 200ms;
--nc-duration-normal: 250ms;
--nc-duration-slow: 300ms;
```

Ces tokens sont appliqués **uniquement à des éléments internes** (hover, modales, inputs, animations de widgets). Il n'existe pas d'animation de sortie/entrée de page appliquée au niveau du layout — l'`nc-mode-in` est sur des éléments de contenu individuels, pas sur la page en tant qu'unité.

---

## Section 5 — Bundle et performance

### 5.1 Build output

Non vérifiable sans exécution — `next build` n'a pas été lancé dans cet audit.

### 5.2 Répartition Server / Client components

| Zone | Fichiers `"use client"` | Note |
|---|---|---|
| `src/app/` (pages) | 1 (`coaching/page.tsx`) | ⚠️ Page entière client — empêche tout SSR ou streaming |
| `src/shared/components/` | ~30 fichiers | Normal pour composants interactifs |
| `src/modules/` | ~41 fichiers | Principalement forms et composants d'état |

**`coaching/page.tsx` est un `"use client"` de niveau page.** C'est la seule page sous `(app)/` qui rend tout côté client. Conséquence : pas de SSR, First Contentful Paint dépend du bundle JS.

### 5.3 Imports lourds

Tous les imports `lucide-react` sont des **named imports ciblés** — pas de `import * as Icons`. Tree-shaking effectif.

Pas de `recharts`, `d3`, ou autre librairie de visualisation détectée.

Import potentiellement large : `src/modules/settings/` contient plusieurs formulaires client-side complexes (`AvatarPicker`, `DangerZone`, sections de notifications) — mais ils sont dans un module séparé qui ne charge que sur `/settings`.

### 5.4 Incohérence détectée — `communaute/page.tsx`

```tsx
// src/app/(app)/communaute/page.tsx
<Suspense fallback={null}>
  <CommunityPageClient />   ← ce composant est "use client"
</Suspense>
```

Le `<Suspense>` ici ne streame rien de utile : `CommunityPageClient` est un composant client, pas un Server Component avec `await`. La boundary est probablement là pour une raison de `useSearchParams`, mais le `fallback={null}` signifie que l'écran reste vide le temps que le JS hydrate.

---

## Section 6 — Synthèse / Diagnostic

### Cause #1 de l'écran figé

**Le layout `(app)/layout.tsx` effectue 2 appels Supabase séquentiels (`auth.getUser()` → `profiles.select()`) qui bloquent le rendu de TOUTES les pages connectées** avant qu'un seul octet d'HTML ne soit envoyé au navigateur. Ce waterfall est inévitable sur chaque navigation (le layout re-s'exécute côté serveur). De plus, `dashboard/page.tsx` répète ces mêmes 2 appels dans `getGreetingFirstName()` — soit **4 round-trips Supabase séquentiels** pour afficher le dashboard. En l'absence de `loading.tsx`, le navigateur n'a rien à afficher pendant ce temps : l'ancienne page reste visible jusqu'à ce que le nouveau HTML arrive complètement.

### Cause #1 de l'absence de transitions fluides

**`BottomNav.tsx` utilise des `<a>` natifs (L53–89) au lieu de `<Link>`.** Sur mobile, chaque navigation provoque une full page reload qui contourne le router Next.js, désactive le prefetch, et empêche le déclenchement de l'API View Transitions — même si celle-ci est correctement configurée (`experimental.viewTransition: true` + CSS `::view-transition-group`). Sur desktop, `Topbar.tsx` utilise `<Link>` correctement, mais aucune page n'a de `view-transition-name` sur ses éléments structurels, donc la transition se réduit à un cross-fade discret de 350ms (fonctionnel, mais non perceptible sur un fond blanc uniforme).

### 3 chantiers par ordre priorité (impact / effort)

| Priorité | Chantier | Impact | Effort |
|---|---|---|---|
| **1** | Remplacer les `<a>` par `<Link>` dans `BottomNav.tsx` | Élimine les full page reloads sur mobile, active le prefetch et les View Transitions d'un coup | Très faible (5 lignes) |
| **2** | Ajouter un `loading.tsx` dans `src/app/(app)/` | Affiche immédiatement un fallback sur toutes les routes connectées pendant le waterfall Supabase du layout | Faible (1 fichier, skeleton UI) |
| **3** | Éliminer le doublon de fetches dans `dashboard/page.tsx` (lire l'identity depuis le `ProfileIdentityContext` déjà chargé par le layout) | Réduit de 4 à 2 les round-trips Supabase sur le dashboard | Moyen (refacto `getGreetingFirstName` pour consommer le contexte) |

---

*Audit statique — aucune modification de fichier effectuée.*
