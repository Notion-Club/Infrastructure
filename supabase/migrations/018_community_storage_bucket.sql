-- Migration 015 — Brique 2 (community) — bucket storage pour médias
-- Bucket `community` : stocke les images/vidéos/PDFs liés aux posts et
-- (futur) aux messages DM. Public en lecture (les images dans le feed sont
-- chargées par tous les viewers via une URL publique), écriture restreinte
-- par RLS au owner.
--
-- Path conventions (appliquées côté Server Actions, pas par DB) :
--   community/uploads/<user_id>/<timestamp>.<ext>   ← pré-upload depuis composer
--   community/posts/<post_id>/<filename>            ← (futur) attaché à un post
--   community/messages/<conv_id>/<filename>         ← (futur) PDF / image DM
--
-- ⚠️  Bucket PUBLIC en lecture : ne JAMAIS y écrire un fichier privé (PDFs
-- de DMs sensibles, etc.). Quand on aura les messages, on fera un bucket
-- séparé 'community-dm' privé avec signed URLs.

insert into storage.buckets (id, name, public)
values ('community', 'community', true)
on conflict (id) do nothing;

-- ============================================================================
-- RLS sur storage.objects (scopé bucket_id = 'community')
-- ============================================================================
-- L'user ne peut écrire que dans /uploads/<son user_id>/. Le serveur (Server
-- Action) sera responsable de "déplacer" / re-référencer après attachement
-- à un post — pour l'instant, il suffit d'autoriser l'upload dans uploads/<uid>.
--
-- Lecture : public (cf. bucket public=true + select-public-for-bucket ci-dessous).
-- Update/delete : owner uniquement (utile pour cleanup orphelins).

drop policy if exists community_insert_own on storage.objects;
create policy community_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community'
    and (storage.foldername(name))[1] = 'uploads'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists community_update_own on storage.objects;
create policy community_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'community'
    and (storage.foldername(name))[1] = 'uploads'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists community_delete_own on storage.objects;
create policy community_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community'
    and (storage.foldername(name))[1] = 'uploads'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists community_select_public on storage.objects;
create policy community_select_public
  on storage.objects for select to public
  using (bucket_id = 'community');
