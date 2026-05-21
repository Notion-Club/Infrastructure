# Outil de feedback admin — État du chantier

> Ce document est le point d'entrée unique pour reprendre le contexte sur **l'outil de feedback admin** intégré dans NotionClub Infra. Il sert à la fois de :
> - **prompt de reprise** à coller dans une nouvelle session Claude Code,
> - **journal de chantier** (ce qui a été fait, ce qui reste, ce qui bloque),
> - **carte mentale** des fichiers, flows, API routes et variables d'env.
>
> Branche active : `claude/analyze-feedback-popup-kz0Y4` · PR : [#44](https://github.com/Notion-Club/Infrastructure/pull/44) · Dernier commit : `b51a7e6`.

---

## 🔁 Prompt de reprise de contexte

À coller tel quel au début d'une nouvelle session Claude Code (CLI ou web).

```
Je reprends le chantier "outil de feedback admin" sur le repo NotionClub Infra.
La branche de travail est `claude/analyze-feedback-popup-kz0Y4`, la PR
ouverte est #44.

Le contexte complet est dans `docs/feedback-widget/README.md` — lis-le en
entier avant de proposer la moindre action.

État rapide :
- Le widget est intégré dans `src/shared/components/feedback-widget/` +
  3 routes API dans `src/app/api/{feedback,tickets,blog-posts}/`.
- Il est monté dans `src/app/(app)/layout.tsx` derrière l'auth Supabase.
- La palette CSS a été adaptée aux tokens NotionClub (hardcodé en
  variables locales sur les 4 racines du widget, plus de dépendance aux
  tokens `@theme inline` de Tailwind v4 qui ne s'exposent pas au runtime).
- L'icône du bouton flottant est `<MessageSquarePlus>` (Lucide) sur fond
  brand `#e0625a` — plus de référence à l'avatar Mireille du projet
  source.

Ce qu'il reste à trancher (cf. section "Ambiguïtés ouvertes" du README) :
1. Variables d'env Notion — `NOTION_TOKEN` vs `NOTION_API_TOKEN` (existant) ?
2. Une seule base Notion ou deux (feedback + blog) ?
3. Catégories blog (`BLOG_CATEGORY_OPTIONS`) — encore Swiss-Serenity.
4. Gating admin du widget (aujourd'hui visible pour tout user authentifié).
5. Apparence en thème sombre.
6. PAGE_MAP pour routes dynamiques.

À chaque PR ou push, respecte impérativement le format imposé par
`CLAUDE.md` (5 sections : Contexte / Qu'est-ce qui a été fait / Pourquoi /
Comment ça fonctionne / Branchements front + back).
```

---

## 📦 Ce que c'est

Un widget flottant en bas à droite de toutes les pages connectées du dashboard. L'administrateur (Théo) clique dessus pour ouvrir un hub modal proposant **3 flows** :

1. **Retour sur un élément** — mode inspection : curseur crosshair, hover overlay sur les éléments de la page, clic pour annoter l'élément ciblé (avec son ancre `#id` deep-link), choix d'une action parmi 9 (`Modifier du texte`, `Ajouter du texte`, `Ajouter une image`, `Changer une couleur`, `Modifier la mise en page`, `Supprimer un élément`, `Ajouter un lien`, `Corriger une faute`, `Autre`), saisie du retour, ajout au draft.
2. **Feedback général** — feedback page entière sans cible précise.
3. **Créer un article de blog** — formulaire structuré (titre, slug auto, extrait, catégorie, tags, image cover drag & drop, auteur, date pub, temps de lecture, meta description SEO 120-160 char, corps via éditeur rich-text).

Plusieurs retours peuvent s'empiler dans un draft local avant envoi global. À l'envoi, chaque retour devient une page Notion via les API routes du widget.

**Objectif métier** : raccourcir la boucle « je vois un truc à corriger dans l'UX → je le note dans la roadmap Notion » — 3 clics au lieu d'un aller-retour manuel. Capturer le contexte visuel (élément exact + URL avec ancre) directement dans le ticket.

---

## 🗺️ Cartographie des fichiers

### Code source (origine)

Repris **tel quel** du repo `theogouman/random-project` (projet Swiss Serenity Plus, branche `claude/setup-swiss-serenity-plus-Fm7s6`). Dump brut conservé dans `extracted-feedback-widget/` à la racine du repo (audit), avec sa propre `INTEGRATION.md` qui détaille le graphe de dépendances.

### Intégration NotionClub (branche `claude/analyze-feedback-popup-kz0Y4`)

```
src/shared/components/feedback-widget/
├─ FeedbackWidget.tsx              ← cœur — 3 flows, ~1208 LOC (verbatim + 5 adaptations)
├─ FeedbackWidget.module.css       ← styles + bridge palette NC
├─ FeedbackWidgetLoader.tsx        ← dynamic(ssr:false) wrapper
├─ CustomSelect/                   ← dépendance — select stylé
│  ├─ CustomSelect.tsx
│  └─ CustomSelect.module.css
└─ RichTextEditor/                 ← dépendance — éditeur contentEditable
   ├─ RichTextEditor.tsx
   └─ RichTextEditor.module.css

src/app/api/
├─ feedback/route.ts               ← POST   → Notion DB (NOTION_DATABASE_ID)
├─ tickets/route.ts                ← GET liste / DELETE archive — même DB
└─ blog-posts/route.ts             ← POST   → Notion DB (NOTION_BLOG_DATABASE_ID)

src/app/(app)/layout.tsx           ← mount <FeedbackWidgetLoader /> derrière l'auth
```

### Documentation projet (mise à jour ou créée)

```
CLAUDE.md                          ← règle absolue format PR (5 sections obligatoires)
.claude/context.md                 ← section "Outil de feedback admin (widget intégré)"
.env.example                       ← bloc Notion feedback widget
docs/feedback-widget/README.md     ← ce fichier
extracted-feedback-widget/         ← dump brut d'origine + INTEGRATION.md (audit)
```

---

## 🎨 Adaptations effectuées vs code source

Conformément à la consigne « ne rien inventer », on est resté verbatim partout sauf là où l'adaptation au contexte NotionClub était strictement nécessaire.

| # | Quoi | Pourquoi |
|---|------|----------|
| 1 | Imports `../CustomSelect/...` → `./CustomSelect/...` | Réorganisation : sous-composants imbriqués dans `feedback-widget/` au lieu d'être frères. |
| 2 | `PAGE_MAP` réécrit | Listait les pages Swiss Serenity Plus — remplacé par les routes réelles du NC (`/dashboard`, `/communaute`, `/coaching`, `/ressources`, `/settings`, `/login`, `/signup`, `/reset-password`, `/update-password`). |
| 3 | Bridge palette CSS | Le code source utilise `--c-text`, `--c-bg`, `--c-accent-primary`, etc. — variables non définies dans `globals.css` du NC. On les map en local sur `.triggerWrap`, `.backdrop`, `.selectionHint`, `.toast` (hardcodé en hex, pas de dépendance aux tokens `@theme inline`). |
| 4 | `rgba()` hardcodées | Bordeaux Swiss-Serenity `rgba(180,44,42,X)` et taupe `rgba(151,123,87,X)` → brand NC `rgba(224,98,90,X)`. `#977b57` → `#e0625a`, `#9a2523` → `#c1473f`, `#0a3560` → `#1a1a1a`. |
| 5 | Bouton trigger | `<img src={AVATAR_URL}>` (photo Mireille) → `<MessageSquarePlus>` icône Lucide blanche sur cercle brand. Const `AVATAR_URL` supprimée. |
| 6 | Avatar header modal | Idem — `<img>` → icône Lucide dans cercle brand-tinted. |
| 7 | `SITE_DOMAIN` | `"swiss-serenity-plus.ch"` → `"app.notionclub.fr"`. |
| 8 | `setBlogAuthor` défaut | `"Mireille Dayer"` → `""`. |
| 9 | `aria-label` modal | `"Outil de retours Mireille"` → `"Outil de retours"`. |
| 10 | 3 apostrophes échappées + 3 `eslint-disable` ciblés | Pour passer `eslint-config-next` strict sans refacto fonctionnel. |

---

## 🔌 Branchements à faire (front / back)

### Côté back-end

- [ ] Créer (ou réutiliser) une intégration Notion sur https://www.notion.so/my-integrations — capability **Insert content** minimum, **Read content** aussi si on veut activer la vue grille des tickets envoyés.
- [ ] Connecter l'intégration à la base "ticket roadmap" jointe par l'administrateur :
  - URL : `https://www.notion.so/gouman/c4209ec95e2b496888c843e6c4672eda`
  - ID : `c4209ec9-5e2b-4968-88c8-43e6c4672eda`
  - → ouvrir la base → `...` → `Connections` → ajouter l'intégration.
- [ ] Renseigner les variables d'env sur Vercel (Production + Preview + Development) :
  ```
  NOTION_TOKEN=ntn_xxx_ou_secret_xxx
  NOTION_BLOG_DATABASE_ID=c4209ec9-5e2b-4968-88c8-43e6c4672eda
  NOTION_DATABASE_ID=                ← cf. ambiguïté #2 ci-dessous
  ```
- [ ] Vérifier que la base contient les propriétés attendues par le code (voir `Champs Notion attendus` plus bas).
- [ ] Décider du gating admin (cf. ambiguïté #4) — si restriction nécessaire, ajouter un check côté serveur dans `(app)/layout.tsx`.

### Côté front-end

- [ ] Compléter `PAGE_MAP` pour les routes dynamiques (`/communaute/post/[id]`, `/ressources/ressource/[slug]`, `/ressources/template/[slug]`) — sinon ces deep-links remonteront avec `Page concernée = "Home"` dans Notion.
- [ ] Remplacer `BLOG_CATEGORY_OPTIONS` (`FeedbackWidget.tsx` l. 18-24) — encore sur les catégories Swiss-Serenity (`conseils-dirigeants`, `temoignages`, `actualites`, `ressources-particuliers`, `autre`) — par les catégories réelles de la roadmap NotionClub.
- [ ] Une fois la base Notion remplie, valider visuellement :
  - le bouton flottant brand-rouge apparaît bien après `/login` → `/dashboard`,
  - la bulle "Tu as des retours ?" est lisible (texte blanc sur noir),
  - les 3 flows aboutissent à une page Notion correctement formée,
  - la vue grille "Tickets envoyés" charge sans erreur.
- [ ] (Plus tard) Migrer `RichTextEditor` de `document.execCommand` vers Tiptap ou ProseMirror — l'API `execCommand` est dépréciée et risque d'être retirée par les navigateurs.

---

## 📋 Champs Notion attendus par le code

Repris **tels quels** du code source, sans renommage. À créer / vérifier dans la base jointe.

### Base feedback/tickets (`NOTION_DATABASE_ID`)

Consommée par `/api/feedback` (POST) et `/api/tickets` (GET, DELETE).

| Propriété (libellé exact) | Type Notion | Valeurs |
|---|---|---|
| `Ticket` | Titre | Auto : `[Élément ciblé] · [60 premiers char du retour]` |
| `Statut` | Select | `À traiter`, `En cours`, `Traité`, `Résolu`, `Refusé` |
| `Action` | Select | les 9 actions listées plus haut |
| `Élément ciblé` | Texte (rich_text) | nom de l'élément annoté |
| `Page concernée` | Select | un des libellés `PAGE_MAP` (Dashboard, Communauté, etc.) |
| `Retour client` | Texte (rich_text) | texte complet du retour |
| `Date soumission` | Date | ISO 8601 |
| `Session ID` | Texte (rich_text) | UUID v4 |
| `URL` | URL | deep-link `https://app.notionclub.fr/page#anchor` |

### Base articles de blog (`NOTION_BLOG_DATABASE_ID`)

Consommée par `/api/blog-posts` (POST). C'est cette variable qui pointe sur la base jointe par l'administrateur.

| Propriété | Type Notion | Notes |
|---|---|---|
| `Titre` | Titre | |
| `Statut` | Select | `Brouillon`, `À relire`, `Publié`, `Archivé` |
| `Slug` | Texte | |
| `Extrait` | Texte | |
| `Catégorie` | Select | cf. `BLOG_CATEGORY_OPTIONS` (5 valeurs Swiss Serenity, non adaptées — cf. ambiguïté #3) |
| `Tags` | Multi-select | |
| `Image cover` | URL | |
| `Auteur` | Texte | défaut `""` (champ vide) côté UI |
| `Date de publication` | Date | |
| `Temps de lecture (min)` | Nombre | |
| `Meta description SEO` | Texte | validé 120-160 caractères côté UI |
| `Corps` | Texte | rich-text HTML produit par l'éditeur |

---

## ❓ Ambiguïtés ouvertes (à trancher par l'administrateur)

| # | Question | Options |
|---|---|---|
| 1 | **Variables d'env Notion** : fusionner `NOTION_TOKEN` (consommé par le widget) avec l'existant `NOTION_API_TOKEN` (Brique 4 — Notion sync, OPS-18) sur une seule intégration ? | A) Une intégration partagée. B) Deux intégrations distinctes. |
| 2 | **Base unique ou deux bases** : une seule base jointe par l'administrateur. Le widget original utilise 2 bases (feedback + blog). | A) Pointer uniquement `NOTION_BLOG_DATABASE_ID` dessus (le flow article suffit-il à la roadmap ?). B) Pointer `NOTION_DATABASE_ID` aussi (champs des 2 schémas coexistent dans la même base). C) Créer une 2e base dédiée aux flows feedback élément + général. |
| 3 | **`BLOG_CATEGORY_OPTIONS`** | Encore sur les 5 catégories Swiss-Serenity. À remplacer par les catégories de la roadmap NotionClub — liste à fournir. |
| 4 | **Gating admin** | Aujourd'hui le widget est visible pour TOUS les users authentifiés. Restreindre aux admins ? Si oui sur quel critère : rôle Supabase ? email allowlist ? env var ? |
| 5 | **Thème sombre** | La palette est désormais alignée sur le light theme NC. Le projet utilise `next-themes` ; l'apparence en mode dark n'a pas été ajustée. |
| 6 | **Routes dynamiques dans `PAGE_MAP`** | `/communaute/post/[id]`, `/ressources/ressource/[slug]`, `/ressources/template/[slug]` retombent sur `"Home"` dans Notion. Stratégie ? `usePathname` matchers à motifs ? |

---

## 📜 Journal des commits (branche `claude/analyze-feedback-popup-kz0Y4`)

| Hash | Description |
|---|---|
| `031c7d3` | **Extract** feedback widget from random-project for reintegration → `extracted-feedback-widget/` |
| `a4eed39` | **Integrate** feedback widget into src/ and document in context (mount + adaptations PAGE_MAP/imports) |
| `cc71346` | Add **absolute PR template rule** in CLAUDE.md (5-sections obligatoires) |
| `2da7513` | **Fix visual integration** with NotionClub tokens (1ère passe : bridge palette + icône Lucide + constantes Mireille → NC) |
| `b51a7e6` | **Harden palette** : hardcode color values (2e passe — élimine la dépendance aux tokens `@theme inline` de Tailwind v4 qui ne s'exposent pas tous au runtime) |

---

## 🚀 Comment continuer

### Pour valider visuellement le rendu actuel

```bash
git pull origin claude/analyze-feedback-popup-kz0Y4
# Stop & relance le dev server pour purger le cache CSS de Turbopack
npm run dev
# Puis hard refresh navigateur (Cmd+Shift+R / Ctrl+F5)
```

Le widget apparaît en bas à droite des pages `(app)/` (dashboard, communauté, coaching, ressources, settings). Sans variables d'env Notion configurées en local, les API routes renverront 500 mais l'UI elle-même doit s'afficher correctement (palette NC, texte lisible, icône Lucide dans le bouton).

### Pour brancher Notion en local

Créer `.env.local` à la racine avec :

```
NOTION_TOKEN=ntn_xxx_ou_secret_xxx
NOTION_BLOG_DATABASE_ID=c4209ec9-5e2b-4968-88c8-43e6c4672eda
NOTION_DATABASE_ID=                # ou même valeur, cf. ambiguïté #2
```

L'intégration Notion doit être connectée à la base avant que les API ne fonctionnent (cf. `docs/feedback-widget/README.md` § Branchements back).

### Pour trancher les ambiguïtés ouvertes

Reprendre la table « Ambiguïtés ouvertes » ci-dessus. Pour chacune, décider l'option et mettre à jour :
- le code (`FeedbackWidget.tsx` pour les constantes, `.env.example` pour les variables),
- ce document (`docs/feedback-widget/README.md` — retirer de la table, ajouter au journal),
- `.claude/context.md` — section « Outil de feedback admin (widget intégré) ».

### Pour publier en prod (une fois validé)

1. Vercel → Settings → Environment Variables → ajouter `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `NOTION_BLOG_DATABASE_ID` sur Production + Preview + Development.
2. Connecter l'intégration Notion à la base jointe.
3. Merger la PR #44 sur `main`.
4. Tester en preview avant production.

---

## 🔗 Liens utiles

- **Branche** : `claude/analyze-feedback-popup-kz0Y4`
- **PR** : https://github.com/Notion-Club/Infrastructure/pull/44
- **Base Notion roadmap (jointe)** : https://www.notion.so/gouman/c4209ec95e2b496888c843e6c4672eda
- **Source d'origine du widget** : `theogouman/random-project` branche `claude/setup-swiss-serenity-plus-Fm7s6`
- **Audit du dump source** : `extracted-feedback-widget/INTEGRATION.md`
- **Règle format PR** : `CLAUDE.md`
- **Contexte projet général** : `.claude/context.md`
