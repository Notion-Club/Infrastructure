-- Migration 028 — Brique Community — Transfert de message DM
--
-- Date    : 2026-06-02
-- Auteur  : Notion Club Infra
-- Module  : community (DM 1-1)
--
-- Pitch
-- -----
-- L'UX cible DM ajoute "Transférer" dans le kebab : on peut renvoyer un
-- message à 1 à 5 autres conversations (créées à la volée si nécessaire).
-- Le destinataire voit un badge "Transféré de [Auteur original]" au-dessus
-- du body.
--
-- Stockage : 2 colonnes dénormalisées (forwarded_from_message_id +
-- forwarded_from_author_name) sur messages — même pattern que quote-reply
-- (mig. 027) pour les mêmes raisons (survie à la suppression / édition de
-- l'original, pas de jointure au render).
--
-- Pourquoi forwarded_from_author_name plutôt qu'une FK sur profiles ?
-- ----------------------------------------------------------------------------
-- Si l'auteur original est supprimé (RGPD), le badge afficherait "Membre
-- supprimé" — pas grave en soi mais ça casse l'attribution historique pour
-- les autres receveurs du même message. Snapshot du nom = solution la plus
-- respectueuse du contexte conversationnel.
--
-- Limites côté action serveur (forwardMessageAction) :
--   - Max 5 destinataires par appel (anti-spam).
--   - Capability check : can_view_community sur le caller.
--   - Two-silo check : la conversation cible doit matcher le tier du target
--     (RLS conversations_insert_with_two_silo, mig. 024).
-- =============================================================================

begin;

alter table public.messages
  -- FK soft : ON DELETE SET NULL pour conserver le badge "Transféré" même
  -- si l'original disparaît. Le badge utilise forwarded_from_author_name
  -- dénormalisé, donc l'ID seul ne sert qu'à un éventuel deep-link futur.
  add column if not exists forwarded_from_message_id uuid
    references public.messages(id) on delete set null,
  -- Nom de l'auteur original figé au moment du forward. Affiché dans le
  -- badge "Transféré de [Nom]".
  add column if not exists forwarded_from_author_name text;

comment on column public.messages.forwarded_from_message_id is
  'FK soft vers le message d''origine du transfert. ON DELETE SET NULL pour '
  'préserver le badge si l''original est hard-deleted. Le rendu utilise '
  'forwarded_from_author_name dénormalisé.';

comment on column public.messages.forwarded_from_author_name is
  'Nom de l''auteur du message transféré, figé au moment du forward. Affiché '
  'dans le badge "Transféré de [Nom]" au-dessus du body. Survit à la '
  'suppression du profil source.';

-- Contrainte d'intégrité : les 2 colonnes vont par paire (NULL ou NOT NULL
-- ensemble). Évite les états type "FK sans nom" ou "nom sans FK".
alter table public.messages
  drop constraint if exists messages_forward_consistency;

alter table public.messages
  add constraint messages_forward_consistency check (
    (forwarded_from_message_id is null and forwarded_from_author_name is null)
    or (forwarded_from_author_name is not null)
  );

-- Note : on autorise forwarded_from_author_name NOT NULL avec FK NULL
-- (le snapshot survit même si l'original disparaît). C'est le but de la
-- dénormalisation.

-- Index : "qui a transféré ce message ?" — utile pour des stats virales
-- futures et pour invalidation cache si besoin. WHERE clause = index partiel.
create index if not exists messages_forwarded_from_idx
  on public.messages (forwarded_from_message_id)
  where forwarded_from_message_id is not null;

-- Pas de RLS dédiée — colonnes héritent des policies messages existantes.

commit;
