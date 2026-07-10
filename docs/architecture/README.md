# Architecture back-end — index

Documentation de référence pour les briques back-end de l'infrastructure NotionClub : autorisation, coaching hors-session, administration, synchronisation Notion et secrets d'environnement.

Chaque document décrit la réalité du code au moment de sa rédaction et cite les chemins réels des fichiers concernés. Quand le code et un commentaire divergent, le document signale l'écart plutôt que de le masquer.

## Sujets

### [Autorisation & capabilities](./authorization-capabilities.md)
Le modèle d'autorisation `offers → memberships → capabilities → RLS/RPC`. C'est le point le mieux tenu du code : une source de vérité TypeScript unique (`capabilities.ts`), des colonnes booléennes sur `offers`, une fonction SQL `user_has_capability()` avec whitelist anti-injection, et une RPC `get_user_capabilities()` qui agrège les 8 droits en une passe. Le document décrit la chaîne complète et la procédure exacte pour ajouter une capability sans casser l'alignement TS ↔ SQL.

### [Coaching — transcription hors-session (HMAC)](./coaching-transcript.md)
Le flow qui permet à ChatGPT et Claude de lire la transcription d'un appel coaching sans porter la session Supabase de l'utilisateur. Autorisation par possession d'un token HMAC-SHA256 signé côté serveur (TTL 24h), route publique `text/plain`, lecture live des blocs Notion à chaque hit. Décrit la génération du token, sa vérification timing-safe, et le bouton « Demander à ChatGPT / Claude ».

### [Module admin](./admin.md)
Surface d'administration (page `/membres`, envoi de push broadcast). Documente la double garde admin — masquage UI + re-vérification serveur `role = 'admin'` — et la structure minimale du module (`server/` seul, pas d'`index.ts`/`types.ts`). C'est une surface sensible qui n'avait aucune documentation jusqu'ici.

### [Synchronisation Notion ↔ Supabase](./notion-sync.md)
Clarifie que le module `src/modules/notion-sync/` est une **coquille vide** (exports vides, sous-dossiers `.gitkeep`) et que la synchronisation Notion vit en réalité éparpillée dans les modules formation, ressources, coaching et `shared/lib/notion/*`, plus un webhook membres. Cartographie cette réalité et recommande de trancher : peupler le module ou le supprimer.

### [Secrets d'environnement](./env-secrets.md)
Inventaire des variables d'environnement, de leur rôle et de leurs fichiers consommateurs, recoupé avec `.env.example`. Signale les variables mortes (non consommées dans `src/`).
