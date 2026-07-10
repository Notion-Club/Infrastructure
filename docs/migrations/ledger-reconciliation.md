# Réconciliation de l'historique des migrations — diagnostic & plan

> 🔴 **Sensible.** Document de travail pour review Nathan. **Aucune écriture DB n'a été faite** : diagnostic en lecture seule (`SELECT`, lecture de fichiers) + plan **non exécuté**.
>
> Décisions actées (Théo, 2026-06-21) intégrées ci-dessous. Le ticket sécurité dérivé est suivi séparément : **issue #196**.
>
> 🗄️ **Snapshot daté** : couvre les migrations jusqu'à `~042` alors que le repo va désormais jusqu'à `050` (+`039b`). Vérifier l'état réel avant d'agir sur cette base.

## TL;DR

- Le schéma réel est quasi identique partout : **99 % des objets existent sur prod et preview.** Le problème est le **ledger** (`supabase_migrations.schema_migrations`), pas le schéma.
- **Deux vrais écarts de schéma** seulement, prouvés :
  - 🔴 **Prod** : `037_avatars_storage_limit_25mb` **non appliquée** (bucket avatars encore à 5 MB).
  - 🔴 **Preview** : `042_drop_profiles_notion_email` **non appliquée** (colonne `notion_email` encore présente).
- Tout le reste = **migrations appliquées mais non enregistrées** → à marquer `applied` (écriture ledger pure, **aucun DDL**), après preuve d'existence de l'objet.
- **Stratégie retenue : fix minimal, pas de re-clé complet, aucun `revert`.** On accepte que `migration list` reste bruité sur les entrées en version timestamp. Le re-clé complet sera un chantier séparé, hors fenêtre de dev prod.

## Contraintes dures (rappel)

- ❌ Jamais `supabase db push`, `db reset`, ni rien qui rejoue/réinitialise l'historique global.
- ❌ Jamais rejouer le DDL d'une migration dont l'objet existe déjà.
- ✅ Réconciliation = marquer `applied` via `supabase migration repair --status applied <version>`, **uniquement après preuve que l'objet cible existe**.
- ❌ On ne touche jamais `user_has_capability` / `get_user_capabilities` ni aucune logique d'autorisation (le résidu de grants PUBLIC est traité hors de ce ticket → #196).
- ✅ Toute écriture ledger : **backup d'abord**, **preview d'abord (validé)**, **puis prod**.

---

## 1. Les trois sources

**Fichiers repo** (`supabase/migrations/`) : `001`→`042` + doublon de préfixe `040` (`040_billing_companies` + `040_notifications_archive`, ce dernier renommé `039b` par la PR #194). `043` arrive via PR #193.

**Ledger prod** (`mpxruqpmwtxakrtobndx`) : `001`–`015` en versions courtes, puis **bascule en versions timestamp** dès `016`. Track : `016, 017, add_resources_content_backup_column, 036, 038, 038b, notifications_archive, 040_billing_companies, 042`. **Saute `018`→`035`, `037`, `039`, `041`.**

**Ledger preview** (`mtucieghovawtailfony`) : `001`–`011` courtes, puis mélange timestamp + **deux blobs fourre-tout** `catchup_lot1_014_to_026` et `catchup_lot2_027_to_037`. Track aussi `012, 013, 035, 036, 038, 039, notifications_archive, billing_companies, 041`. **Ne track pas `042`.**

---

## 2. Diff à trois colonnes + preuve d'existence

Légende : ✅ tracké · ➖ non tracké · 🟦 couvert par un blob catchup · **obj✓ / obj✗** = objet réellement présent en base (vérifié par `SELECT`).

| Migration (fichier) | Prod ledger | Preview ledger | Objet prod | Objet preview | Verdict |
|---|---|---|---|---|---|
| 001–011 | ✅ courte | ✅ courte | ✓ | ✓ | OK |
| 012_channel_preferences | ✅ `012` | ✅ timestamp | ✓ | ✓ | OK |
| 013_role_alignment | ✅ `013` | ✅ timestamp | ✓ | ✓ | OK |
| 014_community_schema | ✅ `014` | 🟦 lot1 | ✓ | ✓ | Preview : marquer applied |
| 015_avatars_storage_limits | ✅ `015` | 🟦 lot1 | ✓ | ✓ | Preview : marquer applied |
| 016_formation_schema | ✅ timestamp | ✅ timestamp | ✓ | ✓ | OK (bruit timestamp accepté) |
| 017_formation_slugs | ✅ timestamp | ✅ timestamp | ✓ | ✓ | OK |
| **018→026** | ➖ | 🟦 lot1 | **obj✓** | ✓ | Prod **+** preview : marquer applied |
| **027→034** | ➖ | 🟦 lot2 | **obj✓** | ✓ | Prod **+** preview : marquer applied |
| 035_handle_new_user_google | ➖ | ✅ explicite (+lot2) | obj✓ | ✓ | Prod : marquer applied |
| 036_push_subscriptions | ✅ timestamp | ✅ timestamp | ✓ | ✓ | OK |
| **037_avatars_25MB** | ➖ | 🟦 lot2 | **obj✗ (5 MB)** | **obj✓ (25 MB)** | 🔴 Prod : **VRAI ÉCART** · Preview : marquer applied |
| 038_notifications | ✅ timestamp | ✅ timestamp | ✓ | ✓ | OK |
| 039_messages_realtime | ➖ | ✅ timestamp | **obj✓** | ✓ | Prod : marquer applied |
| 040_billing_companies | ✅ timestamp | ✅ timestamp | ✓ | ✓ | OK |
| 040_notifications_archive (→039b, PR #194) | ✅ `notifications_archive` | ✅ idem | ✓ | ✓ | OK |
| 041_harden_rpc_grants | ➖ | ✅ timestamp | **obj✓** | obj✓ | Prod : marquer applied |
| **042_drop_notion_email** | ✅ timestamp | ➖ | obj✓ (droppée) | **obj✗ (présente)** | 🔴 Preview : **VRAI ÉCART** |

### Détail des 2 vrais écarts (prouvés)

- **Prod / 037** : `storage.buckets.avatars.file_size_limit = 5242880` (5 MB) au lieu de `26214400` (25 MB). Migration jamais appliquée en prod. Impact applicatif : le code attend 25 MB (`AVATAR_MAX_BYTES`) → uploads avatars 5–25 MB rejetés par Storage en prod.
- **Preview / 042** : `profiles.notion_email` existe encore → `drop column` non appliqué.

### Note 041 (faux positif écarté)

La sonde naïve `has_function_privilege('anon', 'public.get_user_capabilities(uuid)', 'execute')` renvoyait `true` → laissait croire que 041 n'était pas appliquée. En inspectant les **ACL réelles** vs une fonction témoin (`get_user_top_emojis` porte `anon=X`, les cibles de 041 ne l'ont plus), **041 est bien appliquée** sur prod et preview. Le `=X` (PUBLIC) résiduel qui faisait passer la sonde à `true` est un **problème d'efficacité de 041**, traité hors de ce ticket → **issue #196**.

---

## 3. Entrées de ledger sans fichier repo

| Entrée ledger | Où | Ce qu'elle a fait | Fichier ? |
|---|---|---|---|
| `notifications_archive` | prod + preview | = `040_notifications_archive.sql` (préfixe perdu à l'enregistrement) | ✅ (→ 039b, PR #194) |
| `040_billing_companies` / `billing_companies` | prod / preview | = `040_billing_companies.sql` | ✅ |
| `add_resources_content_backup_column` | **prod only** | colonne `resources.content_backup` (obj✓ prod, obj✗ preview) | ❌ migration manuelle prod |
| `038b_notifications_revoke_anon_authenticated` | **prod only** | revoke anon/authenticated sur les 8 `notify_*` (triggers de 038) | ❌ |
| `catchup_lot1_014_to_026` | **preview only** | applique en bloc 014→026 | ❌ blob (fichiers individuels existent) |
| `catchup_lot2_027_to_037` | **preview only** | applique en bloc 027→037 | ❌ blob |

---

## 4. Cause racine

Le vrai problème n'est pas « des migrations manquent » — les objets existent. C'est que le **versionnage du ledger diverge des fichiers** : préfixes 3 chiffres dans les fichiers, mais bascule en **timestamps** dès 016 (prod) / 012 (preview), plus des blobs catchup côté preview. Même les migrations « trackées » ont donc une version ≠ celle déduite du nom de fichier → `migration list` les voit désynchronisées, et `db push` veut tout rejouer (et bute sur le doublon 040, cf. PR #194).

---

## 5. Plan de réconciliation — RETENU (non exécuté)

**Décision (a) : fix minimal. On marque `applied` uniquement les manquantes-mais-appliquées. Aucun `revert`** (faire mentir le ledger dans l'autre sens rouvre le risque de re-run sur push/reset). Le bruit sur les entrées timestamp est **assumé**. Re-clé complet = chantier séparé ultérieur.

**Décision (c) : les 2 seuls DDL du plan sont validés** — 037 prod (`UPDATE` idempotent) et 042 preview (`drop column` assumé).

**Décision (b) : numérotation des 2 fichiers prod-only** (`add_resources_content_backup_column`, `038b`) → tranchée avec Nathan **au moment d'exécuter**, non bloquant.

### Étape 0 — backup (les deux envs)

```sql
select * from supabase_migrations.schema_migrations order by version;
```
Exporté/sauvegardé avant toute écriture (table petite) pour restauration exacte.

### Preview d'abord (banc d'essai)

1. Marquer `applied` les versions préfixe manquantes (objets prouvés ✓) :
   `014, 015, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 028, 029, 030, 031, 032, 033, 034, 037`
   ```
   supabase migration repair --status applied 014 015 018 019 020 021 022 023 024 025 026 027 028 029 030 031 032 033 034 037
   ```
2. **Vrai écart 042** : appliquer le `drop column profiles.notion_email` (DDL réel, assumé, preview only), **puis** `repair --status applied 042`.
3. ⚠️ On **ne touche pas** aux blobs `catchup_lot1/lot2` ni aux entrées timestamp (pas de revert — décision a). Le ledger preview aura donc à la fois les blobs et les entrées préfixe : redondant mais inoffensif.
4. Vérifier : objets toujours là, app preview fonctionnelle.

### Prod ensuite (après validation preview + feu vert explicite)

1. Marquer `applied` les versions préfixe manquantes (objets prouvés ✓) :
   `018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 028, 029, 030, 031, 032, 033, 034, 035, 039, 041`
   ```
   supabase migration repair --status applied 018 019 020 021 022 023 024 025 026 027 028 029 030 031 032 033 034 035 039 041
   ```
2. **Vrai écart 037** : appliquer l'`UPDATE storage.buckets set file_size_limit = 26214400 where id = 'avatars'` (idempotent, non destructif), **puis** `repair --status applied 037`.
3. Les 2 migrations prod-only sans fichier (`add_resources_content_backup_column`, `038b`) : **créer les fichiers repo correspondants** (DDL idempotent — `add column if not exists` / `revoke`) pour aligner repo ↔ prod. Numérotation : décision (b), à l'exécution.
4. ⚠️ Aucun `revert` des entrées timestamp existantes (016, 017, 036, 038, 040, 042…). Bruit `migration list` assumé.

---

## 6. Ce que ce plan NE fait PAS

- Pas de re-clé complet du ledger (chantier séparé, hors fenêtre dev prod).
- Pas de `db push` / `db reset` / replay global.
- Pas de `revert` d'entrées existantes.
- Pas de modification de logique d'autorisation (résidu grants PUBLIC → issue #196).
- Indépendant de la migration 043 (PR #193), qui s'applique via `apply_migration` quel que soit l'état du ledger.

---

## 7. Pour Nathan — points à annoter

- [ ] Valider la liste des versions à marquer `applied` (preview et prod).
- [ ] Confirmer les 2 DDL : `UPDATE` avatars 25 MB (prod), `drop column notion_email` (preview).
- [ ] Trancher la numérotation des 2 fichiers prod-only (décision b).
- [ ] Confirmer qu'on assume le bruit `migration list` (pas de re-clé maintenant).
