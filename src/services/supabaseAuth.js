// Real backend auth + staff-directory access against Supabase, used when a project
// URL + anon key are configured in Admin Settings. Chat messages/groups intentionally
// stay on local storage (see context/ChatContext.jsx) — only accounts/login are backed
// by Supabase per the current setup.
//
// Expects the `public.profiles` table described in supabaseClient.js's schema comment,
// with `id` matching the corresponding auth.users id (auth.uid()).
//
// Required for this to work against your project:
//  - Row Level Security policies on `profiles` that allow:
//      - any authenticated user to SELECT all rows (needed for the staff directory /
//        chat member list)
//      - a newly signed-up user to INSERT their own row where id = auth.uid() (needed
//        for self-service Sign Up — this runs as that new user, not as an admin)
//      - a user to UPDATE their own row (self-service name/avatar edits — password and
//        email changes go through Supabase Auth directly, not this table)
//      - Admin-role users to UPDATE/DELETE any row (staff management)
//  - A trigger (or this code's upsert-on-signup) that creates a `profiles` row when a
//    new auth user is created, defaulting role to 'Worker'.
//  - A public Storage bucket named `avatars` if you want profile photo uploads, with
//    a policy allowing authenticated users to upload/update objects under a path
//    matching their own auth.uid() (e.g. `{uid}/*`) and public read access.

import { getSupabaseClient, getAdminActionClient } from './supabaseClient';

const toAppUser = (profile) => ({
  id: profile.id,
  name: profile.name,
  email: profile.email,
  role: profile.role || 'Worker',
  department: profile.department || '',
  status: profile.status || 'Active',
  avatar: profile.avatar || '',
  initials: (profile.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
  phone: profile.phone || '',
  online: true,
  lastSeen: 'Just now'
});

export const fetchProfile = async (userId) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return toAppUser(data);
};

export const fetchAllProfiles = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('*').order('name');
  if (error || !data) return [];
  return data.map(toAppUser);
};

export const signInWithPassword = async (email, password) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: mapAuthError(error) };

  let profile = await fetchProfile(data.user.id);

  // Self-heal: if auth succeeded but no profile row exists, this is almost always an
  // account whose profile insert failed at sign-up time (e.g. before the required RLS
  // policy existed) — not a real "banned" or "wrong account" situation. Since we're now
  // authenticated as this exact user, auth.uid() = id, so the self-insert policy applies
  // and we can safely create the missing row instead of permanently locking them out.
  if (!profile) {
    const fallbackName = data.user.email.split('@')[0];
    const { error: healError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      name: fallbackName,
      email: data.user.email,
      role: 'Worker',
      department: '',
      status: 'Active',
      phone: ''
    });
    if (!healError) profile = await fetchProfile(data.user.id);
  }

  if (!profile) {
    await supabase.auth.signOut();
    return { success: false, error: 'No staff profile found for this account. Contact an administrator.' };
  }
  if (profile.status === 'Banned') {
    await supabase.auth.signOut();
    return { success: false, error: 'This account has been banned. Contact an administrator.' };
  }
  if (profile.status === 'Deleted') {
    await supabase.auth.signOut();
    return { success: false, error: 'This account has been deleted.' };
  }
  return { success: true, user: profile };
};

export const signOut = async () => {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
};

export const getRestoredSession = async () => {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) return null;

  const profile = await fetchProfile(session.user.id);
  if (!profile || profile.status === 'Banned' || profile.status === 'Deleted') {
    await supabase.auth.signOut();
    return null;
  }
  return profile;
};

export const changeOwnPasswordSupabase = async (currentPassword, newPassword, email) => {
  const supabase = getSupabaseClient();
  // Re-verify the current password before allowing a change, same as the local-auth flow.
  const reauth = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (reauth.error) return { success: false, error: 'Current password is incorrect.' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: mapAuthError(error) };
  return { success: true };
};

// Self-service account deletion — soft-delete (status: 'Deleted') rather than a hard
// row removal, so the login gate can actually keep the account out afterward (see the
// long comment on this in context/AuthContext.jsx for why). Requires the current
// password as a confirmation step, same pattern as changing your password.
export const deleteOwnAccountSupabase = async (currentPassword, email, userId) => {
  const supabase = getSupabaseClient();
  const reauth = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (reauth.error) return { success: false, error: 'Current password is incorrect.' };

  const { error } = await supabase.from('profiles').update({ status: 'Deleted' }).eq('id', userId);
  if (error) return { success: false, error: error.message };

  await supabase.auth.signOut();
  return { success: true };
};

// Admin action: send a password-reset email via Supabase. There is no way for a
// client using only the anon key to set or reveal another user's password directly —
// Supabase's own security model requires the account holder to complete the reset via
// the emailed link. This requires email sending to be configured in your Supabase
// project (Authentication → Email Templates / SMTP settings).
export const sendPasswordResetEmail = async (email) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return { success: false, error: mapAuthError(error) };
  return { success: true };
};

// Admin action: create a brand-new worker account. Uses an isolated, session-less
// Supabase client so this signUp() call can never overwrite the admin's own session.
export const createWorkerAccount = async ({ name, email, password, role, department, phone }) => {
  const actionClient = getAdminActionClient();
  const { data, error } = await actionClient.auth.signUp({ email, password });
  if (error) return { success: false, error: mapAuthError(error) };
  if (!data.user) {
    return { success: false, error: 'Could not create account — check if email confirmation is required in your Supabase project settings.' };
  }

  // Create/complete the profile row for this new user (in case no DB trigger exists yet).
  const supabase = getSupabaseClient();
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id,
    name,
    email,
    role: role || 'Worker',
    department: department || '',
    status: 'Active',
    phone: phone || ''
  });
  if (profileError) {
    return { success: false, error: `Account created, but profile setup failed: ${profileError.message}` };
  }

  return { success: true, user: toAppUser({ id: data.user.id, name, email, role, department, phone, status: 'Active' }) };
};

// Self-service sign-up: anyone can create their own account. Always defaults to the
// 'Worker' role — a self-serve path must never be able to grant Admin access; role
// upgrades stay an explicit Admin action in Staff Manager.
export const signUpNewAccount = async ({ name, email, password }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { success: false, error: mapAuthError(error) };
  if (!data.user) {
    return { success: false, error: 'Could not create account — please try again.' };
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id,
    name,
    email,
    role: 'Worker',
    department: '',
    status: 'Active',
    phone: ''
  });
  if (profileError) {
    return { success: false, error: `Account created, but profile setup failed: ${profileError.message}` };
  }

  // If your Supabase project requires email confirmation, there's no session yet —
  // the person needs to click the link in their inbox before they can sign in.
  const needsEmailConfirmation = !data.session;
  if (needsEmailConfirmation) return { success: true, needsEmailConfirmation: true };

  const profile = await fetchProfile(data.user.id);
  return { success: true, needsEmailConfirmation: false, user: profile };
};

// Self-service: update your own display name / avatar URL (and email, which also
// requires updating it on the Supabase Auth side — see updateAuthEmail below).
export const updateOwnProfileFields = async (userId, fields) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
  return { success: !error, error: error?.message };
};

// Changing your login email goes through Supabase Auth itself, not the profiles table.
// Depending on your project's email settings, Supabase may require confirming the new
// address via a sent link before the change actually takes effect.
export const updateAuthEmail = async (newEmail) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) return { success: false, error: mapAuthError(error) };
  return { success: true };
};

// Uploads a profile photo to the `avatars` Storage bucket and returns its public URL.
export const uploadAvatarImage = async (userId, blob, contentType) => {
  const supabase = getSupabaseClient();
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true,
    cacheControl: '3600',
    contentType
  });
  if (uploadError) {
    return { success: false, error: `${uploadError.message} (does the "avatars" Storage bucket exist with the right policies?)` };
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust so the new photo shows immediately instead of a stale cached version.
  return { success: true, url: `${data.publicUrl}?t=${Date.now()}` };
};

export const updateProfileStatus = async (userId, status) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
  return { success: !error, error: error?.message };
};

export const deleteProfile = async (userId) => {
  const supabase = getSupabaseClient();
  // This removes the staff directory / profile row. Fully deleting the underlying
  // auth.users account requires the service role key (server-side only) — do that from
  // your Supabase dashboard if you want the login itself gone, not just the profile.
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  return { success: !error, error: error?.message };
};

export const subscribeToProfileChanges = (onChange) => {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel('profiles-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      fetchAllProfiles().then(onChange);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
};

const mapAuthError = (error) => {
  const msg = error?.message || 'Something went wrong.';
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  return msg;
};
