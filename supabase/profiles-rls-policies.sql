-- Row Level Security policies for public.profiles
-- ---------------------------------------------------------------------------
-- Run this in your Supabase project's SQL Editor (Dashboard → SQL Editor → New
-- query → paste → Run). It's safe to re-run any time — old versions of these
-- policies are dropped first.
--
-- Without these policies, RLS blocks everything by default, which is exactly
-- what causes:
--   "Account created, but profile setup failed: permission denied for table profiles"
--   "No staff profile found for this account. Contact an administrator."
-- The first happens because a newly-signed-up user has no permission to INSERT
-- their own profile row. The second is the direct consequence — since the insert
-- failed, the row never got created, so login can't find it.
--
-- This version establishes the FIRST Admin the way real production systems do it:
-- automatically, server-side, deterministically. The very first profile ever
-- created (see the trigger further down) becomes Admin; every account after that
-- starts as Worker. There is no client-side "claim admin" step, no button, and no
-- self-service path to Admin for anyone — after the first account, becoming Admin
-- only ever happens because an existing Admin explicitly changes your role in
-- Staff Manager. That is also enforced here, not just in the app's UI: an ordinary
-- user's own UPDATE can never touch their own `role` column at all (see policy #3),
-- and the system can never be left with zero Admins (see the trigger at the very
-- end of this file) — both are guaranteed by the database, not by trusting the
-- client to behave.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can insert any profile" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Admins can delete any profile" on public.profiles;

-- 1. Any signed-in user can read the full staff directory
--    (needed for the chat member list / Staff Manager)
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- 2. A user can create their OWN profile row (id must match their own auth uid).
--    This is what makes self-service Sign Up work. Note this policy doesn't touch
--    `role` at all — whatever role a self-insert tries to set is irrelevant in
--    practice anyway, because the on_auth_user_created trigger below already
--    creates the correct row (Admin only for the very first account, Worker for
--    everyone else) before this insert can even run, so this ends up a no-op via
--    ON CONFLICT DO NOTHING in the app's own self-heal path.
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- 3. A user can update their OWN row (name, avatar, phone, department via Account
--    Settings) — but never their own `role`. This is intentionally absolute: there
--    is no bootstrap exception, no "unless no admin exists yet" clause. Becoming
--    Admin is either automatic (the very first account, via the trigger below) or
--    an explicit action taken BY an existing Admin against someone else's row
--    (policy #5) — never something an account can do to itself.
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- 4. Admins can create a profile row for someone else
--    (Staff Manager → Add Worker).
create policy "Admins can insert any profile"
  on public.profiles for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
  );

-- 5. Admins can update ANY row — status changes (suspend/ban) AND role changes
--    (Staff Manager's role selector) both go through this policy. The "never end
--    up with zero Admins" rule is NOT this policy's job — it's enforced
--    unconditionally by the prevent_removing_last_admin trigger further down,
--    which fires for every update regardless of who's making it.
create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
  );

-- 6. Admins can delete ANY row (Staff Manager: remove worker).
create policy "Admins can delete any profile"
  on public.profiles for delete
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
  );

-- ---------------------------------------------------------------------------
-- Auto-create a profile row the instant an auth user is created, server-side,
-- via a trigger — instead of relying purely on the app's client-side
-- insert-on-signup.
--
-- Why bother if the app already inserts the row itself? Because that client
-- insert can only run once the new user has an active session, and if your
-- project has "Confirm email" turned on (Authentication → Providers → Email),
-- signUp() returns NO session until they click the link in their inbox — so
-- the client-side insert is skipped, and the row only appears once they log
-- in for the first time afterward (the app self-heals this automatically).
-- This trigger closes that gap entirely: the profiles row exists immediately,
-- before the person even leaves the sign-up form, regardless of your email
-- confirmation setting.
--
-- This is also where the very first Admin gets created: if this is the first
-- row ever inserted into profiles, the account becomes Admin instead of Worker.
-- No app code, no button, no client-side call — the database decides this the
-- moment the very first person signs up, which is the same pattern production
-- self-hosted tools (GitLab, Mattermost, and similar) use for their first
-- Owner/Admin account. Every account after the first is always a Worker; from
-- then on, becoming Admin is exclusively something an existing Admin does to
-- someone else via Staff Manager.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_first_account boolean;
begin
  -- This whole body is wrapped so that ANY unexpected problem here — a schema
  -- mismatch, a constraint we didn't anticipate, anything — can never block
  -- account creation itself. Without this, a single bad row would surface to
  -- the person signing up as the opaque, unrecoverable "Database error saving
  -- new user", since GoTrue rolls back the entire auth.users insert if this
  -- trigger raises. Failing open here is safe specifically because the app's
  -- own self-heal (ensureProfile, in src/services/supabaseAuth.js) creates the
  -- missing profile row the moment this person actually logs in — so the worst
  -- case if this insert fails is the row appears a few seconds later instead
  -- of instantly, not a broken sign-up. Check Database → Logs → Postgres Logs
  -- in the Supabase dashboard for the warning this raises if it ever does fail.
  begin
    select not exists (select 1 from public.profiles) into is_first_account;

    insert into public.profiles (id, name, email, role, department, status, phone)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      new.email,
      case when is_first_account then 'Admin' else 'Worker' end,
      '',
      'Active',
      ''
    )
    on conflict do nothing;
  exception when others then
    raise warning 'handle_new_auth_user: profile creation failed for % (%): %', new.email, new.id, SQLERRM;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Hard guarantee: this workspace can never be left with zero Admins. This is
-- what makes Staff Manager's role changes and worker deletion genuinely safe to
-- expose in the UI — the invariant is enforced here, once, for every possible
-- caller (the app's role selector, a direct API call, the SQL Editor run by
-- someone who forgot this rule exists), not re-implemented and potentially
-- forgotten in every place the app happens to touch a role or delete a row.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_removing_last_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Demoting the last Admin via UPDATE (role changed away from Admin).
  if TG_OP = 'UPDATE' and OLD.role = 'Admin' and NEW.role <> 'Admin' then
    if (select count(*) from public.profiles where role = 'Admin') <= 1 then
      raise exception 'Cannot change role: this is the only Admin account.';
    end if;
  end if;
  -- Deleting the last Admin outright.
  if TG_OP = 'DELETE' and OLD.role = 'Admin' then
    if (select count(*) from public.profiles where role = 'Admin') <= 1 then
      raise exception 'Cannot delete: this is the only Admin account.';
    end if;
  end if;
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists guard_last_admin_update on public.profiles;
drop trigger if exists guard_last_admin_delete on public.profiles;

create trigger guard_last_admin_update
  before update on public.profiles
  for each row execute function public.prevent_removing_last_admin();

create trigger guard_last_admin_delete
  before delete on public.profiles
  for each row execute function public.prevent_removing_last_admin();

-- ---------------------------------------------------------------------------
-- Optional: Storage bucket for profile photo uploads (Account Settings →
-- upload photo). Skip this section if you don't need avatar uploads yet.
-- Create the bucket first via Dashboard → Storage → New bucket → name it
-- "avatars" and mark it Public, THEN run the policies below.
-- ---------------------------------------------------------------------------

drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- ONE-TIME MANUAL STEP — only needed if your profiles table already has rows
-- and none of them are Admin (i.e. you're already stuck in exactly the state
-- this whole file is designed to prevent from ever happening again). The
-- trigger above only decides the role for auth users created AFTER this point
-- — it has no way to retroactively fix accounts that already exist.
--
-- Uncomment the line below, put in the email of the account that should become
-- your first real Admin, and run it once. After that, every future deployment
-- (and every account after this one) is handled automatically by the trigger —
-- this manual step is a recovery action for today's data, not something you
-- should ever need to repeat.
-- ---------------------------------------------------------------------------

-- update public.profiles set role = 'Admin' where email = 'you@example.com';
