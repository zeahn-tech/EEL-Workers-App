// Local Storage & IndexedDB Fallback Engine with BroadcastChannel for instant real-time multi-tab sync

const STORAGE_KEYS = {
  USERS: 'eel_users_v2',
  MESSAGES: 'eel_messages_v2',
  GROUPS: 'eel_groups_v2',
  SETTINGS: 'eel_settings_v2',
  CURRENT_USER: 'eel_current_user_v2',
  SESSION: 'eel_session_v1'
};

const broadcastChannel = typeof BroadcastChannel !== 'undefined' 
  ? new BroadcastChannel('eel_realtime_channel') 
  : null;

// Default demo password for all seed accounts below is "Welcome123!" — the hashes are
// SHA-256("<user-id>:Welcome123!"), matching services/authCrypto.js's hashing scheme.
// Initial Default Workforce
export const DEFAULT_WORKERS = [
  {
    id: 'user-admin-1',
    name: 'James Kollie',
    email: 'admin@eel-logistics.com',
    role: 'Admin',
    department: 'Executive Management',
    status: 'Active', // Active, Suspended, Banned
    avatar: '',
    initials: 'JK',
    phone: '+231 88 654 3210',
    passwordHash: '6a755590bb466584a1bbf37bb556cb21a6e3abfac80558240be7293bad937181'
  },
  {
    id: 'user-op-2',
    name: 'Sarah Flomo',
    email: 'sarah.flomo@eel-logistics.com',
    role: 'Dispatcher',
    department: 'Logistics Operations',
    status: 'Active',
    avatar: '',
    initials: 'SF',
    phone: '+231 77 123 4567',
    passwordHash: 'cbf6e05b87526ebb762e28d7c278d3e7af32c38ba9ddffc74604b7fd491804ea'
  },
  {
    id: 'user-disp-3',
    name: 'Emmanuel Zeahn',
    email: 'emmanuel.z@eel-logistics.com',
    role: 'Dispatcher',
    department: 'Freight & Customs',
    status: 'Active',
    avatar: '',
    initials: 'EZ',
    phone: '+231 88 999 1111',
    passwordHash: 'a25143d32ff302a81dacd810d845ece211a9e4f9f7eb72823a4a50749adcc558'
  },
  {
    id: 'user-driver-4',
    name: 'Moses Tarkpor',
    email: 'moses.t@eel-logistics.com',
    role: 'Worker',
    department: 'Heavy Haulage Driver',
    status: 'Active',
    avatar: '',
    initials: 'MT',
    phone: '+231 77 888 2222',
    passwordHash: '71c434a6d03d661c53b3db82a9e4980428b535f954a0326c95732908d17240a2'
  },
  {
    id: 'user-wh-5',
    name: 'Comfort Sirleaf',
    email: 'comfort.s@eel-logistics.com',
    role: 'Worker',
    department: 'Freeport Warehouse',
    status: 'Active',
    avatar: '',
    initials: 'CS',
    phone: '+231 88 555 4433',
    passwordHash: '4dec4e3257f819d09fd8395e061e14684c1ab2c5a2fd99906890bc017208e20e'
  }
];

// Initial Group Channels
export const DEFAULT_GROUPS = [
  {
    id: 'group-general-1',
    name: 'EEL General Operations',
    description: 'Company-wide dispatch updates & general operational notices.',
    isGroup: true,
    created_by: 'user-admin-1',
    members: ['user-admin-1', 'user-op-2', 'user-disp-3', 'user-driver-4', 'user-wh-5'],
    avatar: '',
    initials: 'GO'
  },
  {
    id: 'group-freeport-2',
    name: 'Monrovia Freeport Dispatch',
    description: 'Real-time cargo tracking & container release updates.',
    isGroup: true,
    created_by: 'user-admin-1',
    members: ['user-admin-1', 'user-op-2', 'user-disp-3', 'user-wh-5'],
    avatar: '',
    initials: 'MF'
  }
];

// Initial System Settings
export const DEFAULT_SETTINGS = {
  companyName: 'Elite Express Logistics Liberia (EEL)',
  tagline: 'Premier Freight, Customs & Supply Chain Dispatch',
  appLogo: '', // Base64 dataURL or URL uploaded by Admin
  supabaseUrl: '',
  supabaseAnonKey: '',
  enablePushNotifications: true,
  allowLocationSharing: true,
  themeColor: '#0F172A',
  accentColor: '#F59E0B'
};

// Initial Welcome Messages
export const DEFAULT_MESSAGES = [
  {
    id: 'msg-init-1',
    chatId: 'group-general-1',
    senderId: 'user-admin-1',
    senderName: 'James Kollie',
    content: 'Welcome team to the official Elite Express Logistics Liberia (EEL) PWA Messenger! All dispatch teams operate via this secure real-time channel.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    type: 'text',
    status: 'read'
  },
  {
    id: 'msg-init-2',
    chatId: 'group-general-1',
    senderId: 'user-op-2',
    senderName: 'Sarah Flomo',
    content: 'Understood Sir! Container shipment EEL-8890 from Monrovia Freeport has cleared customs inspection and dispatch drivers are assigned.',
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    type: 'text',
    status: 'read'
  },
  {
    id: 'msg-init-3',
    chatId: 'group-general-1',
    senderId: 'user-driver-4',
    senderName: 'Moses Tarkpor',
    content: 'Here is my current live delivery route coordinates for truck #04:',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    type: 'location',
    location: {
      latitude: 6.3156,
      longitude: -10.8074,
      address: 'Monrovia Freeport Port Entrance, Bushrod Island',
      accuracy: 12
    },
    status: 'read'
  }
];

// Database Helper Methods
export const localDb = {
  getUsers: () => {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_WORKERS));
      return DEFAULT_WORKERS;
    }
    const users = JSON.parse(data);
    // One-time migration: earlier versions of this app had no password field at all.
    // Backfill any user missing a passwordHash with the matching seed hash (falls back
    // to the admin's hash only if the id truly isn't one of the seed accounts, which
    // shouldn't normally happen — new workers are always created with a real hash).
    let migrated = false;
    const patched = users.map(u => {
      if (u.passwordHash) return u;
      migrated = true;
      const seed = DEFAULT_WORKERS.find(d => d.id === u.id);
      return { ...u, passwordHash: seed?.passwordHash || DEFAULT_WORKERS[0].passwordHash };
    });
    if (migrated) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(patched));
      return patched;
    }
    return users;
  },

  saveUsers: (users) => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'USERS_UPDATED', users });
    }
  },

  getGroups: () => {
    const data = localStorage.getItem(STORAGE_KEYS.GROUPS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(DEFAULT_GROUPS));
      return DEFAULT_GROUPS;
    }
    return JSON.parse(data);
  },

  saveGroups: (groups) => {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'GROUPS_UPDATED', groups });
    }
  },

  getMessages: () => {
    const data = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(DEFAULT_MESSAGES));
      return DEFAULT_MESSAGES;
    }
    return JSON.parse(data);
  },

  addMessage: (message) => {
    const messages = localDb.getMessages();
    const newMsg = {
      ...message,
      id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: message.timestamp || new Date().toISOString()
    };
    messages.push(newMsg);
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    } catch (err) {
      // Local (offline) mode has no server to actually store attachments — files and
      // images are embedded directly as base64 text in the message, and localStorage has
      // a hard per-origin quota of only a few MB total across everything this app stores.
      // Without this catch, a QuotaExceededError here would throw uncaught, silently
      // discarding the message with no explanation — exactly the "some attachments just
      // don't send" symptom this is fixing. Throwing a clear, typed error instead lets the
      // UI show something actionable rather than nothing.
      const quotaError = new Error(
        'Local storage is full — this attachment is too large for offline mode. Try a smaller file, or switch to Supabase mode in Admin Settings for full-size uploads.'
      );
      quotaError.isQuotaError = true;
      throw quotaError;
    }
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'NEW_MESSAGE', message: newMsg });
    }
    return newMsg;
  },

  updateMessage: (messageId, updates) => {
    const messages = localDb.getMessages();
    let updatedMsg = null;
    const next = messages.map(m => {
      if (m.id !== messageId) return m;
      updatedMsg = { ...m, ...updates };
      return updatedMsg;
    });
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(next));
    } catch (err) {
      const quotaError = new Error(
        'Local storage is full — could not save this change. Try removing some older attachments, or switch to Supabase mode in Admin Settings.'
      );
      quotaError.isQuotaError = true;
      throw quotaError;
    }
    if (broadcastChannel && updatedMsg) {
      broadcastChannel.postMessage({ type: 'MESSAGE_UPDATED', message: updatedMsg });
    }
    return updatedMsg;
  },

  getSettings: () => {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    return JSON.parse(data);
  },

  saveSettings: (settings) => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'SETTINGS_UPDATED', settings });
    }
  },

  getCurrentUser: () => {
    // Only restores a user if there is a valid, previously-established login session.
    // There is no "default to the first user" auto-login — that was the security hole
    // that let anyone land on (or switch to) the Admin account with zero credentials.
    const session = localDb.getSession();
    if (!session) return null;

    const users = localDb.getUsers();
    const user = users.find(u => u.id === session.userId);
    if (!user || user.status === 'Banned' || user.status === 'Deleted') {
      localDb.clearSession();
      return null;
    }
    return user;
  },

  setCurrentUser: (user) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  },

  getSession: () => {
    const data = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  startSession: (userId) => {
    const session = { userId, loggedInAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    return session;
  },

  clearSession: () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  // Typing indicators (local mode): a pure ephemeral signal, deliberately never written
  // to localStorage — there's nothing here worth persisting, only broadcasting to any
  // other open tab in this same browser right now.
  broadcastTyping: (payload) => {
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'TYPING', payload });
    }
  },

  subscribeToChanges: (callback) => {
    if (!broadcastChannel) return () => {};
    const handler = (event) => callback(event.data);
    broadcastChannel.addEventListener('message', handler);
    return () => broadcastChannel.removeEventListener('message', handler);
  }
};
