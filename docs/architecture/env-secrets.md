# Secrets & variables d'environnement

Inventaire des variables d'environnement, de leur rôle et de leurs fichiers consommateurs, recoupé avec `.env.example`. Le préfixe `NEXT_PUBLIC_` = variable exposée au bundle client ; toute autre est server-only.

> Convention de génération pour les secrets partagés (`CRON_SECRET`, `NOTION_WEBHOOK_SECRET`, clés de signature) : `openssl rand -hex 32`.

---

## Supabase

| Variable | Rôle | Consommée dans |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | `shared/lib/supabase/{client,server,admin}.ts`, `proxy.ts`, `modules/auth/server/actions.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon (RLS appliquée) | idem ci-dessus |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role — **bypass RLS**, à protéger comme un mot de passe | `shared/lib/supabase/admin.ts` (`createSupabaseAdminClient`) |

Deux projets : un Preview (dev) et un Production. Le service_role n'est instancié qu'après un contrôle d'autorisation (cf. module admin).

---

## Notion

| Variable | Rôle | Consommée dans |
|---|---|---|
| `NOTION_API_TOKEN` | Token de l'intégration Notion (lecture/écriture). Unique token partagé par tous les flows Notion | `shared/lib/notion/client.ts`, `modules/ressources/lib/notion.ts`, routes `/api/feedback`, `/api/tickets`, `/api/feedback-schema`, `/api/payments/me` |
| `NOTION_WEBHOOK_SECRET` | Secret HMAC-comparé (temps constant) du webhook membres. Généré par nous, configuré côté Vercel **et** dans l'automation Notion | `app/api/notion-webhooks/members/route.ts` |
| `NOTION_MEMBERS_DATABASE_ID` | DB Notion Membres (mapping UUID Supabase ↔ page Notion, créée au signup). Absente = étape Notion skippée silencieusement | `shared/lib/notion/write.ts` |
| `NOTION_CALLS_DATABASE_ID` | DB Notion « Appels de suivi » (lecture live par `/coaching`). Absente = sections appels vides (best-effort) | `modules/coaching/server/notion.ts` |
| `NOTION_DATABASE_ID` | Override optionnel de la base feedback/tickets (« ticket roadmap »). Sinon fallback sur l'ID hardcodé `c4209ec9-...` | routes `/api/feedback`, `/api/tickets`, `/api/feedback-schema` |

---

## Cron

| Variable | Rôle | Consommée dans |
|---|---|---|
| `CRON_SECRET` | Secret partagé pour authentifier les appels machine (`Authorization: Bearer <CRON_SECRET>`) sur les routes cron/sync | `app/api/cron/send-dm-emails/route.ts`, `app/api/formation/sync/route.ts`, `app/api/ressources/sync/route.ts`, `app/api/push/send/route.ts` |

---

## Web Push (VAPID)

Générer une fois : `npx web-push generate-vapid-keys`. Consommées dans `src/shared/lib/push/vapid.ts` (et `usePushSubscription.ts` côté client via la clé publique).

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clé publique exposée au navigateur (`PushManager.subscribe({ applicationServerKey })`) |
| `VAPID_PRIVATE_KEY` | **Server-only** — signe chaque push envoyé |
| `VAPID_SUBJECT` | Point de contact (`mailto:` ou `https://`). **Fallback hardcodé** sur `mailto:theo@gouman.fr` si absente (`vapid.ts` ligne 31) |

Sans `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`, le toggle Push dans Réglages est désactivé proprement côté UI (`reason: "no_vapid_key"`).

---

## Transcription coaching (HMAC)

| Variable | Rôle | Consommée dans |
|---|---|---|
| `TRANSCRIPT_SIGNING_KEY` | Clé HMAC-SHA256 signant les tokens des URLs publiques de transcription (TTL 24h). **Ne pas** réutiliser `FILLOUT_SIGNING_KEY` | `shared/lib/transcriptToken.ts` (throw si absente → boutons ChatGPT/Claude masqués) |

Voir [coaching-transcript.md](./coaching-transcript.md).

---

## Emails (Resend)

| Variable | Rôle | Consommée dans |
|---|---|---|
| `RESEND_API_KEY` | Clé API Resend (emails transactionnels) | `modules/auth/server/email.ts`, `modules/community/server/dm-email.ts` |
| `RESEND_REPLY_TO_EMAIL` | Adresse `Reply-To` des envois. **Fallback** hardcodé `theo@gouman.fr` si absente | `modules/auth/server/email.ts`, `modules/community/server/dm-email.ts` |
| `RESEND_FROM_EMAIL` | Adresse d'expéditeur *souhaitée* (`noreply@notionclub.fr`) | ⚠️ **Non consommée** : `email.ts` hardcode l'adresse `from` en attendant la vérification du domaine (cf. commentaire ligne 71 « une fois vérifié, basculer sur noreply@notionclub.fr »). Variable présente dans `.env.example` mais inerte à ce jour |

---

## App & Fillout

| Variable | Rôle | Consommée dans |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | URL canonique. Absente en preview → fallback sur l'origine réelle de la requête | `shared/lib/origin.ts`, `modules/auth/server/{email,actions}.ts`, `modules/settings/server/actions.ts`, `modules/community/server/dm-email.ts` |
| `NEXT_PUBLIC_FILLOUT_COACHING_URL` | URL du formulaire Fillout coaching (params id/mail/prenom/nom ajoutés au clic Réserver). Vide → fallback URL coaching | `shared/lib/mock/fillout.ts` |
| `NEXT_PUBLIC_FILLOUT_SALES_URL` | URL du formulaire Fillout sales | `shared/lib/mock/fillout.ts` |
| `FILLOUT_API_KEY` | Clé API Fillout (server-only, scripts admin éventuels) | Non consommée dans `src/` — réservée pour usage futur/debug (documentée dans `.env.example`) |
| `FILLOUT_SIGNING_KEY` | Clé de signature Fillout | Non consommée dans `src/` à ce jour |

---

## Variables mortes / inertes

À nettoyer ou à statuer :

| Variable | Statut |
|---|---|
| **`NOTION_BLOG_DATABASE_ID`** | **Morte** — aucune référence dans `src/` (uniquement dans `.env.example`). Vestige du flow blog supprimé du widget feedback. À retirer de `.env.example` |
| `RESEND_FROM_EMAIL` | Inerte — présente dans `.env.example` mais l'adresse `from` est hardcodée dans le code en attendant la vérification du domaine |
| `FILLOUT_API_KEY` / `FILLOUT_SIGNING_KEY` | Non consommées dans `src/` — réservées à des scripts admin/debug futurs |

Vérification effectuée par recherche de chaque nom de variable dans `src/` (2026-07-10).
