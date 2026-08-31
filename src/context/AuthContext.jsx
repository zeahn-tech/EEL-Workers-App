import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { localDb } from '../services/localDb';
import { isSupabaseConfigured, getSupabaseClient } from '../services/supabaseClient';
import { hashPassword, verifyPassword, generateTempPassword } from '../services/authCrypto';
import * as supaAuth from '../services/supabaseAuth';

const AuthContext = createContext();

// Basic brute-force throttling for the local (non-Supabase) auth path: after repeated
// failed attempts for the same email, force a short client-side cooldown. Supabase has
// its own server-side rate limiting, so this only applies to the local fallback.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30000;

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(localDb.getSettings());
  const [loading, setLoading] = useState(true);
  const attemptsRef = useRef({}); // { [emailLower]: { count, lockedUntil } }

  const supabaseMode = isSupabaseConfigured();

  // Load state on initial mount
  useEffect(() => {
    let unsubscribeProfiles = () => {};
    let unsubscribeAuthState = () => {};

    const init = async () => {
      if (supabaseMode) {
        // --- Supabase-backed accounts (real login, real staff directory) ---
        const [restoredUser, allProfiles] = await Promise.all([
          supaAuth.getRestoredSession(),
          supaAuth.fetchAllProfiles()
        ]);
        setUsers(allProfiles);
        setCurrentUser(restoredUser);
        setLoading(false);

        unsubscribeProfiles = supaAuth.subscribeToProfileChanges((updatedProfiles) => {
          setUsers(updatedProfiles);
          setCurrentUser(prev => {
            if (!prev) return prev;
            const updated = updatedProfiles.find(u => u.id === prev.id);
            if (!updated || updated.status === 'Banned' || updated.status === 'Deleted') return null;
            return updated;
          });
        });

        const supabase = getSupabaseClient();
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') setCurrentUser(null);
        });
        unsubscribeAuthState = () => sub?.subscription?.unsubscribe();
      } else {
        // --- Local, browser-only accounts (no backend configured) ---
        const loadedUsers = localDb.getUsers();
        setUsers(loadedUsers);
        setCurrentUser(localDb.getCurrentUser());
        setLoading(false);

        unsubscribeProfiles = localDb.subscribeToChanges((data) => {
          if (data.type === 'USERS_UPDATED') {
            setUsers(data.users);
            setCurrentUser(prev => {
              if (!prev) return prev;
              const updated = data.users.find(u => u.id === prev.id);
              if (!updated) return prev;
              if (updated.status === 'Banned' || updated.status === 'Deleted') {
                localDb.clearSession();
                return null;
              }
              return updated;
            });
          } else if (data.type === 'SETTINGS_UPDATED') {
            setSettings(data.settings);
          } else if (data.type === 'SESSION_ENDED') {
            setCurrentUser(null);
          }
        });
      }
    };

    init();
    return () => { unsubscribeProfiles(); unsubscribeAuthState(); };
  }, [supabaseMode]);

  // Real authentication — routes to Supabase or the local hashed-password store
  // depending on whether a Supabase project is configured in Admin Settings.
  const login = async (email, password) => {
    const emailKey = (email || '').trim().toLowerCase();
    if (!emailKey || !password) {
      return { success: false, error: 'Enter your email and password.' };
    }

    if (supabaseMode) {
      const result = await supaAuth.signInWithPassword(emailKey, password);
      if (result.success) {
        setCurrentUser(result.user);
        // Refresh the full directory now that we're authenticated — some RLS setups
        // only allow SELECT on profiles for logged-in users, so the pre-login fetch
        // in the mount effect may have come back empty.
        supaAuth.fetchAllProfiles().then(setUsers);
      }
      return result;
    }

    // --- Local fallback path ---
    const record = attemptsRef.current[emailKey];
    if (record?.lockedUntil && Date.now() < record.lockedUntil) {
      const secondsLeft = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      return { success: false, error: `Too many failed attempts. Try again in ${secondsLeft}s.` };
    }

    const latestUsers = localDb.getUsers();
    const user = latestUsers.find(u => u.email.toLowerCase() === emailKey);

    const fail = (message) => {
      const prev = attemptsRef.current[emailKey] || { count: 0 };
      const count = prev.count + 1;
      attemptsRef.current[emailKey] = count >= MAX_ATTEMPTS
        ? { count: 0, lockedUntil: Date.now() + LOCKOUT_MS }
        : { count };
      return { success: false, error: message };
    };

    if (!user) return fail('Incorrect email or password.');
    if (user.status === 'Banned') {
      return { success: false, error: 'This account has been banned. Contact an administrator.' };
    }
    if (user.status === 'Deleted') {
      return { success: false, error: 'This account has been deleted.' };
    }

    const valid = await verifyPassword(password, user.id, user.passwordHash);
    if (!valid) return fail('Incorrect email or password.');

    delete attemptsRef.current[emailKey];
    localDb.startSession(user.id);
    localDb.setCurrentUser(user);
    setUsers(latestUsers);
    setCurrentUser(user);
    return { success: true };
  };

  // Self-service account creation. Always creates a 'Worker'-role account — nobody can
  // grant themselves Admin by signing up; that stays an explicit Staff Manager action.
  const signUp = async (name, email, password) => {
    const emailKey = (email || '').trim().toLowerCase();
    if (!name?.trim() || !emailKey || !password) {
      return { success: false, error: 'Fill in your name, email, and password.' };
    }
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }

    if (supabaseMode) {
      const result = await supaAuth.signUpNewAccount({ name: name.trim(), email: emailKey, password });
      if (!result.success) return result;
      if (result.needsEmailConfirmation) return { success: true, needsEmailConfirmation: true };
      setCurrentUser(result.user);
      supaAuth.fetchAllProfiles().then(setUsers);
      return { success: true };
    }

    const latestUsers = localDb.getUsers();
    if (latestUsers.some(u => u.email.toLowerCase() === emailKey)) {
      return { success: false, error: 'An account with this email already exists.' };
    }
    const newId = `user-${Date.now()}`;
    const passwordHash = await hashPassword(password, newId);
    const newUser = {
      id: newId,
      name: name.trim(),
      email: emailKey,
      role: 'Worker',
      department: 'Unassigned',
      status: 'Active',
      avatar: '',
      initials: name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      phone: '',
      online: true,
      lastSeen: 'Just now',
      passwordHash
    };
    const updatedUsers = [...latestUsers, newUser];
    setUsers(updatedUsers);
    localDb.saveUsers(updatedUsers);
    localDb.startSession(newId);
    localDb.setCurrentUser(newUser);
    setCurrentUser(newUser);
    return { success: true };
  };

  // Self-service: update your own name / email / avatar.
  const updateOwnProfile = async ({ name, email, avatar }) => {
    if (!currentUser) return { success: false, error: 'Not signed in.' };
    const emailChanged = email && email.toLowerCase() !== currentUser.email.toLowerCase();

    if (supabaseMode) {
      if (emailChanged) {
        const emailResult = await supaAuth.updateAuthEmail(email);
        if (!emailResult.success) return emailResult;
      }
      const fieldResult = await supaAuth.updateOwnProfileFields(currentUser.id, { name, email, avatar });
      if (!fieldResult.success) return fieldResult;
      const updated = { ...currentUser, name, email, avatar };
      setCurrentUser(updated);
      setUsers(prev => prev.map(u => u.id === currentUser.id ? updated : u));
      return {
        success: true,
        emailConfirmationSent: emailChanged // Supabase may require confirming the new address
      };
    }

    if (emailChanged) {
      const latestUsers = localDb.getUsers();
      if (latestUsers.some(u => u.id !== currentUser.id && u.email.toLowerCase() === email.toLowerCase())) {
        return { success: false, error: 'An account with this email already exists.' };
      }
    }
    const initials = (name || currentUser.name).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, name, email, avatar, initials } : u);
    setUsers(updatedUsers);
    localDb.saveUsers(updatedUsers);
    const updated = updatedUsers.find(u => u.id === currentUser.id);
    localDb.setCurrentUser(updated);
    setCurrentUser(updated);
    return { success: true };
  };

  // Self-service: upload/replace your own profile photo. Resizing happens client-side
  // before this is called (see services/imageUtils.js) — this just stores the result.
  const uploadAvatar = async ({ dataUrl, blob, contentType }) => {
    if (!currentUser) return { success: false, error: 'Not signed in.' };

    if (supabaseMode) {
      const result = await supaAuth.uploadAvatarImage(currentUser.id, blob, contentType);
      if (!result.success) return result;
      return updateOwnProfile({ name: currentUser.name, email: currentUser.email, avatar: result.url });
    }

    // Local mode: store the resized image directly as a data URL.
    return updateOwnProfile({ name: currentUser.name, email: currentUser.email, avatar: dataUrl });
  };

  // Self-service: permanently step away from the app. This is a soft-delete (marks the
  // account status as 'Deleted' and signs out) rather than an unrecoverable row wipe —
  // that's what makes the login gate actually block the account afterward (a truly
  // removed profile row would just get silently recreated by the self-heal logic in
  // supabaseAuth.js the next time they logged in with the same credentials). Message
  // history is left intact so conversations don't develop holes for other people.
  const deleteOwnAccount = async (currentPassword) => {
    if (!currentUser) return { success: false, error: 'Not signed in.' };

    if (supabaseMode) {
      const result = await supaAuth.deleteOwnAccountSupabase(currentPassword, currentUser.email, currentUser.id);
      if (!result.success) return result;
      setCurrentUser(null);
      return { success: true };
    }

    const valid = await verifyPassword(currentPassword, currentUser.id, currentUser.passwordHash);
    if (!valid) return { success: false, error: 'Current password is incorrect.' };

    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, status: 'Deleted' } : u);
    setUsers(updatedUsers);
    localDb.saveUsers(updatedUsers);
    localDb.clearSession();
    setCurrentUser(null);
    return { success: true };
  };

  const logout = async () => {
    if (supabaseMode) {
      await supaAuth.signOut();
      setCurrentUser(null);
    } else {
      localDb.clearSession();
      setCurrentUser(null);
    }
  };

  // Self-service: change your own password (requires current password).
  const changeOwnPassword = async (currentPassword, newPassword) => {
    if (!currentUser) return { success: false, error: 'Not signed in.' };
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters.' };
    }

    if (supabaseMode) {
      return supaAuth.changeOwnPasswordSupabase(currentPassword, newPassword, currentUser.email);
    }

    const valid = await verifyPassword(currentPassword, currentUser.id, currentUser.passwordHash);
    if (!valid) return { success: false, error: 'Current password is incorrect.' };

    const newHash = await hashPassword(newPassword, currentUser.id);
    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, passwordHash: newHash } : u);
    setUsers(updatedUsers);
    localDb.saveUsers(updatedUsers);
    setCurrentUser(prev => ({ ...prev, passwordHash: newHash }));
    return { success: true };
  };

  // Admin Action: reset a staff member's password.
  // Supabase mode: sends that person a password-reset email (no temp password to show —
  // Supabase's anon key can't set another user's password directly).
  // Local mode: generates and returns a temp password for the admin to hand over.
  const resetWorkerPassword = async (user) => {
    if (supabaseMode) {
      const result = await supaAuth.sendPasswordResetEmail(user.email);
      return { emailSent: result.success, error: result.error };
    }
    const tempPassword = generateTempPassword();
    const newHash = await hashPassword(tempPassword, user.id);
    const updatedUsers = users.map(u => u.id === user.id ? { ...u, passwordHash: newHash } : u);
    setUsers(updatedUsers);
    localDb.saveUsers(updatedUsers);
    return { tempPassword };
  };

  // Admin Action: Add New Worker
  const addWorker = async (workerData) => {
    if (supabaseMode) {
      const tempPassword = workerData.password || generateTempPassword();
      const result = await supaAuth.createWorkerAccount({ ...workerData, password: tempPassword });
      if (!result.success) return { error: result.error };
      const refreshed = await supaAuth.fetchAllProfiles();
      setUsers(refreshed);
      return { worker: result.user, tempPassword };
    }

    const newId = `user-${Date.now()}`;
    const tempPassword = workerData.password || generateTempPassword();
    const passwordHash = await hashPassword(tempPassword, newId);

    const newWorker = {
      id: newId,
      name: workerData.name,
      email: workerData.email,
      role: workerData.role || 'Worker',
      department: workerData.department || 'Freight Operations',
      status: 'Active',
      avatar: workerData.avatar || '',
      initials: workerData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      phone: workerData.phone || '+231 88 000 0000',
      online: true,
      lastSeen: 'Just now',
      passwordHash
    };

    const updatedUsers = [...users, newWorker];
    setUsers(updatedUsers);
    localDb.saveUsers(updatedUsers);
    return { worker: newWorker, tempPassword };
  };

  // Admin Action: Update Worker Status (Active, Suspended, Banned)
  const updateWorkerStatus = async (userId, newStatus) => {
    if (supabaseMode) {
      const result = await supaAuth.updateProfileStatus(userId, newStatus);
      if (result.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      }
      return result;
    }
    const updatedUsers = users.map(u => u.id === userId ? { ...u, status: newStatus } : u);
    setUsers(updatedUsers);
    localDb.saveUsers(updatedUsers);
  };

  // Admin Action: Delete Worker
  const deleteWorker = async (userId) => {
    if (supabaseMode) {
      const result = await supaAuth.deleteProfile(userId);
      if (result.success) setUsers(prev => prev.filter(u => u.id !== userId));
      return result;
    }
    const updatedUsers = users.filter(u => u.id !== userId);
    setUsers(updatedUsers);
    localDb.saveUsers(updatedUsers);
  };

  // Admin Action: Update System Settings (Logo, Company Name, Credentials)
  const updateSettings = (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    localDb.saveSettings(merged);
  };

  const isAdmin = currentUser?.role === 'Admin';
  const isSuspended = currentUser?.status === 'Suspended';
  const isBanned = currentUser?.status === 'Banned';

  return (
    <AuthContext.Provider value={{
      currentUser,
      users,
      settings,
      isAdmin,
      isSuspended,
      isBanned,
      loading,
      supabaseMode,
      login,
      signUp,
      logout,
      changeOwnPassword,
      updateOwnProfile,
      uploadAvatar,
      deleteOwnAccount,
      resetWorkerPassword,
      addWorker,
      updateWorkerStatus,
      deleteWorker,
      updateSettings
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
