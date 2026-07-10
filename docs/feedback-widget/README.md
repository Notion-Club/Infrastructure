# Outil de feedback admin — documentation technique

> Point d'entrée unique sur l'**outil de feedback admin** de NotionClub Infra :
> carte des fichiers, flows, routes API, schéma Notion et setup à effectuer.
> Document tenu à jour à partir du code réel — chaque affirmation est vérifiable
> dans `src/`.

---

## 1. Ce que c'est

Un outil interne, réservé aux administrateurs, qui permet d'annoter n'importe
quelle page connectée du dashboard et d'envoyer ces retours directement dans une
base Notion (la « roadmap »).

Objectif : raccourcir la boucle « je vois un truc à corriger → je le note dans
la roadmap », en capturant le contexte visuel (élément ciblé + URL avec ancre)
sans quitter la page.

---

## 2. Architecture — intégration à la DevToolbox

**Il n'y a plus de bouton flottant ni de hub modal.** L'ancienne version (reprise
du projet Swiss Serenity Plus) montait un gros bouton rond en bas à droite qui
ouvrait une modale à onglets. Ce n'est plus le cas.

Aujourd'hui, la section « retours » est **enregistrée dans le dropdown de la
DevToolbox** (le bouton clé à molette de la barre de navigation) :

- `FeedbackWidget.tsx` appelle `useRegisterFeedbackTools(<FeedbackToolboxPanel/>)`
  (hook exposé par `src/shared/components/dev/DevToolbox.tsx`) pour injecter son
  panneau tout en haut du dropdown.
- Le composant `FeedbackWidget` lui-même **ne rend plus que les overlays** :
  - le mode sélection d'élément (curseur crosshair + highlight animé),
  - la modale de saisie du retour (formulaire),
  - la confirmation de suppression d'un brouillon,
  - les toasts.
- Le panneau du dropdown (`FeedbackToolboxPanel.tsx`) porte l'UI de navigation :
  - **Page 1** — trois icônes : « Élément » (sélection visuelle), « Général »
    (page entière), « Tickets » (brouillons + retours envoyés).
  - **Page 2** — liste des brouillons en attente (+ bouton d'envoi) puis liste
    des tickets déjà envoyés à Notion.

Montage : `src/app/(app)/layout.tsx` rend `<FeedbackWidgetLoader />` à l'intérieur
du `DevToolboxProvider`. Le layout `(app)/` redirige vers `/login` si l'utilisateur
n'est pas authentifié ; l'accès effectif aux données reste verrouillé au niveau
des routes API (voir §6, gating admin).

---

## 3. Les 2 flows (+ vue tickets)

Le flow « Création d'article de blog » de la version d'origine a été **supprimé**
(plus de route `/api/blog-posts`, plus de `CustomSelect` ni `RichTextEditor`).
Il reste deux flows de feedback :

1. **Feedback sur un élément** — mode inspection. Clic sur l'icône « Élément » →
   curseur crosshair + overlay de highlight brand qui suit la souris → clic sur
   n'importe quel élément de la page. L'élément est identifié (libellé lisible
   déduit du tag / texte / `aria-label`, + ancre `#id` pour deep-link quand
   disponible). L'admin choisit ensuite :
   - une **action** parmi la liste (Modifier du texte, Ajouter du texte, Ajouter
     une image, Changer une couleur, Modifier la mise en page, Supprimer un
     élément, Ajouter un lien, Corriger une faute, Autre) — obligatoire dans ce
     flow ;
   - un **côté** concerné, Frontend ou Backend (optionnel) ;
   - le **texte** du retour.

   Le retour est empilé dans un brouillon local.

2. **Feedback général** — même formulaire, sans sélection d'élément (cible =
   « Page entière »). L'action devient optionnelle.

Plusieurs brouillons peuvent s'accumuler avant un envoi groupé (`sendAll` →
`POST /api/feedback`, un item Notion créé par retour).

**Vue « Tickets envoyés »** (page 2 du panneau) : lit les tickets existants via
`GET /api/tickets` et permet de les supprimer (archivage Notion) via
`DELETE /api/tickets`.

Les libellés d'action et de côté affichés ne sont pas figés : au montage, le
widget interroge `GET /api/feedback-schema` pour récupérer les vraies options
Notion et retombe sur des listes de secours (`ACTION_OPTIONS_FALLBACK`,
`END_OPTIONS_FALLBACK`) si l'appel échoue.

---

## 4. Fichiers réels

```
src/shared/components/feedback-widget/
├─ FeedbackWidget.tsx          ← état + overlays (sélection, form, toasts) ;
│                                 enregistre le panneau dans la DevToolbox
├─ FeedbackToolboxPanel.tsx    ← UI du dropdown (icônes + brouillons + tickets)
├─ FeedbackWidget.module.css   ← styles alignés sur les tokens NotionClub
├─ FeedbackWidgetLoader.tsx    ← wrapper dynamic(import, { ssr: false })
└─ types.ts                    ← types partagés Draft / NotionTicket

src/app/api/
├─ feedback/route.ts           ← POST   → crée les pages Notion
├─ tickets/route.ts            ← GET liste / DELETE archive
└─ feedback-schema/route.ts    ← GET options Select/multi_select de la base

src/shared/lib/auth/requireAdmin.ts   ← garde isRequestAdmin() partagée
src/shared/components/dev/DevToolbox.tsx ← host du dropdown + hooks d'enregistrement
src/app/(app)/layout.tsx              ← montage <FeedbackWidgetLoader />
```

Aucune référence à `CustomSelect`, `RichTextEditor` ou `api/blog-posts` :
ces éléments n'existent pas dans `src/`.

---

## 5. Schéma Notion réel (6 propriétés)

La base cible est la « ticket roadmap » jointe par l'administrateur. ID par défaut
**hardcodé** dans les 3 routes : `c4209ec9-5e2b-4968-88c8-43e6c4672eda`.

`POST /api/feedback` écrit exactement ces 6 propriétés (`feedback/route.ts`) :

| Propriété (libellé exact) | Type Notion    | Source côté code |
|---|---|---|
| `Composant`  | Select         | libellé de l'élément annoté (virgules retirées, clip 100 char) |
| `Action`     | Select         | l'action choisie (écrite seulement si présente) |
| `/End`       | **multi_select** | `Frontend` ou `Backend` (écrit seulement si présent) — **pas** un Select |
| `Feedback`   | rich_text      | texte du retour (clip 2000 char en property, débordement écrit en blocs paragraphes dans le corps de la page) |
| `User Agent` | rich_text      | header HTTP `user-agent` lu côté serveur (distinguer mobile / desktop) |
| `URL`        | url            | deep-link `origin + pathname [#ancre]` (écrit seulement si présent) |

Notes importantes :

- Le **titre** de la page Notion est laissé vide : la vue grille retombe sur le
  contenu de `Composant`.
- La notion de « page concernée » est calculée côté client (via `PAGE_MAP` +
  `PAGE_PREFIXES`) et concaténée au libellé de l'élément, mais **n'est pas**
  écrite dans une propriété Notion dédiée (elle n'existe pas dans le schéma).
- Notion **auto-crée** les options de Select / multi_select au premier write —
  pas besoin de seeder la base. Attention : les noms d'option de Select sont
  plafonnés à 100 caractères et ne peuvent pas contenir de virgule (le code
  nettoie `Composant` en conséquence).

`GET /api/feedback-schema` lit en sens inverse les options existantes de `Action`
(Select) et `/End` (multi_select) pour peupler le formulaire.

---

## 6. Routes API (3, toutes admin-gated)

Les trois routes sont fermées par la même garde `isRequestAdmin()`
(`src/shared/lib/auth/requireAdmin.ts`) : session Supabase valide **et**
`profiles.role = 'admin'`. Sinon → `403 Non autorisé`. Sans cette garde, un
anonyme pourrait spammer la base, lire le backlog interne ou archiver n'importe
quelle page Notion via le token privilégié.

| Route | Verbes | Rôle |
|---|---|---|
| `src/app/api/feedback/route.ts` | `POST` | Reçoit un batch de retours, crée une page Notion par retour. Réponses : `200` (tout créé), `207` (partiel — `created` / `failed`), `500` (tout a échoué / config manquante). |
| `src/app/api/tickets/route.ts` | `GET`, `DELETE` | `GET` : liste les pages non archivées de la base (sorted par `created_time` desc). `DELETE ?id=<uuid>` : archive une page — valide le format UUID **et** vérifie que la page appartient bien à la base cible avant d'archiver (défense en profondeur). |
| `src/app/api/feedback-schema/route.ts` | `GET` | Lit le schéma de la base et renvoie `{ action, end }` : options de la propriété Select `Action` et de la multi_select `/End`. Réponse mise en cache 60 s (`revalidate = 60`). |

Variables d'environnement communes aux 3 routes :

- `NOTION_API_TOKEN` — token de l'intégration NotionClub (déjà présent pour la
  Brique 4 « Notion sync »). Requis. Absence → `500`.
- `NOTION_DATABASE_ID` — **override optionnel**. Si défini, remplace l'ID par
  défaut (`c4209ec9-…`). Utile pour pointer sur une base de test en preview.

---

## 7. Setup Notion / Vercel

1. **Connecter l'intégration à la base.** Ouvrir la base « ticket roadmap » sur
   Notion → menu `...` → `Connections` → ajouter l'intégration liée à
   `NOTION_API_TOKEN`. **Sans cette étape, Notion renvoie un 404
   `object_not_found`** sur les 3 routes.
   - URL de la base :
     `https://www.notion.so/gouman/c4209ec95e2b496888c843e6c4672eda`
   - ID (UUID) : `c4209ec9-5e2b-4968-88c8-43e6c4672eda`
2. **Propriétés.** Vérifier que la base contient les 6 propriétés du §5 avec les
   bons types — en particulier `/End` en **multi_select** (pas Select). Les
   options de Select / multi_select sont auto-créées au premier write ; pas
   besoin de les pré-remplir.
3. **Vercel.** `NOTION_API_TOKEN` est déjà configuré (Production + Preview) via
   la Brique 4. Aucune nouvelle variable n'est requise. `NOTION_DATABASE_ID`
   reste dispo comme override optionnel (staging / base de test).
4. **Permissions de l'intégration.** La lecture des tickets (`GET /api/tickets`)
   et du schéma nécessite la capacité « Lire le contenu » sur l'intégration ;
   l'écriture (`POST /api/feedback`) nécessite « Insérer du contenu ».

---

## 8. Gating admin — implémenté

Le gating admin **est en place** (ce n'est plus une question ouverte) :

- Les 3 routes API sont verrouillées par `isRequestAdmin()` (Supabase +
  `profiles.role = 'admin'`).
- Le panneau de la DevToolbox est rendu pour tout utilisateur authentifié, mais
  ses appels réseau renvoient `403` pour un non-admin : aucune donnée Notion
  n'est ni lue ni écrite sans le rôle `admin`.

---

## 9. Points encore ouverts

- **Thème sombre** — le panneau toolbox lit déjà `useTheme` et adapte les
  badges de statut (variantes claires/sombres dans `STATUS_COLORS`). Le reste de
  la palette du widget est aligné sur le light theme NotionClub ; le rendu dark
  complet des overlays (form, toasts) n'a pas été audité de bout en bout.
- **Contexte de page** — `getCurrentPage()` couvre les routes connues via
  `PAGE_MAP` + `PAGE_PREFIXES` (préfixes `/formation`, `/communaute`, `/coaching`,
  `/ressources`, `/settings`, `/dashboard`). Les routes non prévues retombent sur
  « Accueil ». Cette information reste indicative côté UI et n'est pas persistée
  dans Notion.

---

## Sections de ce document

1. Ce que c'est · 2. Architecture (intégration DevToolbox, plus de bouton
flottant) · 3. Les 2 flows + vue tickets · 4. Fichiers réels · 5. Schéma Notion
(6 propriétés, `/End` en multi_select) · 6. Routes API (3, admin-gated via
`isRequestAdmin`) · 7. Setup Notion/Vercel · 8. Gating admin (implémenté) ·
9. Points encore ouverts.
