-- Real push notifications — delivered even when the browser/app is fully closed.
-- ---------------------------------------------------------------------------
-- This is a genuinely different mechanism from everything else in this app so
-- far. Every previous notification (sound, toast, unread badge, the browser
-- Notification popup) only works while a tab is open and connected to
-- Supabase Realtime — the moment the browser closes, that connection is gone
-- and nothing can reach the person anymore. A real push notification needs
-- something that can act on the recipient's behalf while THEY are offline:
-- that's what this file, together with the Edge Function in
-- supabase/functions/send-push/index.ts, sets up.
--
-- The pieces, in order:
--   1. A table holding each browser's push subscription (an endpoint URL +
--      encryption keys, issued by the browser itself when notification
--      permission is granted and the app subscribes).
--   2. A trigger that fires the instant a new message is inserted.
--   3. That trigger calls an Edge Function (a small server Supabase runs for
--      you) via an HTTP request, using the `pg_net` extension Supabase
--      provides for exactly this purpose — this is what makes "insert a row"
--      able to also "make something happen on a real server" a moment later.
--   4. The Edge Function looks up who should be notified, fetches their
--      saved push subscriptions, and asks the browser vendor's push service
--      (Chrome's, Firefox's, etc.) to deliver a notification to that device
--      — which works even if nobody has this app open anywhere.
--
-- REQUIRED SETUP beyond running this file — none of this works from SQL
-- alone, because "run a server function" and "deploy code" aren't things a
-- SQL script can do for you:
--   a) Generate a VAPID key pair on your own machine (never send your
--      private key anywhere, including to me): run `npx web-push
--      generate-vapid-keys` and keep both values.
--   b) Deploy the Edge Function in supabase/functions/send-push/ (see the
--      README in that folder for the exact commands).
--   c) Set three secrets on that function: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
--      and WEBHOOK_SECRET (a password you make up yourself — any long random
--      string works; it's what stops a stranger from calling your function
--      directly and spamming push notifications).
--   d) Replace the two placeholders below (YOUR_PROJECT_REF and
--      YOUR_WEBHOOK_SECRET) with your real values before running this file.
--   e) Add your VAPID public key as VITE_VAPID_PUBLIC_KEY in your GitHub
--      repo's Actions secrets (same place as your Supabase URL/key) — the
--      public key is safe to expose client-side, that's what "public" means
--      here, it's the private key that must never leave the Edge Function.
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

grant select, insert, delete on public.push_subscriptions to authenticated;

drop policy if exists "Users can manage their own push subscriptions" on public.push_subscriptions;

-- A person can register/unregister push on their OWN devices only. The Edge
-- Function itself doesn't go through this policy at all — it authenticates
-- with its own service-role credentials (automatically provided to every
-- Edge Function by Supabase) specifically so it CAN read any user's
-- subscriptions in order to deliver a push to them; that's a deliberately
-- different, more privileged context than a regular signed-in browser tab,
-- and is exactly why the function runs on a server you control, not client-side.
create policy "Users can manage their own push subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- The trigger. `pg_net` is a Supabase-provided extension for making HTTP
-- calls from inside Postgres — this is the one place a database action
-- reaches outside the database at all. The call is fire-and-forget
-- (asynchronous): inserting a message is never slowed down or blocked by
-- whether the push actually succeeds, and a push failure can never prevent
-- the message itself from sending.
-- ---------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;

-- If this project already had pg_net installed from before (some older Supabase
-- projects have it in a different schema), `create extension if not exists` above
-- will silently do nothing rather than move it — and the function call below would
-- then fail with "function extensions.http_post does not exist". If you hit that
-- specific error: Database → Extensions in your Supabase dashboard will show which
-- schema pg_net is actually in (commonly "net" on older projects) — adjust the
-- `extensions.http_post` call below to match (e.g. `net.http_post`) if so.

create or replace function public.notify_push_on_new_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform extensions.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'YOUR_WEBHOOK_SECRET'
    ),
    body := jsonb_build_object(
      'id', NEW.id,
      'chat_id', NEW.chat_id,
      'sender_id', NEW.sender_id,
      'sender_name', NEW.sender_name,
      'type', NEW.type,
      'content', NEW.content
    )
  );
  return NEW;
end;
$$;

drop trigger if exists on_new_message_send_push on public.messages;

create trigger on_new_message_send_push
  after insert on public.messages
  for each row execute function public.notify_push_on_new_message();
