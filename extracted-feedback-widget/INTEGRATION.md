# Feedback Widget — code isolé depuis `theogouman/random-project`

Source : branche `claude/setup-swiss-serenity-plus-Fm7s6` (projet Swiss Serenity Plus / Mireille).
Tout le code qui fait tourner le pop-up de feedback a été récupéré ici, prêt à être intégré dans `src/` selon `CONVENTIONS.md`.

## Ce que fait le widget

Bouton fixe en bas à droite → ouvre un hub modal avec **3 flows** :

1. **Feedback sur un élément** — sélection visuelle d'un élément de la page (mode inspection, overlay highlight + crosshair), action (`Modifier du texte`, `Ajouter une image`, etc.), texte libre. Génère une ancre `#id` vers l'élément.
2. **Feedback général** — feedback page entière sans sélection.
3. **Création d'article de blog** — formulaire complet (titre, slug auto, extrait, catégorie, tags, image cover, auteur, date pub, temps lecture, meta SEO 120-160 char, corps via éditeur rich-text). Cible une base Notion séparée.

En bonus, vue grille des tickets envoyés (lecture/suppression directe via l'API Notion).

## Fichiers isolés (10 fichiers, ~2 600 LOC)

| Fichier source dans random-project | Rôle |
|---|---|
| `app/components/FeedbackWidget/FeedbackWidget.tsx` (1208 l.) | Composant principal — toute la logique UI/state des 3 flows |
| `app/components/FeedbackWidget/FeedbackWidget.module.css` (550 l.) | Styles du hub modal, trigger, cartes, formulaires, tickets, toasts |
| `app/components/FeedbackWidget/FeedbackWidgetLoader.tsx` (8 l.) | Wrapper `dynamic(ssr:false)` — point de montage dans `layout.tsx` |
| `app/components/CustomSelect/CustomSelect.tsx` (156 l.) | Dépendance — select stylé custom |
| `app/components/CustomSelect/CustomSelect.module.css` (110 l.) | |
| `app/components/RichTextEditor/RichTextEditor.tsx` (117 l.) | Dépendance — éditeur contentEditable (gras / italique / listes / hr) |
| `app/components/RichTextEditor/RichTextEditor.module.css` (79 l.) | |
| `app/api/feedback/route.ts` (185 l.) | `POST` — crée 1 page Notion / feedback dans la DB "Retours site" |
| `app/api/tickets/route.ts` (128 l.) | `GET` liste / `DELETE` archive — même DB |
| `app/api/blog-posts/route.ts` (139 l.) | `POST` — crée 1 page dans la DB "Articles de blog" |

Référence : `_original-layout.tsx` (montre comment c'est branché chez Mireille) et `README-feedback.md` (doc d'origine : setup Vercel + Notion).

## Graphe de dépendances

```
app/layout.tsx
  └─ FeedbackWidgetLoader  (dynamic, ssr:false)
       └─ FeedbackWidget
            ├─ CustomSelect    (lucide: ChevronDown, Check)
            ├─ RichTextEditor  (lucide: Bold, Italic, List, ListOrdered, Minus)
            └─ fetch:
                 ├─ POST   /api/feedback     ──┐
                 ├─ GET    /api/tickets        │── Notion DB "Retours site"
                 ├─ DELETE /api/tickets?id=... │   (NOTION_DATABASE_ID)
                 └─ POST   /api/blog-posts  ──── Notion DB "Articles de blog"
                                                 (NOTION_BLOG_DATABASE_ID)
```

**Aucune dépendance npm cachée** — uniquement React + `lucide-react`. Les deux sont déjà dans Infrastructure (`lucide-react ^1.16.0`, React 19).

**Browser APIs utilisés** : `window.location`, `crypto.randomUUID()` — standards, pas de polyfill nécessaire.

## Variables d'environnement requises

| Variable | Utilisée par | Notes |
|---|---|---|
| `NOTION_TOKEN` | `feedback`, `tickets`, `blog-posts` | Token de l'intégration Notion |
| `NOTION_DATABASE_ID` | `feedback`, `tickets` | DB des retours/tickets |
| `NOTION_BLOG_DATABASE_ID` | `blog-posts` | DB des articles (fallback codé en dur si absent) |

⚠️ **Incohérence repérée** : le `README-feedback.md` d'origine parle de `NOTION_DATA_SOURCE_ID`, mais le code lit `NOTION_DATABASE_ID`. Le README est obsolète — c'est `NOTION_DATABASE_ID` qui prime.

## Schéma Notion attendu

**DB "Retours site"** : `Ticket` (title), `Statut` (select : `À traiter`/`En cours`/`Traité`/`Résolu`/`Refusé`), `Action` (select), `Élément ciblé` (rich_text), `Page concernée` (select), `Retour client` (rich_text), `Date soumission` (date), `Session ID` (rich_text), `URL` (url).

**DB "Articles de blog"** : `Titre` (title), `Statut` (select : `Brouillon`/`À relire`/`Publié`/`Archivé`), `Slug`, `Extrait`, `Catégorie` (select), `Tags` (multi_select), `Image cover` (url), `Auteur`, `Date de publication` (date), `Temps de lecture (min)` (number), `Meta description SEO`, `Corps`.

## Constantes à adapter pour NotionClub

Tout est en haut de `FeedbackWidget.tsx` :

- `PAGE_MAP` (l. 33-43) — table URL → libellé pour le champ "Page concernée". Actuellement mappé sur les pages Swiss Serenity Plus. À remplacer par `/dashboard`, `/login`, `/formation`, etc.
- `AVATAR_URL` (l. 30-31) — Cloudinary de Mireille, à remplacer par avatar Théo (ou logo NotionClub).
- `BLOG_CATEGORY_OPTIONS` (l. 18-24) — catégories métier Swiss Serenity, à revoir.
- `SITE_DOMAIN` (l. 28) — `"swiss-serenity-plus.ch"`, à passer à `"notionclub.fr"` (ou autre).
- `STATUS_COLORS` (l. 72-78) — palette `À traiter/En cours/...` — couleurs OK telles quelles, mais à aligner sur les tokens `--color-brand` etc. si on veut l'esprit pinkish du dashboard.

## Plan d'intégration dans Infrastructure (proposition)

Selon `CONVENTIONS.md` (modules isolés + shared) :

```
src/
  shared/components/feedback-widget/
    FeedbackWidget.tsx
    FeedbackWidget.module.css
    FeedbackWidgetLoader.tsx
    CustomSelect/
      CustomSelect.tsx
      CustomSelect.module.css
    RichTextEditor/
      RichTextEditor.tsx
      RichTextEditor.module.css
  app/
    api/
      feedback/route.ts
      tickets/route.ts
      blog-posts/route.ts
    layout.tsx          ← ajouter <FeedbackWidgetLoader />
```

Raison du `shared/` plutôt qu'un module `feedback/` : c'est un outil transversal (un bouton flottant accessible partout, pas un domaine métier).

Mises à jour de chemin nécessaires dans les fichiers une fois copiés :
- `FeedbackWidget.tsx` : `import CustomSelect from "../CustomSelect/CustomSelect"` et `import RichTextEditor from "../RichTextEditor/RichTextEditor"` restent valides si on garde la structure ci-dessus.
- `layout.tsx` : `import FeedbackWidgetLoader from "@/shared/components/feedback-widget/FeedbackWidgetLoader"`.

## Vérifs avant d'activer en prod

- [ ] Créer les 2 DBs Notion côté NotionClub (ou réutiliser celles existantes).
- [ ] Créer l'intégration Notion, lui donner accès aux 2 DBs.
- [ ] Ajouter `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `NOTION_BLOG_DATABASE_ID` dans Vercel (env Production + Preview).
- [ ] Adapter `PAGE_MAP` aux routes réelles du dashboard.
- [ ] Décider : widget toujours visible ou uniquement en `?debug` / pour les admins ? Aujourd'hui il est monté en dur dans `layout.tsx`.
- [ ] Tester avec `vercel dev` (voir `README-feedback.md`).
