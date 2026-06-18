-- =============================================================================
-- 041 — Durcissement des EXECUTE sur les fonctions SECURITY DEFINER
-- =============================================================================
-- Audit sécurité (E2 / M2 / F9 / F19) : plusieurs fonctions SECURITY DEFINER
-- conservaient le grant EXECUTE par défaut à `anon` ET `authenticated`,
-- contrairement au durcissement appliqué en migration 038 (triggers notify_*).
--
-- RÈGLE DE SÛRETÉ (vérifiée) : `user_has_capability` et les helpers
-- `current_profile_*` sont appelés DANS les expressions de policies RLS pour le
-- rôle `authenticated`. Leur retirer EXECUTE casserait l'évaluation RLS → on
-- NE retire JAMAIS `authenticated` sur ces fonctions. On retire `anon` partout
-- (énumération non authentifiée du statut payant/admin via /rest/v1/rpc), ce
-- qui est sans effet sur les flux légitimes (l'app appelle ces RPC en tant
-- qu'authenticated, jamais en anon).
--
-- get_user_capabilities : appelée par l'app en tant qu'authenticated → on garde
-- authenticated, on retire seulement anon.
--
-- Fonctions trigger (bump_user_emoji_stats, enqueue_dm_email_notification) :
-- exécutées par le mécanisme de trigger (pas par le rôle appelant) et non
-- appelables en RPC (retour trigger) → retrait anon + authenticated sans impact.

begin;

-- Fonctions trigger : retrait total (aucun appelant légitime).
revoke execute on function public.bump_user_emoji_stats()           from anon, authenticated;
revoke execute on function public.enqueue_dm_email_notification()   from anon, authenticated;

-- RPC appelée par l'app en authenticated : on retire uniquement anon.
revoke execute on function public.get_user_capabilities(uuid)       from anon;

-- Fonctions utilisées dans les policies RLS (rôle authenticated requis) :
-- on retire UNIQUEMENT anon, jamais authenticated.
revoke execute on function public.user_has_capability(uuid, text)   from anon;
revoke execute on function public.current_profile_role()            from anon;
revoke execute on function public.current_profile_org()             from anon;
revoke execute on function public.current_profile_admin_org()       from anon;
revoke execute on function public.current_profile_locked_fields()   from anon;

commit;
