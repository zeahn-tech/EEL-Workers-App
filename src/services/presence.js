import { getSupabaseClient } from './supabaseClient';

// A tab counts as "online" if its heartbeat is more recent than this. Heartbeats are
// written more often than this threshold so a genuinely open tab never flickers offline
// between writes; a closed/crashed tab is detected as offline within one threshold window
// even though it never got the chance to announce it was leaving.
const LOCAL_HEARTBEAT_INTERVAL_MS = 10_000;
const LOCAL_OFFLINE_THRESHOLD_MS = 25_000;
const LOCAL_PRESENCE_KEY = 'eel_presence_heartbeats';

// How often we refresh `last_seen` in the profiles table while a Supabase-mode session is
// open. This is a pragmatic, honest choice: browsers don't reliably guarantee a final
// network call completes on tab close, so rather than promise an exact last-seen moment,
// this keeps the stored timestamp within this interval of the truth at all times, which is
// what "Last seen a few minutes ago" actually means in every consumer chat app.
const SUPABASE_HEARTBEAT_INTERVAL_MS = 45_000;

const readLocalHeartbeats = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PRESENCE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeLocalHeartbeat = (userId) => {
  const map = readLocalHeartbeats();
  map[userId] = Date.now();
  localStorage.setItem(LOCAL_PRESENCE_KEY, JSON.stringify(map));
  return map;
};

const computeOnlineIdsFromHeartbeats = (map) => {
  const now = Date.now();
  const online = new Set();
  Object.entries(map).forEach(([userId, ts]) => {
    if (now - ts < LOCAL_OFFLINE_THRESHOLD_MS) online.add(userId);
  });
  return online;
};

// Subscribes to real presence for the given user and reports the live set of online user
// ids (plus, for local mode, the raw heartbeat map so callers can compute "last seen" text)
// via onChange. Returns a cleanup function. This never fabricates an "online" status for
// anyone — a user only ever appears online because their own client is actively announcing
// it right now, whether that's a Supabase Realtime presence channel or a local heartbeat.
export const subscribeToPresence = (user, supabaseMode, onChange) => {
  if (!user) return () => {};

  if (supabaseMode) {
    const supabase = getSupabaseClient();
    const channel = supabase.channel('presence:workspace', {
      config: { presence: { key: user.id } }
    });

    const emit = () => {
      const state = channel.presenceState();
      const ids = Object.keys(state);
      console.log('[presence] online users right now:', ids);
      onChange(new Set(ids));
    };

    channel
      .on('presence', { event: 'sync' }, emit)
      .on('presence', { event: 'join' }, emit)
      .on('presence', { event: 'leave' }, emit)
      .subscribe(async (status, err) => {
        console.log('[presence] presence:workspace subscription status:', status, err || '');
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
          emit();
        }
      });

    // Keep last_seen fresh in the database so offline users show a meaningful "last seen"
    // even after everyone's browser session has ended and there's no live presence left.
    const touchLastSeen = () => {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('[presence] touchLastSeen failed:', error.message);
        });
    };
    touchLastSeen();
    const heartbeatTimer = setInterval(touchLastSeen, SUPABASE_HEARTBEAT_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') touchLastSeen();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', touchLastSeen);

    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', touchLastSeen);
      touchLastSeen();
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }

  // Local (offline) mode: no real network, so "online" means "a browser tab on this
  // device is currently open and signed in as this user" — tracked via a heartbeat in
  // localStorage that every open tab refreshes, visible to every other tab through the
  // same BroadcastChannel already used for message/user sync.
  let map = writeLocalHeartbeat(user.id);
  onChange(computeOnlineIdsFromHeartbeats(map), map);

  const heartbeatTimer = setInterval(() => {
    map = writeLocalHeartbeat(user.id);
    onChange(computeOnlineIdsFromHeartbeats(map), map);
  }, LOCAL_HEARTBEAT_INTERVAL_MS);

  // Re-check for staleness — and pick up other tabs' heartbeats — on a short poll. This
  // doubles as the cross-tab sync mechanism: every tab reads the same shared localStorage
  // key directly, so there's no need for an explicit broadcast message on every heartbeat,
  // and it also catches a tab that closed without announcing it (crash, force-quit),
  // detecting it as offline within one poll interval instead of only on some other event.
  const staleCheckTimer = setInterval(() => {
    const current = readLocalHeartbeats();
    onChange(computeOnlineIdsFromHeartbeats(current), current);
  }, 5_000);

  const handleUnload = () => {
    const current = readLocalHeartbeats();
    delete current[user.id];
    localStorage.setItem(LOCAL_PRESENCE_KEY, JSON.stringify(current));
  };
  window.addEventListener('beforeunload', handleUnload);

  return () => {
    clearInterval(heartbeatTimer);
    clearInterval(staleCheckTimer);
    window.removeEventListener('beforeunload', handleUnload);
    handleUnload();
  };
};

// Formats a millisecond timestamp (local-mode heartbeat) or ISO string (Supabase
// last_seen column) into a short, human "last seen" label. Never guesses — returns null
// when there's nothing real to report, so callers can fall back to not showing anything
// rather than a fabricated placeholder.
export const formatLastSeen = (value) => {
  if (!value) return null;
  const ts = typeof value === 'number' ? value : new Date(value).getTime();
  if (Number.isNaN(ts)) return null;

  const diffSeconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSeconds < 30) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};
