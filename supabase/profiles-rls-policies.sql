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
--    This is what makes self-service Sign Up work.
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- 3. A user can update their OWN row (name, avatar, etc. via Account Settings).
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 4. Admins can create a profile row for someone else
--    (Staff Manager → Add Worker).
create policy "Admins can insert any profile"
  on public.profiles for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Admin')
  );

-- 5. Admins can update ANY row (Staff Manager: suspend / ban / role changes).
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
