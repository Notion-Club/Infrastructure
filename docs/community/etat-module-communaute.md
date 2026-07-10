# Module Communauté — état du chantier

> **But de ce document** : donner une carte à jour du module
> `src/modules/community/` — ce qui a été livré, comment ça fonctionne, les
> décisions techniques structurantes, les pièges connus et ce qu'il reste à
> faire. Mis à jour le **2026-07-10** (à jour du merge **#267**). Repo :
> `Notion-Club/Infrastructure`.
>
> Documents liés :
> - [`docs/passation-session-2026-07-batch-ameliorations.md`](../passation-session-2026-07-batch-ameliorations.md)
>   — mode de travail (worktree, déploiement, iOS) + chantier morph /Ressources.
> - [`docs/pwa/`](../pwa/) — quirks WebKit / PWA standalone (modales, overlays).

---

## 1. Vue d'ensemble & cartographie

La **Communauté** est le module social de la plateforme : un **feed** de posts
(annonces, discussions, tags), leur **détail + commentaires** (réponses,
mentions, réactions) ouvert **en overlay morph** (plus de navigation), et une
**messagerie** (DM 1-à-1, présence, temps réel, notifications, push, emails).

- **Stack** : Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 ·
  Supabase (auth + DB + realtime + storage).
- **Données : RÉELLES, pas mockées.** `server/queries.ts` et `server/actions.ts`
  tapent le vrai Supabase (`createSupabaseServerClient`, tables `posts`,
  `post_reactions`, `post_mentions`, `comments`, `comment_replies`,
  `conversations`, `messages`, `notifications`, `profiles`…). Les fichiers
  `mocks/*.mock.ts` ne servent plus qu'aux tests / au design de référence.
- **Règle d'isolation ESLint** (CONVENTIONS.md) : le module n'importe que son
  propre code, `@/shared/*` ou des packages npm — jamais un autre module. C'est
  pourquoi le mécanisme morph et la courbe ressort sont **dupliqués** ici
  (repris du module Ressources) plutôt qu'importés (`lib/spring.ts`, `feed/morph/`).

### Arborescence réelle du module

```
src/modules/community/
  index.ts                       barrel public du module
  types.ts                       ⚠️ barrel de RE-EXPORT (User, Post, Comment,
                                 Conversation, Message, Notification) — ne DÉFINIT
                                 rien, il ré-exporte depuis le dossier types/.
  types/                         définitions réelles :
    post.types.ts                Post, Reaction, Reactor, PostTag, PostAudience,
                                 PostCursor, PostsPage (keyset)
    comment.types.ts             Comment, CommentReply
    conversation.types.ts        Conversation, Message, MessageType
    user.types.ts                User, Role, Offer
    notification.types.ts        Notification, NotificationType (8 types)

  components/
    feed/                        FeedPostList, PostCard, FeedTagFilters,
                                 FeedEmptyState, FeedErrorState, FeedSkeletonState
    feed/morph/                  PostMorphContext (provider + portail),
                                 PostMorphOverlay (WAAPI, focus-trap, scroll)
    post-composer/               PostComposerModal, PostComposerAdminFields,
                                 PostComposerTagSelect, editor-utils.ts
    post-detail/                 CommentList, CommentItem, CommentReplyItem,
                                 CommentComposer (rendus dans l'overlay ET la
                                 page /post/[id] de deep-link)
    messages/                    MessagesLayout, ConversationList, ConversationItem,
                                 ConversationThread, MessageBubble,
                                 MessageBubbleSkeleton, MessageComposer,
                                 MessageToolbar, MessageSearchBar,
                                 NewConversationModal, MessagesEmptyState,
                                 ForwardMessageModal, TypingIndicator
    notifications/               NotificationPopover (centre de notifs in-app)
    dev/                         DevRoleToggle (bascule de rôle en dev)
    shared/                      VideoEmbed, PostImage, ImageLightbox(+Root),
                                 PostKebabMenu, ReactionsBar, ReactionPicker,
                                 UserAvatar, UserHoverCard, TagPill,
                                 RestrictedTooltip, DeletePostConfirmDialog

  server/                        queries.ts (lecture + keyset), actions.ts (~2000
                                 lignes de server actions), getPostComments.ts
                                 (action dédiée à l'overlay), notifications.ts
                                 (in-app), push-notify.ts (Web Push), dm-email.ts
                                 (emails DM via Resend)
  hooks/                         useCurrentUser, useDevRoleToggle, useMembersList,
                                 usePostsFiltered, useCommentHighlight,
                                 useNotifications, useConversationsRealtime,
                                 useTypingPresence, useUserTopEmojis
  lib/                           spring.ts (easing ressort critique), validation.ts
                                 (schémas zod de toutes les actions)
  utils/                         video-embed(.test), render-mentions(.test),
                                 format-inline, linkify, copy-link, date-helpers,
                                 mention-rules, dm-rules, visibility-rules, editor
  mocks/                         posts / comments / conversations / users (tests + design)
  routes/                        community-page, community-post-detail-page,
                                 community-restricted-page (composants de page,
                                 montés par l'App Router sous (app)/communaute/)
```

> **Doublon `types.ts` (racine) vs dossier `types/`** — `types.ts` est un
> **barrel** : il ne contient que des `export type { … } from "./types/…"`.
> Les types sont **définis** dans `types/*.types.ts`. Le code interne du module
> importe directement `../types/post.types` (chemin précis) ; `types.ts` (et
> `index.ts`) exposent la surface publique pour les consommateurs externes.
> Ne pas ajouter de définition dans `types.ts` racine — uniquement des re-exports.

### Routage App Router (`src/app/(app)/communaute/`)

- `(shell)/layout.tsx` — monte `CommunityPage` (shell persistant Feed/Messages)
  et pré-charge `listPostsPage` + `listConversations` côté serveur.
- `(shell)/page.tsx`, `(shell)/feed/page.tsx`, `(shell)/messages/…` — marqueurs
  de route ; la vue est dérivée de `usePathname()` dans `CommunityPage`.
- `post/[id]/page.tsx` — **page serveur de deep-link uniquement** (voir §3.1).

---

## 2. Chronologie des PR livrées (jusqu'à #267 inclus)

Toutes **mergées sur `main`** et déployées (Vercel `main` → prod
`app.notionclub.fr`).

| PR | Sujet | État |
|---|---|---|
| **#259** | Copier le lien · mini-markdown en lecture · normalisation des imports Slack | ✅ prod |
| **#260** | Dropdown au-dessus des cartes · panneau messages pleine hauteur · état vide compact · resize animé de la modale | ✅ prod |
| **#261** | État « aucun résultat » illustré (modale) · verrouillage hauteur de l'onglet Messages | ✅ prod |
| **#262** | Embeds vidéo (YouTube/Loom/Tella/Vimeo) sur le feed, le détail et les commentaires | ✅ prod |
| **#263** | (session // Théo) DM pré-chargés · médias du feed sans saccade · CTA de réaction · façade YouTube · embed Tella | ✅ prod |
| **#264** | (session // Théo) tracking de la migration `slack_archive` | ✅ prod |
| **#265** | Doc — première version de cette carte de module | ✅ prod |
| **#266** | **Morph Apple** des posts du feed (détail en overlay, plus de navigation) + polish réactions / dropdown | ✅ prod |
| **#267** | **Pagination keyset serveur** du feed (lots de 50, tag + pinned) | ✅ prod |

> **⚠️ Ce doc est désormais à jour de #267.** Les briques DM / notifications /
> push / emails cron (§5) sont pour la plupart antérieures à #259 (migrations
> 014→050) et n'avaient jamais été cartographiées ici — elles le sont maintenant.

---

## 3. Le feed en détail

### 3.1 🎬 Morph du détail post — overlay en place, ZÉRO navigation (#266)

Le clic sur une carte du feed **n'ouvre plus une page serveur**. `PostCard`
capture la géométrie de la carte et appelle un provider qui monte un **overlay
en portail** : la carte « morphe » vers un encadré développé, sans quitter le feed.

- **`components/feed/PostCard.tsx`** — au clic (`handleCardClick`), appelle
  `usePostMorph().open({ post, cardRect, titleRect, triggerEl, viaKeyboard })`.
  Le `post` passé porte l'état local à jour (réactions/édition optimistes) pour
  que l'overlay démarre sur les mêmes données. `detail === 0` distingue
  l'activation clavier (restitution de focus à la fermeture) du clic souris.
- **`components/feed/morph/PostMorphContext.tsx`** — provider + `createPortal`.
  Un seul overlay à la fois ; `key={source.post.id}` remonte un overlay neuf par
  post (aucun résidu d'anim). Le feed ne se démonte jamais → fond statique,
  fermeture sans re-cascade.
- **`components/feed/morph/PostMorphOverlay.tsx`** — cœur du morph, en **WAAPI**
  (`element.animate`) :
  - surface clippée qui morphe (coins lisses), **titre continu « hero »** qui
    voyage de la carte vers l'encadré, fade-through des contenus.
  - Pendant le morph la surface est `position: fixed` ; à la fin de l'ouverture
    elle est **relâchée en flux** (`position: relative`) → le contenu défile dans
    un conteneur plein écran (pas de scroll interne), la croix reste fixe.
  - **Commentaires hydratés en async** : le feed ne porte QUE les posts.
    L'overlay appelle `server/getPostComments.ts` (→ `listCommentsForPost`) et
    affiche un skeleton le temps du fetch. Même source que la page détail →
    rendu identique.
  - Toutes les actions post restent dispo depuis l'overlay (réaction, édition,
    suppression, épinglage) — miroir de `PostCard`.
  - A11y / PWA : focus-trap `Tab`, `Échap` ferme, entrée `history.pushState`
    pour que le bouton retour Android/PWA ferme l'overlay, verrou de scroll non
    déplaçant, auto-correction anti-piège du `fixed` en PWA iOS.
  - **z-index** : root overlay `4000`, sous les modales du module (édition /
    suppression `9999`, lightbox `9998`, feuille de réactions `5000`) pour
    qu'elles s'empilent au-dessus.
- **`lib/spring.ts`** — easing **ressort critiquement amorti** (ζ = 1,
  ωₙ = 16 rad/s), échantillonné en `linear()`, **zéro overshoot**.
  `SPRING_EASING` (courbe) + `SPRING_DURATION = 482` (ms, ≈ temps de
  stabilisation). Copie autonome de la courbe validée au lab morph Ressources
  (isolation modules).

**La page `post/[id]` subsiste — mais uniquement pour les deep-links.**
`utils/copy-link.ts` (`buildPostLink` / `buildCommentLink`) pointe toujours vers
`/communaute/post/${id}` : partager un lien ouvre bien une **page serveur
autonome** (`app/(app)/communaute/post/[id]/page.tsx` → `getPostById` +
`listCommentsForPost` → `PostDetailClient`). Le morph, lui, ne change jamais
l'URL. Les deux rendus partagent les composants `post-detail/*`.

### 3.2 📄 Pagination keyset serveur (#267)

Le feed ne charge plus « tout puis découpe côté client ». La pagination est
**keyset, côté serveur**, par lots de 50.

- **`server/queries.ts` → `listPostsPage({ cursor, tag, limit = 50 })`** renvoie
  un `PostsPage { posts, nextCursor, hasMore }` :
  - **Curseur = couple `(created_at, id)` décroissant.** Le tie-break sur `id`
    est **obligatoire** : beaucoup de posts importés de Slack partagent la même
    `created_at` (au jour/heure près) — trier sur `created_at` seul sauterait ou
    dupliquerait des posts entre pages. La valeur `created_at` timestamptz
    **exacte** de la DB est repassée telle quelle (pas de reformat, sinon
    l'égalité casse).
  - **Posts épinglés** (`pinned = true`, `pinned_until` nul ou futur) chargés
    **une seule fois, en tête, sur la 1re page** (`cursor` null) et **exclus du
    flux keyset** (`.eq("pinned", false)`) → jamais dupliqués.
  - **Sonde `hasMore`** : la requête demande `limit + 1` lignes ; si elle en
    renvoie plus que `limit`, `hasMore = true` et `nextCursor` = `(created_at, id)`
    du dernier post rendu.
  - Filtre `tag` optionnel appliqué aux deux requêtes (pinned + flux). RLS
    (`posts_select_community` / `posts_select_paid`) filtre selon le viewer — pas
    de re-filtrage applicatif.
  - `hydratePosts()` batch les réactions + mentions + profils des reactors (1
    query/table). Le nombre de commentaires vient de `posts.comment_count`
    (dénormalisé, trigger mig. 020).
- **`server/actions.ts` → `loadMorePosts(cursor, tag)`** — thin server action
  qui délègue à `listPostsPage`. Aucune logique de pagination côté client.
- **`components/feed/FeedPostList.tsx`** — garde une **`IntersectionObserver`**
  sur une sentinelle, mais son rôle a changé : à l'intersection elle appelle
  `loadMorePosts(feed.cursor, tag)` et **append** la page reçue (dédup par id),
  au lieu de trancher un tableau déjà entièrement chargé. Un changement de tag
  recharge la page 1 du tag (`mode: "replace"`). Verrou synchrone (`loadingRef`)
  + « dernière requête gagne » (`reqIdRef`) contre les doublons et les réponses
  périmées. `types/post.types.ts` définit `PostCursor` / `PostsPage`.

### 3.3 📺 Embeds vidéo unifiés (#262) — inchangé

Une vidéo **YouTube / Loom / Tella / Vimeo** dans un post OU un commentaire
s'affiche en lecteur 16/9 sous le texte, partout (feed, overlay/détail, réponses).

- **`utils/video-embed.ts`** — `detectVideoEmbed(text)` → `{ provider, embedSrc,
  matchedUrl } | null`.
  - **Allowlist STRICTE** : seuls les 4 providers produisent un embed, toute
    autre URL → `null` (jamais d'iframe vers une origine arbitraire).
  - **Anti-substring** : le schéma `https://` est **requis** dans les regex —
    sinon `youtube.com` matchait en sous-chaîne d'un domaine piégé
    (`notyoutube.com`). Bug attrapé par un test, corrigé.
  - `matchedUrl` = URL brute trouvée → sert à la retirer du body au rendu
    (sinon embed + lien nu affichés en double).
- **`components/shared/VideoEmbed.tsx`** — iframe responsive validée en amont,
  `stopPropagation` au clic (ne pas ouvrir le morph en cliquant le lecteur).
- Câblage identique dans `PostCard`, `PostMorphOverlay`, la page détail,
  `CommentItem`, `CommentReplyItem`.

### 3.4 ⬆️ Dropdown kebab au-dessus des cartes (#260) — inchangé

`PostCard` porte un `viewTransitionName` sur son `<article>`, ce qui crée un
contexte d'empilement : le dropdown « … » restait prisonnier sous la carte du
dessous. **Fix** : état `menuOpen` (remonté par `PostKebabMenu` via
`onOpenChange`) → `position: relative` + `zIndex: menuOpen ? 20 : undefined`
tant que le menu est ouvert.

---

## 4. La messagerie (feed height, états vides) — inchangé

- **Panneau messages pleine hauteur + verrouillage des hauteurs (#260, #261)** :
  une chaîne flex ancrée par un `min-height` ne résout pas les hauteurs en % →
  bande grise / encadré qui s'allonge. Fix : hauteur **définie** par onglet
  (`globals.css` : `.nc-messages-embed`, `.nc-community-card--messages`,
  `.nc-community-card--fixed`, `.nc-feed-scroll`) → scroll **interne**, rien ne
  bouge sur la page. Double classe pour battre la spécificité `@layer` de
  Tailwind v4.
- **État vide messages compact (#260)** (`MessagesEmptyState.tsx`) et **« On a
  trouvé personne » illustré (#261)** (`NewConversationModal.tsx`, composant
  `NoMemberFound`, skeleton `.nc-blur-in`).

---

## 5. Socle DM temps réel / notifications / push / emails

Cette section documente les briques structurantes du module (migrations
014→050) jamais cartographiées jusqu'ici.

### 5.1 🔔 Notifications in-app

- **`server/notifications.ts`** — `getNotifications()` (50 dernières,
  antichronologique, RLS `notifications_select_self`), `markNotificationAsRead`,
  `markAllNotificationsAsRead`, `markNotificationAsUnread`. Les **lignes sont
  créées par des triggers DB** (mig. **038**) à chaque événement (mention,
  commentaire, réponse, réaction, DM, annonce admin).
- **`hooks/useNotifications.ts`** — fetch initial via l'action, puis abonnement
  **Supabase Realtime `postgres_changes`** filtré `recipient_id=eq.{me}`. À
  chaque INSERT/UPDATE → **re-fetch** (le payload brut ne porte pas l'acteur
  joint). **Nonce de channel par montage** (`channelSeq`) pour éviter la
  collision Strict Mode (`.on()` après `subscribe()`). Re-fetch **coalescé**
  (throttle 400 ms) contre les rafales (annonce admin = 200 lignes d'un coup).
- **`components/notifications/NotificationPopover.tsx`** — désormais **branché**
  sur la cloche de la `Topbar` (desktop) ET de `MobileTopActions` (mobile), tous
  deux dans `@/shared/components/dashboard/`. Le badge non-lu et la liste sont
  alimentés en données réelles par `useNotifications`.
- **`types/notification.types.ts`** — `NotificationType` couvre 8 cas dont
  `admin_annonce` et `admin_push` (titre + lien libres, sans acteur — mig.
  **044**). Migration **039b** = archivage des notifications.

### 5.2 📲 Web Push (téléphone / PWA standalone)

- **`server/push-notify.ts`** — pont in-app → Web Push. `notifyPush()` (1
  destinataire) et `notifyPushMany()` (fan-out annonce admin). **Fire-and-forget** :
  ne throw jamais, ne bloque jamais une server action. Respecte le toggle
  `channel_preferences (channel = 'push')` (skip si explicitement désactivé).
  Délègue l'envoi réel à `@/shared/lib/push/webPush` (`sendWebPushToUser`).
  Appelé depuis `actions.ts` après chaque écriture (post/mention/commentaire/
  réaction/DM). L'in-app est déjà géré par trigger DB → le push ne fait que la
  couche téléphone.
- **Routes `src/app/api/push/{subscribe,unsubscribe,send}`** :
  - `subscribe` / `unsubscribe` — gestion des souscriptions PushSubscription
    du navigateur.
  - `send` — envoi machine-to-machine authentifié par
    `Authorization: Bearer <CRON_SECRET>` (cron Vercel, webhook Notion, script
    admin). Retourne `{ sent, expired, failed }` ; les souscriptions périmées
    sont marquées `expired_at`.

### 5.3 ✉️ Emails de notification DM (cron)

- **`server/dm-email.ts`** — `processDmEmailQueue()` : draine la table
  `dm_email_notifications` (mig. **030**), envoie via **Resend**, marque
  `sent_at`. Best-effort : un échec loggue mais ne casse pas le batch (retry au
  prochain tick). Skip si le destinataire a rattrapé sa lecture, si le canal
  email est coupé (`channel_preferences` / `notification_preferences`
  `community_messages`), ou si le message a été supprimé.
- **Route `src/app/api/cron/send-dm-emails/route.ts`** — GET déclenché par
  **Vercel Cron** (auth `Bearer CRON_SECRET` OU header `x-vercel-cron: 1`).
  Sur le plan Hobby, le cron tourne **une fois par jour à 9h UTC** (1 cron/jour
  max). Idempotent (les notifs déjà `sent_at` non-null ne repartent pas).

  > ⚠️ Le commentaire d'en-tête de `dm-email.ts` évoque « toutes les 2 minutes »
  > (intention d'origine) — la **cadence réelle est celle de la route** (quotidienne
  > 9h UTC, cf. `vercel.json`). À corriger si le plan Vercel change.

### 5.4 💬 DM temps réel — Broadcast (retrait de `postgres_changes`)

- **`hooks/useConversationsRealtime.ts`** — reçoit les messages entrants et la
  création de conversations via **Broadcast from Database** (mig. **047**), qui
  **remplace** l'ancien abonnement table-wide `postgres_changes` (mig. **039**).
  Motif : `postgres_changes` forçait chaque client à écouter toute la table
  `messages` (fan-out O(users connectés)/message). Un trigger DB diffuse
  désormais chaque message sur un **canal privé par conversation** (`conv:<id>`)
  → fan-out O(participants) = 2. Deux familles de canaux privés :
  `conv:<conversationId>` (nouveaux messages) et `dm-user:<currentUserId>`
  (découverte d'une nouvelle conversation d'un inconnu). Les canaux privés
  exigent un token (`realtime.setAuth`, ré-appliqué au `TOKEN_REFRESHED`).
  Coalescing local 300 ms par conversation. La mig. **048** a **sorti `messages`
  de la publication `supabase_realtime`** — le DM ne repose plus que sur le
  broadcast.
- **`hooks/useTypingPresence.ts` + `components/messages/TypingIndicator.tsx`** —
  indicateur « en train d'écrire » via Realtime **broadcast** (channel
  `nc-typing:<conversationId>`, `self: false`). Protocole ping-only : ping toutes
  les 2 s tant qu'on tape, timeout 4 s côté récepteur (pas de « stop » explicite,
  plus robuste aux pertes de focus).
- **RPC `community_conversation_summaries` (mig. 045)** — appelé par
  `listConversations()` : dernier message non supprimé + `unreadCount` par
  conversation, en **une requête bornée indexée** (avant : on chargeait tous les
  messages des 100 convs pour dériver ces infos en JS). La sidebar ne dépend plus
  du volume d'historique. `queries.ts` pré-charge aussi la dernière page des 5
  conversations les plus récentes (`HYDRATE_TOP_CONVERSATIONS`) → ouverture
  instantanée sans aller-retour.

### 5.5 ↪️ Forward + quote-reply DM

- **Quote-reply (mig. 027)** — un message peut citer un message précédent via
  les colonnes dénormalisées `reply_to_message_id` / `reply_snippet` /
  `reply_author_name` (contrainte DB `messages_quote_reply_consistency` : les 3
  vont ensemble). Portées par `sendMessageAction` (validation zod
  `sendMessageSchema`).
- **Forward (mig. 028)** — `components/messages/ForwardMessageModal.tsx` +
  `forwardMessageAction` (`actions.ts`) : transfère un message vers plusieurs
  destinataires (borné par `FORWARD_MAX_TARGETS`). Fige le nom d'auteur source
  dans `forwarded_from_author_name` / `forwarded_from_message_id`.

### 5.6 😊 Polish réactions (#266)

- **`components/shared/ReactionPicker.tsx`** — sélecteur d'emojis
  (`useDropdownTransition`), variantes `pill` / `icon`, modes post (multi) /
  comment (single).
- **`hooks/useUserTopEmojis.ts` + `getUserTopEmojisAction` (actions.ts) + RPC
  `get_user_top_emojis` (mig. 029)** — les 3 emojis favoris du user pour la
  toolbar quick-reaction du `MessageBubble`. Le hook lit `localStorage`
  (`nc:user-top-emojis:v1`) au mount (render instantané, pas de flash) puis
  rafraîchit en background. Complété par des defaults (`👍 😂 🙌`) pour toujours
  renvoyer 3 emojis.

---

## 6. Archive Slack

- **`slack_archive` — migration COMMITÉE dans le repo** :
  `supabase/migrations/050_slack_archive.sql` (table `slack_archive` :
  `organization_id`, `slack_channel`, `slack_message_ts`, `author_profile_id`,
  `body`, `thread_ts`, `posted_at`, `files jsonb`, `raw jsonb`, contrainte
  d'unicité `(slack_channel, slack_message_ts)`…). Le suivi a d'abord été fait
  via MCP (#264) ; la migration est désormais **versionnée**, plus « hors-repo ».
- **Normalisation des imports Slack** (#259) : les messages archivés Slack sont
  nettoyés au rendu (`utils/render-mentions.tsx`, `format-inline.tsx`,
  `linkify.tsx`).

---

## 7. Décisions techniques transverses

- **Front / animations = `transitions-dev`.** Référence canonique obligatoire
  (`.agents/skills/transitions-dev/`). Classes maison dérivées : `.t-resize`,
  `.nc-blur-in`, `.nc-mode-in`, `.nc-messages-embed`. Toujours conserver les
  guards `@media (prefers-reduced-motion: reduce)` — le morph a un chemin
  `prefersReduced()` dédié (pose l'état final sans animer).
- **Morph = WAAPI + ressort critique.** `element.animate` (pas de lib), courbe
  `linear()` ζ = 1 sans overshoot (`lib/spring.ts`). Surface `fixed` pendant
  l'anim puis relâchée en flux → scroll document (pas interne), croix fixe.
  Mécanique dupliquée du module Ressources (isolation).
- **Realtime : Broadcast > `postgres_changes` pour les DM.** Canal privé par
  conversation (fan-out O(2)) au lieu d'un abonnement table-wide (fan-out
  O(users)). `postgres_changes` reste utilisé pour les **notifications** (mig.
  038) — volume bien plus faible, filtré `recipient_id`.
- **Server actions best-effort pour les side-effects.** Push et emails ne
  bloquent ni ne cassent jamais l'action métier (un push raté n'empêche pas un
  commentaire d'être posté).
- **Contextes d'empilement CSS.** `viewTransitionName` et tout `z-index !== auto`
  sur un flex-item créent un contexte d'empilement (clé du bug/fix dropdown §3.4).
- **Spécificité Tailwind v4.** Utilitaires en `@layer` → double classe pour
  passer devant sans `!important`.
- **Sécurité embeds.** Allowlist stricte + schéma `https` requis + `src` validée
  en amont.
- **`data-fb-label`.** Chaque bloc notable porte un `data-fb-label` pour l'outil
  de feedback admin. À conserver sur tout nouveau composant.

---

## 8. Tests

- **Runner** : `vitest` (env node, JSX automatic runtime). Commande :
  `npx vitest run src/modules/community`.
- **État** : **19 tests verts** —
  - `utils/video-embed.test.ts` (**11**) : providers, `matchedUrl` avec params,
    allowlist / anti-substring (`example.com`, `evil.tv`, `notyoutube.com` →
    `null`), premier match par position, retrait de l'URL du body.
  - `utils/render-mentions.test.tsx` (**8**) : rendu mentions + inline.

---

## 9. Pièges connus (hors périmètre — ils shippent en prod)

- **Lint `react-hooks/set-state-in-effect`** : violations **pré-existantes** sur
  des effets de resync (`CommentItem`, `FeedPostList`, `CommentList`,
  `CommentReplyItem`). Le nouveau code ne doit pas en ajouter (le morph et le
  resize modale sont faits en `useLayoutEffect` impératif exprès).
- **`next build` local s'arrête** au prérender de `/ressources` :
  _« NOTION_API_TOKEN missing »_ — gate d'env pré-existant, le token est set côté
  Vercel. Pas une régression. Valider localement avec `npx tsc --noEmit` +
  `npx eslint <fichier>` + `npx vitest run`.
- **iOS / PWA** : les quirks WebKit ne se voient qu'en **PWA standalone
  installée** (morph fixed→flow, verrou de scroll, auto-correction anti-piège).
  Tester sur device avant de considérer un bug de layout/scroll résolu.
- **Cadence cron divergente** : commentaire `dm-email.ts` (« 2 min ») vs route
  réelle (quotidienne 9h UTC) — cf. §5.3.

---

## 10. Ce qu'il reste à faire / à valider

- [ ] **QA mobile des hauteurs fixes** (Feed + Messages) : vérifier que les
  constantes du chrome (`184px` / `136px`, cf. `.nc-community-card--fixed` /
  `--messages`) ne laissent ni dépassement ni vide sur device ; ajuster au besoin.
- [ ] **Import Tella des vidéos Slack** : les vidéos importées de Slack
  (`.MOV`/`.mp4`, cf. `videos_a_mapper.csv`) n'ont pas d'URL de lecteur → elles
  ne s'embarqueront qu'une fois porteuses d'une URL d'un provider supporté
  (Tella). Le **mapping fichier → URL Tella** est un chantier data distinct.
- [ ] **Nettoyage lint pré-existant** (`set-state-in-effect`) — dette de fond,
  hors périmètre des lots ci-dessus.

---

## 11. Reprise rapide

```bash
cd /Users/theogouman/Infrastructure
git fetch origin && git log --oneline HEAD..origin/main   # doit être vide avant push

# vérifs locales (le build complet s'arrête sur NOTION_API_TOKEN — normal)
npx tsc --noEmit -p tsconfig.json
npx vitest run src/modules/community
npx eslint src/modules/community/<fichier-touché>
```

> Rappel workflow (CLAUDE.md) : toujours à jour avec `main` avant tout
> merge/push ; format de PR imposé (Contexte / Qu'est-ce qui a été fait /
> Pourquoi / Comment ça fonctionne / Branchements) en français.
</content>
</invoke>
