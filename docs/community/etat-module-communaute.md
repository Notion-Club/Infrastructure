# Module Communauté — état du chantier

> **But de ce document** : donner une vue d'ensemble à jour du module
> `src/modules/community/` — ce qui a été livré, comment ça fonctionne, les
> décisions techniques structurantes, les pièges connus et ce qu'il reste à
> faire. Rédigé le **2026-07-06**. Repo : `Notion-Club/Infrastructure`.
>
> Documents liés :
> - [`docs/passation-session-2026-07-batch-ameliorations.md`](../passation-session-2026-07-batch-ameliorations.md)
>   — mode de travail (worktree, déploiement, iOS) + chantier morph /Ressources.
> - [`docs/pwa/`](../pwa/) — quirks WebKit / PWA standalone (modales, overlays).

---

## 1. Vue d'ensemble

La **Communauté** est le module social de la plateforme : un **feed** de posts
(annonces, discussions, tags), leurs **détails + commentaires** (avec réponses,
mentions, réactions), et une **messagerie** (DMs 1-à-1, présence, notifications).

- **Stack** : Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 ·
  Supabase (auth + DB + realtime).
- **Données : RÉELLES, pas mockées.** `server/queries.ts` et `server/actions.ts`
  tapent le vrai Supabase (`createSupabaseServerClient`, tables `posts`,
  `post_reactions`, `post_mentions`, `comments`, `conversations`, `profiles`…).
  Les fichiers `mocks/*.mock.ts` ne servent plus qu'aux tests / au design de
  référence — le rendu prod est branché.
- **Règle d'isolation ESLint** (CONVENTIONS.md) : le module n'importe que son
  propre code, `@/shared/*` ou des packages npm — jamais un autre module.

### Cartographie par responsabilité

| Concern | Emplacement |
|---|---|
| Routes (pages serveur) | `routes/community-page.tsx`, `community-post-detail-page.tsx`, `community-restricted-page.tsx` |
| Feed | `components/feed/` (`PostCard`, `FeedPostList`, `FeedTagFilters`, états skeleton/vide/erreur) |
| Détail & commentaires | `components/post-detail/` (`CommentItem`, `CommentReplyItem`, `CommentComposer`, `CommentList`) |
| Composer de post | `components/post-composer/` (`PostComposerModal`, tag select, admin fields) |
| Messagerie | `components/messages/` (`MessagesLayout`, `ConversationThread`, `NewConversationModal`, `MessageComposer`…) |
| Partagés | `components/shared/` (`VideoEmbed`, `PostKebabMenu`, `UserAvatar`, `UserHoverCard`, `ReactionsBar`…) |
| Server | `server/` (`queries.ts`, `actions.ts`, `notifications.ts`, `push-notify.ts`, `dm-email.ts`) |
| Hooks | `hooks/` (`useMembersList`, `useConversationsRealtime`, `useNotifications`, `useCurrentUser`…) |
| Utils | `utils/` (`video-embed.ts`, `render-mentions.tsx`, `copy-link.ts`, `linkify.tsx`, `date-helpers.ts`…) |
| Types | `types/` (`post.types.ts`, `comment.types.ts`, `conversation.types.ts`…) |

---

## 2. Ce qui a été livré (chronologie, tout en prod)

Toutes ces PR sont **mergées sur `main`** et déployées (Vercel `main` → prod
`app.notionclub.fr`).

| PR | Sujet | État |
|---|---|---|
| **#259** | Copier le lien · mini-markdown en lecture · normalisation des imports Slack | ✅ prod |
| **#260** | Dropdown au-dessus des cartes · panneau messages pleine hauteur · état vide compact · resize animé de la modale | ✅ prod |
| **#261** | État « aucun résultat » illustré (modale) · verrouillage hauteur de l'onglet Messages | ✅ prod |
| **#262** | Embeds vidéo (YouTube/Loom/Tella/Vimeo) sur le feed, le détail et les commentaires | ✅ prod |
| **#263** | (session // Théo) DMs pré-chargés · médias du feed sans saccade · CTA de réaction · icône `text.bubble` | ✅ prod |
| **#264** | (session // Théo) tracking migration `slack_archive` créée via MCP | ✅ prod |

> Les PR #263/#264 proviennent d'une **session parallèle** (worktree
> `Infrastructure-session-batch`) documentée dans la passation dédiée. Elles
> touchent aussi la Communauté (feed hauteur fixe, façade YouTube, etc.) — ce
> doc reste la carte du module, la passation reste la carte de cette session-là.

---

## 3. Fonctionnalités & décisions clés

### 🔗 Copier le lien + mini-markdown en lecture (#259)

- **Deep-links** vers un post / un commentaire (`utils/copy-link.ts` :
  `buildCommentLink`, `copyCommunityLink`) + surlignage à l'arrivée
  (`hooks/useCommentHighlight.ts`, param `?comment=`).
- **Rendu mini-markdown** en lecture (`utils/render-mentions.tsx`,
  `format-inline.tsx`, `linkify.tsx`) : gras/italique, liens, mentions
  `@utilisateur`. Testé (`render-mentions.test.tsx`, 8 cas).
- **Normalisation des imports Slack** : les messages archivés Slack sont
  nettoyés au rendu (voir aussi migration `slack_archive`, hors-repo côté
  Supabase Prod).

### ⬆️ Dropdown kebab au-dessus des cartes (#260)

- **Bug** : le menu « … » d'un post était masqué par la carte suivante.
- **Cause** : `PostCard` porte un `viewTransitionName` sur son `<article>`, ce
  qui **crée un contexte d'empilement** — le dropdown restait prisonnier sous
  la carte du dessous.
- **Fix** : on **lève le `z-index` de l'article** (flex-item) tant que le menu
  est ouvert. `PostCard` porte un état `menuOpen` ; `position: relative` +
  `zIndex: menuOpen ? 20 : undefined` ; `PostKebabMenu` remonte l'ouverture via
  `onOpenChange={setMenuOpen}`.
- **Principe général** : un flex-item avec `z-index !== auto` crée un contexte
  d'empilement quelle que soit sa `position` — c'est le levier utilisé ici.

### 📐 Panneau messages pleine hauteur + verrouillage des hauteurs (#260, #261)

Deux bugs de la **même famille** : une chaîne flex ancrée par un `min-height`
(pas une hauteur définie) ne résout pas les hauteurs en pourcentage → soit une
**bande grise** sous le panneau (Messages), soit un **encadré qui s'allonge**
quand on ouvre un DM ou que le feed grandit.

- **Fix** : donner une **hauteur DÉFINIE** à l'encadré selon l'onglet, ce qui
  **borne la chaîne flex** → le contenu long scrolle **en interne**, rien ne
  bouge sur la page. Dans `globals.css` :
  - `.nc-messages-embed` : mobile `height: calc(100dvh - 224px - safe-area)` ;
    desktop `flex: 1 1 auto` (remplit la carte, plus de bande grise).
  - `.nc-community-card--messages` (desktop) : `height: calc(100dvh - 136px)`.
  - `.nc-community-card--fixed` (Feed) : mobile `calc(100dvh - 184px - safe-area)`,
    desktop `calc(100dvh - 136px)`.
  - `.nc-feed-scroll` : `flex: 1 1 auto; min-height: 0; overflow-y: auto` — la
    zone scrollable interne du feed ; le scroll infini (`IntersectionObserver`
    de `FeedPostList`) est **ré-ancré sur ce conteneur**.
- **Détail de spécificité Tailwind v4** : les utilitaires sont en `@layer`, donc
  du CSS non-layeré les bat. On utilise une **double classe**
  (`.nc-community-card.nc-community-card--messages`) pour passer devant `.flex-1`.
- ⚠️ **Compromis assumé** : le document ne scrolle plus sur ces pages → en
  **Safari iOS hors PWA**, la barre d'outils ne se replie plus. Les constantes
  `184px` / `136px` sont des **estimations** du chrome du shell — **à ajuster**
  si l'encadré dépasse ou laisse un vide sur mobile (QA à finir).

### 🎯 État vide messages compact (#260)

- « Démarre une nouvelle conversation en cliquant sur [bouton] » : `<p>` en
  `max-width: 240px` + `text-wrap: balance`, et le segment « cliquant sur
  {bouton} » enveloppé dans un `<span style="white-space: nowrap">` → **deux
  lignes équilibrées**, le bouton n'est jamais orphelin sur sa ligne.
  (`components/messages/MessagesEmptyState.tsx`.)

### 🎬 Resize animé de la modale « Nouvelle conversation » (#260)

- Quand la recherche filtre la liste des membres, la modale **rétrécit en
  douceur** au lieu de sauter — pattern **transitions.dev `01-card-resize`**
  (`.t-resize` : tween `width`/`height`, `cubic-bezier(0.22,1,0.36,1)`, 300ms,
  guard `prefers-reduced-motion`).
- **Piloté par une hauteur mesurée en JS** (`useLayoutEffect` +
  `listRef.scrollHeight`, clampée à 320px) — pas de `setState` dans l'effet
  (évite un re-render et la règle lint `set-state-in-effect`).

### 🫥 État « On a trouvé personne » illustré (#261)

- Quand la recherche membres ne matche personne, on n'affiche plus « Aucun
  membre trouvé » sec mais un **skeleton illustré à dégradé flou progressif**
  (repris du pattern coaching `UpcomingEmptyState.tsx` — `.nc-blur-in` +
  `WebkitMaskImage: linear-gradient(...)`), titre **« On a trouvé personne »**,
  sous-titre **« Tu as peut-être fait une faute de frappe, vérifie ta saisie »**.
  (`components/messages/NewConversationModal.tsx`, composant `NoMemberFound`.)

### 📺 Embeds vidéo unifiés (#262)

Une vidéo **YouTube / Loom / Tella / Vimeo** dans un post OU un commentaire
s'affiche en **lecteur 16/9** sous le texte, partout (feed, détail, réponses).

- **`utils/video-embed.ts`** — `detectVideoEmbed(text) → { provider, embedSrc,
  matchedUrl } | null`.
  - **Allowlist STRICTE** : seuls les 4 providers listés produisent un embed ;
    toute autre URL → `null` (jamais d'iframe vers une origine arbitraire).
  - **Anti-substring (sécurité)** : le schéma `https://` est **requis** dans les
    regex. Sans lui, `youtube.com` matchait en sous-chaîne d'un domaine piégé
    (`notyoutube.com`) → trou dans l'allowlist. Bug **attrapé par un test**,
    corrigé.
  - **`matchedUrl`** = URL brute trouvée → sert à la **retirer du body** au
    rendu (sinon on afficherait l'embed ET le lien nu). Premier match **par
    position** dans le texte (un seul embed par post/commentaire).
- **`components/shared/VideoEmbed.tsx`** — iframe responsive `aspect-ratio:
  16/9`, `radius 12`, `overflow hidden`, `allow` player complet, `allowFullScreen`,
  `loading="lazy"`, **`stopPropagation`** au clic (la carte feed est cliquable —
  cliquer le lecteur ne doit pas naviguer vers le détail). Prend une `src` **déjà
  validée** par l'allowlist ; ne jamais lui passer une URL brute.
- **Câblage (même pattern partout)** :
  ```ts
  const video = detectVideoEmbed(post.videoUrl ?? "") ?? detectVideoEmbed(body);
  const displayBody = video ? body.replace(video.matchedUrl, "").trim() : body;
  // {displayBody && <RichText/>}  puis  {video && <VideoEmbed src={video.embedSrc} />}
  ```
  Appliqué à `PostCard`, `community-post-detail-page`, `CommentItem`,
  `CommentReplyItem` (nouveauté : détection dans le body des commentaires).
- **Dédup** : `PostComposerModal` et `CommentComposer` avaient chacun leur
  `detectVideoUrl` local (3 copies avec le feed) → ils **délèguent** maintenant à
  l'util partagé via un thin wrapper (aperçu de saisie inchangé).
- **Bugs corrigés au passage** : en page détail, `videoUrl.split("v=")[1]`
  cassait tout embed non-YouTube ; le feed ne gérait que YouTube.

---

## 4. Décisions techniques transverses

- **Front / animations = `transitions-dev`.** Référence canonique obligatoire
  (`.agents/skills/transitions-dev/`, commandes `transitions reveal|review|apply`).
  On s'en inspire plutôt que de réinventer des `@keyframes`. Classes maison
  dérivées : `.t-resize`, `.nc-blur-in`, `.nc-mode-in`, `.nc-messages-embed`.
  Toujours conserver les guards `@media (prefers-reduced-motion: reduce)`.
- **Contextes d'empilement CSS.** `viewTransitionName` et tout `z-index !== auto`
  sur un flex-item créent un contexte d'empilement — c'est la clé du bug/fix du
  dropdown (§3).
- **Chaînes flex + hauteurs %.** Une hauteur en % ne se résout pas si la chaîne
  est ancrée par un `min-height` : donner une **hauteur définie** au bon niveau
  borne la chaîne et rétablit le scroll interne (§3).
- **Spécificité Tailwind v4.** Utilitaires en `@layer` → du CSS non-layeré (ou
  une double classe) les bat sans `!important`.
- **Sécurité embeds.** Allowlist stricte + schéma https requis + `src` validée
  en amont : jamais d'iframe vers une origine non maîtrisée.
- **Data-fb-label.** Chaque bloc notable porte un `data-fb-label` (ex. « Vidéo du
  post · Carte post ») pour l'outil de feedback admin. À conserver sur tout
  nouveau composant.

---

## 5. Tests

- **Runner** : `vitest` (env node, JSX automatic runtime). Commande :
  `npx vitest run src/modules/community`.
- **État** : **19 tests verts** —
  - `utils/video-embed.test.ts` (11) : providers, `matchedUrl` avec params,
    allowlist / anti-substring (`example.com`, `evil.tv`, `notyoutube.com` →
    `null`), premier match par position, retrait de l'URL du body.
  - `utils/render-mentions.test.tsx` (8) : rendu mentions + inline.

---

## 6. Pièges connus (hors périmètre — ils shippent en prod)

- **Lint `react-hooks/set-state-in-effect`** : violations **pré-existantes** sur
  des effets de resync (`CommentItem.tsx:51`, `FeedPostList.tsx:30`,
  `CommentList`, `CommentReplyItem`). Elles sont sur `main` — **le nouveau code
  ne doit pas en ajouter** (le resize modale a été fait en `useLayoutEffect`
  impératif exprès pour ça).
- **`next build` local s'arrête** au prérender de `/ressources` :
  _« NOTION_API_TOKEN missing »_ — gate d'env **pré-existant**, le token est set
  côté Vercel. Ce n'est PAS une régression. Valider localement avec
  `npx tsc --noEmit` + `npx eslint <fichier>` + `npx vitest run`.
- **iOS / PWA** : beaucoup de quirks WebKit ne se voient **qu'en PWA standalone
  installée**. Tester sur device avant de considérer un bug de layout/scroll
  résolu (cf. compromis §3 sur le scroll-document).

---

## 7. Ce qu'il reste à faire / à valider

- [ ] **QA mobile des hauteurs fixes** (Feed + Messages) : vérifier que les
  constantes `184px` / `136px` ne laissent ni dépassement ni vide sur device ;
  ajuster si besoin.
- [ ] **Import Tella des vidéos Slack** : les 34 vidéos importées de Slack
  (`.MOV`/`.mp4`, cf. `videos_a_mapper.csv`) n'ont **pas d'URL de lecteur** →
  elles ne s'embarqueront que quand elles porteront une URL d'un provider
  supporté (ex. Tella). Le **mapping fichier → URL Tella** est un **chantier
  data distinct** (remplir la colonne, puis injecter les URLs dans les bodies).
- [ ] **Nettoyage lint pré-existant** (`set-state-in-effect`) — dette de fond,
  hors périmètre des lots ci-dessus.

---

## 8. Reprise rapide

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
