create table if not exists public.slack_archive (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id),
  slack_channel        text not null,
  slack_message_ts     text not null,
  slack_user_id        text,
  author_profile_id    uuid references public.profiles(id) on delete set null,
  author_display_name  text,
  body                 text,
  thread_ts            text,
  is_thread_reply      boolean not null default false,
  posted_at            timestamptz not null,
  has_files            boolean not null default false,
  files                jsonb,
  raw                  jsonb,
  imported_at          timestamptz not null default now(),
  constraint slack_archive_channel_ts_key unique (slack_channel, slack_message_ts)
);

create index if not exists slack_archive_author_idx on public.slack_archive (author_profile_id);
create index if not exists slack_archive_channel_posted_idx on public.slack_archive (slack_channel, posted_at);

comment on table public.slack_archive is
  'Archive historique des messages Slack (migration communauté). Lecture seule, admin-only. Écriture via service_role uniquement (import script).';

alter table public.slack_archive enable row level security;

drop policy if exists "slack_archive_admin_read" on public.slack_archive;
create policy "slack_archive_admin_read" on public.slack_archive
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
