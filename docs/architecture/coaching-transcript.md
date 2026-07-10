# Coaching — transcription hors-session (autorisation HMAC)

## Problème résolu

Sur la page `/coaching`, chaque appel passé porte un bouton « Demander à ChatGPT / Claude ». Au clic, l'IA suit une URL et lit la **transcription brute** de l'appel pour répondre à l'utilisateur.

Le hic : ChatGPT et Claude ne portent **pas** la session Supabase de l'utilisateur (pas de cookies, pas de header `Authorization`). Une route protégée par session classique renverrait donc `401` au browse tool de l'IA.

La solution : un **token HMAC signé côté serveur**. La possession du token vaut autorisation — pas besoin de session. Le token est généré au render de `/coaching` pour chaque appel passé du user, embarqué dans l'URL, et vérifié à chaque hit.

---

## 1. Route publique — `src/app/transcript/[token]/route.ts`

`GET /transcript/<token>` renvoie du `text/plain; charset=utf-8`.

Headers de réponse :

- `Cache-Control: no-store` — lecture live Notion à chaque hit, pour que l'admin puisse corriger une transcription et la voir répercutée immédiatement côté IA.
- `X-Robots-Tag: noindex, nofollow` — la page ne doit pas être indexée.

Déroulé :

1. `verifyTranscriptToken(token)` — si `!ok`, renvoie `401` avec un message générique (`"Lien invalide."`, ou `"Lien expiré. Reviens sur /coaching..."` pour le cas expiré uniquement).
2. `normalizeNotionId(callId)` → `fetchPageBlocks(callId)` → `filterNavBlocks(blocks)` → `blocksToPlainText(filtered)`.
3. Si le texte est vide : `"(Aucune transcription disponible pour cet appel.)"` en `200`.
4. En cas d'erreur Notion (token KO, page archivée) : `502` `"Transcript temporairement indisponible."` + `console.error`.

> **Note d'implémentation** : le chemin réel est `/transcript/<token>` (route publique, hors `/api/`). Ce choix est délibéré — d'après le commentaire de `coaching/server/queries.ts`, ChatGPT déclenche plus volontiers son browse tool sur une URL qui ressemble à une page web normale qu'à un endpoint `/api/...`. Plusieurs commentaires d'en-tête (dans `transcriptToken.ts` et la route elle-même) référencent encore l'ancien chemin `/api/coaching/transcript/[token]` : c'est un vestige, le chemin servi est bien `/transcript/[token]`.

---

## 2. Signature — `src/shared/lib/transcriptToken.ts`

Server-only. La clé secrète `TRANSCRIPT_SIGNING_KEY` ne doit jamais atteindre le navigateur.

### Format du token

```
base64url(callId.userId.exp) . base64url(HMAC-SHA256(payload, KEY))
```

- Payload = `` `${callId}.${userId}.${exp}` `` (séparateur `.` — aucun UUID Notion ne contient de point).
- Signature = HMAC-SHA256 du payload avec `TRANSCRIPT_SIGNING_KEY`.
- Les deux parties sont encodées en `base64url` et jointes par `.`.

### TTL

Fixe : **24 h** (`TTL_MS = 24 * 60 * 60 * 1000`). Au-delà, l'utilisateur doit recharger `/coaching` pour obtenir un nouveau token (le render serveur en régénère un).

### `signTranscriptToken(callId, userId)`

Calcule `exp = Date.now() + TTL_MS`, signe, renvoie le token. **Throw** si `TRANSCRIPT_SIGNING_KEY` est absente — le caller doit catcher pour dégrader proprement.

### `verifyTranscriptToken(token) → VerifyResult`

- Renvoie `{ ok: true, callId, userId, exp }` ou `{ ok: false, reason }` avec `reason ∈ { malformed, bad_signature, expired }`.
- Trois raisons distinctes pour les logs, mais message générique côté client (ne pas révéler si la signature est invalide vs expirée).
- Recalcule la signature attendue et compare avec **`timingSafeEqual`** (protection contre les attaques par timing). Vérifie d'abord l'égalité de longueur des buffers.
- Vérifie l'expiration (`Date.now() > exp`) **après** la validation de signature.
- Si la clé est absente à la vérification : renvoie `bad_signature` (même message générique).

---

## 3. Génération côté `/coaching` — `src/modules/coaching/server/queries.ts`

Au render serveur, pour chaque appel **passé** (les appels à venir n'ont pas de transcript) :

```ts
const token = signTranscriptToken(c.notionPageId, member.notionPageId);
view.transcript_url = `${getOrigin()}/transcript/${token}`;
```

Best-effort : si `TRANSCRIPT_SIGNING_KEY` est absente, `signTranscriptToken` throw → on log `console.error` et on laisse `transcript_url` à `undefined` → les boutons ChatGPT/Claude se masquent côté UI (pas de crash).

`getOrigin()` renvoie une URL absolue (`NEXT_PUBLIC_APP_URL` ou l'origine réelle) — indispensable, le browse tool des LLMs ne suit pas les URLs relatives.

---

## 4. Lecture live des blocs Notion

### `fetchPageBlocks` (via `shared/lib/notion/blocks.ts` → `router.ts`)

Le module `blocks.ts` est un ré-export du **routeur Notion unifié** (`shared/lib/notion/router.ts`), point d'entrée unique de récupération + normalisation du body d'une page Notion pour Formation, Coaching et Ressources.

### `filterNavBlocks` — `src/shared/lib/notion/filterNavBlocks.ts`

Retire les blocs de navigation en tête des pages d'appels Notion. Les pages créées par Théo dans la DB « Appel de suivi » commencent par un paragraphe « ↩ Revenir aux appels » (utile dans Notion, inutile ici).

Logique : si le 1er bloc est un paragraphe dont le texte (en minuscules) contient `"revenir aux appels"`, on le retire — plus le `divider` qui le suit éventuellement. Match permissif (avec ou sans flèche).

Partagé entre la route publique et la Server Action de la modale de détail (`getCallTranscriptionBlocks`).

### `blocksToPlainText` — `src/shared/lib/notion/blocksToPlainText.ts`

Convertit `NotionBlock[]` en texte markdown-light (headings `#`, listes `-`, citations `>`, code ```` ``` ````) lisible par un LLM sans parsing HTML. Délibérément simple, pas de tables ni de styles fins.

---

## 5. Deux chemins de lecture, deux modèles d'autorisation

Il existe **deux** points d'accès à la transcription d'un appel, avec des gardes différents :

| Chemin | Consommateur | Autorisation |
|---|---|---|
| Route publique `/transcript/[token]` | ChatGPT / Claude (browse tool) | Possession du token HMAC (pas de session) |
| Server Action `getCallTranscriptionBlocks(callPageId)` | Modale de détail, onglet Transcript (utilisateur connecté) | Session Supabase + vérification d'appartenance |

`src/modules/coaching/server/getCallTranscriptionBlocks.ts` ne se contente pas de fetch l'ID reçu du client : il résout la page Notion Membre de l'user courant (`ensureNotionMemberPage`, qui sert aussi de garde d'authentification), puis n'autorise le fetch que si `callPageId` figure dans les appels de ce membre (`fetchCallsForMember`). Sans ce contrôle, un user authentifié pourrait brute-forcer les UUIDs Notion d'appels d'autres membres (données sensibles : tactiques business, finances perso). Renvoie `not_authenticated` / `no_member_page` / `forbidden` / `notion_error`.

---

## 6. Bouton « Demander à ChatGPT / Claude » — `src/shared/components/coaching/CallDetailModal.tsx`

Le bouton n'est rendu que si `transcript_url` est défini. Il construit un prompt partagé pour Claude et ChatGPT (les deux ont un outil web qui fetche l'URL passée). Pour ChatGPT, `buildChatGPTUrl` force en plus l'activation du browse tool via le mode search (`hints=search`) et un chat éphémère.

---

## Configuration

`TRANSCRIPT_SIGNING_KEY` — générer via `openssl rand -hex 32`. **Ne pas** réutiliser `FILLOUT_SIGNING_KEY` (séparation des responsabilités, rotation indépendante). Voir [env-secrets.md](./env-secrets.md).
