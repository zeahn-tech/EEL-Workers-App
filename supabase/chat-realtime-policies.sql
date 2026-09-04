-- Real cross-device chat storage for public.messages and public.groups
-- ---------------------------------------------------------------------------
-- Run this in your Supabase project's SQL Editor. Safe to re-run any time.
--
-- Why this exists: chat messages and group channels previously lived ONLY in
-- each browser's own localStorage — a deliberate original shortcut, but one
-- with a real consequence: two different devices logged into the same account
-- saw two completely separate conversation histories, and there was no way
-- for one person's browser to know a message was sent from somewhere else at
-- all. This migration moves messages and groups into real Supabase tables
-- with Realtime subscriptions, which is what makes genuine cross-device sync
-- (and in-app notifications for messages from other people/devices) possible
-- at all. Supabase Storage (chat-media, from an earlier migration) already
-- holds the actual file/image/voice bytes — these tables just hold the
-- message metadata and a link to that media, exactly like before.
--
-- IDs are TEXT rather than UUID on purpose: group ids are simple client-
-- generated strings (e.g. "group-1699999999"), and this keeps both local
-- mode and Supabase mode generating ids the exact same way, so the rest of
-- the app's code doesn't need two different id schemes depending on mode.
-- ---------------------------------------------------------------------------

create table if not exists public.groups (
  id text primary key,
  name text not null,
  description text default '',
  members text[] not null default '{}',
  avatar text default '',
  initials text default '',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key,
  chat_id text not null,
  sender_id text not null,
  sender_name text not null,
  content text default '',
  type text not null default 'text',
  file_data jsonb,
  image_data jsonb,
  location jsonb,
  audio_data jsonb,
  status text default 'sent',
  edited boolean not null default false,
  deleted boolean not null default false,
  timestamp timestamptz not null default now()
);

create index if not exists messages_chat_id_idx on public.messages (chat_id);
create index if not exists messages_timestamp_idx on public.messages ("timestamp");

-- Base-level table grants — a different, more fundamental layer than RLS. RLS policies
-- decide WHICH ROWS a role can see or touch; without these GRANT statements, Postgres
-- rejects the `authenticated` role before ever reaching RLS at all, for EVERY operation,
-- with exactly the error this fixes: "permission denied for table <name>". This is a very
-- easy step to forget when creating tables by hand in the SQL Editor (the Table Editor UI
-- sets this up automatically; a raw CREATE TABLE here does not) — worth remembering for
-- any future table added this same way.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

alter table public.groups enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Groups are viewable by authenticated users" on public.groups;
drop policy if exists "Admins can create groups" on public.groups;
drop policy if exists "Admins can update groups" on public.groups;
drop policy if exists "Admins can delete groups" on public.groups;

-- Every group channel is visible to every signed-in staff member, same as the app's
-- existing behavior in local mode today — group membership lists are informational
-- (who's expected in the channel), not an access gate. Only Admins can create, rename,
-- or change membership/delete a group, matching the Admin-only Staff Manager → Groups UI.
create policy "Groups are viewable by authenticated users"
  on public.groups for select
  to authenticated
  using (true);

create policy "Admins can create groups"
  on public.groups for insert
  to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin'));

create policy "Admins can update groups"
  on public.groups for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin'));

create policy "Admins can delete groups"
  on public.groups for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin'));

drop policy if exists "Users can read their own messages" on public.messages;
drop policy if exists "Users can send their own messages" on public.messages;
drop policy if exists "Users can edit or delete their own messages" on public.messages;

-- A message is visible to: the person who sent it, the recipient of a direct message
-- (a DM's chat_id IS the recipient's user id — see ChatContext.jsx), or anyone at all if
-- the chat_id belongs to a real group (group channels are open to every staff member, so
-- their messages are too — this deliberately does NOT restrict to the group's `members`
-- array, matching the exact behavior this app already has in local mode). This is the one
-- place real privacy genuinely matters: without the DM branch here, any signed-in user
-- could query this table directly and read everyone else's private conversations, which
-- was never actually possible before only because local mode's storage never left each
-- person's own browser — moving to a shared table makes this a real, not theoretical, risk.
create policy "Users can read their own messages"
  on public.messages for select
  to authenticated
  using (
    sender_id = auth.uid()::text
    or chat_id = auth.uid()::text
    or exists (select 1 from public.groups g where g.id = messages.chat_id)
  );

create policy "Users can send their own messages"
  on public.messages for insert
  to authenticated
  with check (sender_id = auth.uid()::text);

-- Covers both self-service edit (content + edited flag) and self-service soft-delete
-- (deleted flag + cleared content) — both already restricted to the sender in the app's
-- own logic (ChatContext.jsx), enforced here too rather than trusted client-side only.
create policy "Users can edit or delete their own messages"
  on public.messages for update
  to authenticated
  using (sender_id = auth.uid()::text)
  with check (sender_id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Realtime: makes INSERT/UPDATE events on these tables actually broadcast to
-- subscribed clients, which is what powers live cross-device message delivery
-- and in-app notifications. Safe to re-run — Postgres just no-ops if a table
-- is already in the publication.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'groups'
  ) then
    alter publication supabase_realtime add table public.groups;
  end if;
end $$;
