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
//      - a user to UPDATE their own row EXCEPT its role (self-service name/avatar
//        edits — password and email changes go through Supabase Auth directly, not
//        this table; role changes are an Admin-only action, never self-service)
//      - Admin-role users to UPDATE/DELETE any row, including changing someone's role
//        (Staff Manager)
//  - A database trigger that creates a `profiles` row when a new auth user is created:
//    'Admin' for the very first account ever created in this project (that's how a
//    fresh deployment gets its first Admin — deterministically, server-side, with no
//    client-side "claim" step), 'Worker' for every account after that.
//  - A trigger that refuses any update or delete that would leave zero Admin accounts,
//    so Staff Manager's role changes and worker deletion are safe to expose to any
//    Admin without a client-side check being the only thing standing between the app
//    and a locked-out workspace.
//  - A public Storage bucket named `avatars` if you want profile photo uploads, with
//    a policy allowing authenticated users to upload/update objects under a path
//    matching their own auth.uid() (e.g. `{uid}/*`) and public read access.
// See supabase/profiles-rls-policies.sql for all of the above, ready to run as-is.

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
  // Real online/offline status is never a static profile field — it's computed live from
  // presence (see services/presence.js) and looked up separately wherever it's displayed.
  // `lastSeen` here is the last known real timestamp from the database (updated by the
  // presence heartbeat while this person's session is open), not a placeholder string.
  lastSeen: profile.last_seen || null
});

export const fetchProfile = async (userId) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) console.error('[supabaseAuth] fetchProfile failed:', error.message);
  if (error || !data) return null;
  return toAppUser(data);
};

export const fetchAllProfiles = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select('*').order('name');
  if (error) console.error('[supabaseAuth] fetchAllProfiles failed:', error.message);
  if (error || !data) return [];
  return data.map(toAppUser);
};

// Self-heal: if we have an authenticated user but no profiles row exists for them, this
// is almost always someone whose row could never be written at sign-up time — either the
// RLS/trigger setup from profiles-rls-policies.sql hasn't been (re-)run in this Supabase
// project yet, or (a normal case even with everything set up correctly) the project
// requires email confirmation, so signUp() ran with no session and the self-insert policy
// had nothing to authenticate as. Since we're now genuinely authenticated as this exact
// user, auth.uid() = id, so the self-insert policy applies and we can safely create the
// missing row instead of permanently locking them out. Their originally-typed name
// survives this gap because signUpNewAccount stores it in the auth user's metadata, not
// just in the (possibly-never-written) profiles row.
//
// This mirrors the "first account ever becomes Admin" rule from the on_auth_user_created
// database trigger — not because both should exist (the trigger is the real, atomic
// source of truth and normally creates the row before this ever runs), but as defense in
// depth: if the trigger was never installed (e.g. an older profiles-rls-policies.sql is
// still what's been run against this project), this is the only remaining path that
// creates a profile at all, and it needs to get the very first account right too, or a
// fresh deployment ends up with a Worker and, again, no way for anyone to become Admin.
//
// Returns { profile, error } rather than just profile so callers can show the real
// Postgres/RLS error text instead of a generic "no profile found" message that gives
// no clue which of the above actually happened.
const ensureProfile = async (user) => {
  let profile = await fetchProfile(user.id);
  if (profile) return { profile, error: null };

  const supabase = getSupabaseClient();
  const fallbackName = user.user_metadata?.name || user.email.split('@')[0];
  const existing = await fetchAllProfiles();
  const isFirstAccount = existing.length === 0;

  const { error: healError } = await supabase.from('profiles').upsert({
    id: user.id,
    name: fallbackName,
    email: user.email,
    role: isFirstAccount ? 'Admin' : 'Worker',
    department: '',
    status: 'Active',
    phone: ''
  });

  if (healError) {
    console.error('[supabaseAuth] ensureProfile self-heal insert failed:', healError.message);
    return { profile: null, error: healError.message };
  }

  profile = await fetchProfile(user.id);
  if (!profile) {
    console.error('[supabaseAuth] ensureProfile: insert reported success but the row could not be read back — check the SELECT policy on profiles.');
    return { profile: null, error: 'Profile was created but could not be read back. Check your Supabase SELECT policy on profiles.' };
  }
  return { profile, error: null };
};

export const signInWithPassword = async (email, password) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: mapAuthError(error) };

  const { profile, error: healError } = await ensureProfile(data.user);

  if (!profile) {
    await supabase.auth.signOut();
    const detail = healError ? ` (${healError})` : '';
    return { success: false, error: `No staff profile found for this account${detail}. Contact an administrator.` };
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

  // Same self-heal as signInWithPassword. This path matters more than it looks: when a
  // project requires email confirmation, clicking the confirmation link redirects back
  // into the app with an access token in the URL, and supabase-js auto-establishes a
  // session from it (detectSessionInUrl) *before* the person ever hits the login form.
  // Without self-healing here too, that first post-confirmation load would find no
  // profile row and silently sign them back out, discarding the account.
  const { profile } = await ensureProfile(session.user);
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
  const { data, error } = await actionClient.auth.signUp({ email, password, options: { data: { name } } });
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

// Self-service sign-up: anyone can create their own account. This never grants Admin
// itself — that's decided by ensureProfile/the database trigger purely based on whether
// this is the very first account in the whole system, not by anything in this function —
// so a self-serve path can never be used to grant Admin to an arbitrary account. Every
// account after the first one lands as 'Worker'; from there, becoming Admin is exclusively
// an explicit action an existing Admin takes in Staff Manager.
export const signUpNewAccount = async ({ name, email, password }) => {
  const supabase = getSupabaseClient();
  // Storing `name` in auth user_metadata (not just the profiles table) means it survives
  // even when the profiles insert below can't run yet — see the email-confirmation case.
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (error) return { success: false, error: mapAuthError(error) };
  if (!data.user) {
    return { success: false, error: 'Could not create account — please try again.' };
  }

  // If your Supabase project requires email confirmation (the default for new projects),
  // there is no session yet at this point — signUp() only creates the auth.users row and
  // sends a confirmation email. Attempting the profiles insert here would run as an
  // unauthenticated request and get blocked by RLS, so we skip it entirely: the row gets
  // created automatically (via the on_auth_user_created trigger, or ensureProfile's
  // self-heal as a fallback) the moment this person actually has a session, whether
  // that's clicking the confirmation link or logging in afterward.
  const needsEmailConfirmation = !data.session;
  if (needsEmailConfirmation) return { success: true, needsEmailConfirmation: true };

  const { profile, error: healError } = await ensureProfile(data.user);
  if (!profile) {
    return { success: false, error: `Account created, but profile setup failed${healError ? ` (${healError})` : ''}.` };
  }
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

// Uploads a chat attachment (any file type, or an image) to the shared `chat-media`
// bucket and returns its public URL. This is what actually makes large attachments work:
// storing the file itself in Supabase Storage means the chat message only ever needs to
// hold a short URL string, instead of the entire file re-encoded as a base64 data URL
// stuffed into the message record. That distinction matters a lot in practice — messages
// are persisted to browser localStorage regardless of mode (see the architecture note in
// supabaseClient.js), and localStorage has a hard per-origin quota of only a few MB total
// across every key this app uses. A single multi-MB base64 image can exceed that quota by
// itself, and `localStorage.setItem` throws when it does — silently breaking the send with
// no explanation, which is exactly the "some files/images just don't upload" symptom this
// fixes. Routing real uploads through Storage instead sidesteps that ceiling entirely.
export const uploadChatMedia = async (chatId, file) => {
  const supabase = getSupabaseClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const path = `${chatId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream'
  });
  if (uploadError) {
    return { success: false, error: `${uploadError.message} (does the "chat-media" Storage bucket exist with the right policies?)` };
  }
  const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
  return { success: true, url: data.publicUrl };
};

export const updateProfileStatus = async (userId, status) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
  return { success: !error, error: error?.message };
};

export const updateProfileRole = async (userId, role) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  // The "last Admin" invariant is enforced server-side by a database trigger (see
  // profiles-rls-policies.sql), so this can fail even for a legitimate Admin caller —
  // that's intentional defense in depth, not a bug to work around client-side.
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
