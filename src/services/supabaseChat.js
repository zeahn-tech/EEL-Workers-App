import { getSupabaseClient } from './supabaseClient';

// --- Field mapping between the app's camelCase message/group shape (unchanged from the
// original local-mode design) and Postgres's snake_case columns. ---------------------

const toDbMessage = (m) => ({
  id: m.id,
  chat_id: m.chatId,
  sender_id: m.senderId,
  sender_name: m.senderName,
  content: m.content ?? '',
  type: m.type,
  file_data: m.fileData ?? null,
  image_data: m.imageData ?? null,
  location: m.location ?? null,
  audio_data: m.audioData ?? null,
  status: m.status ?? 'sent',
  edited: m.edited ?? false,
  deleted: m.deleted ?? false,
  timestamp: m.timestamp
});

const toAppMessage = (row) => ({
  id: row.id,
  chatId: row.chat_id,
  senderId: row.sender_id,
  senderName: row.sender_name,
  content: row.content,
  type: row.type,
  fileData: row.file_data || undefined,
  imageData: row.image_data || undefined,
  location: row.location || undefined,
  audioData: row.audio_data || undefined,
  status: row.status,
  edited: row.edited,
  deleted: row.deleted,
  timestamp: row.timestamp
});

const toDbGroup = (g) => ({
  id: g.id,
  name: g.name,
  description: g.description ?? '',
  members: g.members ?? [],
  avatar: g.avatar ?? '',
  initials: g.initials ?? '',
  created_by: g.created_by ?? null
});

const toAppGroup = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  isGroup: true,
  members: row.members || [],
  avatar: row.avatar,
  initials: row.initials,
  created_by: row.created_by
});

// --- Messages -------------------------------------------------------------

// Fetches the full message history with no limit or pagination. That's fine at the scale
// this app runs at today, but it's worth knowing as a deliberate current boundary, not an
// oversight: as message volume grows significantly, this would need pagination (e.g. only
// loading the most recent N per chat, fetching older history on scroll) rather than always
// pulling everything on every load.
export const fetchMessages = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('messages').select('*').order('timestamp', { ascending: true });
  if (error) {
    console.error('[supabaseChat] fetchMessages failed:', error.message);
    return [];
  }
  return (data || []).map(toAppMessage);
};

export const insertMessage = async (message) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('messages').insert(toDbMessage(message)).select().single();
  if (error) {
    console.error('[supabaseChat] insertMessage failed:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true, message: toAppMessage(data) };
};

export const updateMessageRow = async (messageId, updates) => {
  const supabase = getSupabaseClient();
  const dbUpdates = {};
  if ('content' in updates) dbUpdates.content = updates.content;
  if ('edited' in updates) dbUpdates.edited = updates.edited;
  if ('deleted' in updates) dbUpdates.deleted = updates.deleted;
  const { data, error } = await supabase.from('messages').update(dbUpdates).eq('id', messageId).select().single();
  if (error) {
    console.error('[supabaseChat] updateMessageRow failed:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true, message: toAppMessage(data) };
};

// Subscribes to real-time INSERT/UPDATE events on the messages table — this is what
// makes a message sent from someone else's device or browser actually arrive here live,
// which local-mode's BroadcastChannel could never do (it only reaches other tabs in the
// exact same browser). Returns an unsubscribe function.
export const subscribeToMessages = (onInsert, onUpdate) => {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel('messages-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      onInsert(toAppMessage(payload.new));
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
      onUpdate(toAppMessage(payload.new));
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
};

// --- Groups -----------------------------------------------------------------

export const fetchGroups = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: true });
  if (error) {
    console.error('[supabaseChat] fetchGroups failed:', error.message);
    return [];
  }
  return (data || []).map(toAppGroup);
};

export const insertGroup = async (group) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('groups').insert(toDbGroup(group)).select().single();
  if (error) {
    console.error('[supabaseChat] insertGroup failed:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true, group: toAppGroup(data) };
};

export const updateGroupRow = async (groupId, updates) => {
  const supabase = getSupabaseClient();
  const dbUpdates = {};
  if ('name' in updates) dbUpdates.name = updates.name;
  if ('description' in updates) dbUpdates.description = updates.description;
  if ('members' in updates) dbUpdates.members = updates.members;
  if ('initials' in updates) dbUpdates.initials = updates.initials;
  if ('avatar' in updates) dbUpdates.avatar = updates.avatar;
  const { data, error } = await supabase.from('groups').update(dbUpdates).eq('id', groupId).select().single();
  if (error) {
    console.error('[supabaseChat] updateGroupRow failed:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true, group: toAppGroup(data) };
};

export const deleteGroupRow = async (groupId) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) {
    console.error('[supabaseChat] deleteGroupRow failed:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const subscribeToGroups = (onChange) => {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel('groups-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
      fetchGroups().then(onChange);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
};
