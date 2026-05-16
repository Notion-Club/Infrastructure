-- Seed exécuté après `supabase db reset` en local/preview.
-- Doit rester IDEMPOTENT : utilisable plusieurs fois sans casser.

-- ----------------------------------------------------------------------------
-- Organisation racine
-- ----------------------------------------------------------------------------
insert into public.organizations (slug, name)
values ('notion-club', 'Notion Club')
on conflict (slug) do nothing;
