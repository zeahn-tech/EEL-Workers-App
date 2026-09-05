import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { localDb } from '../services/localDb';
import { useAuth } from './AuthContext';
import * as supabaseChat from '../services/supabaseChat';
import { playNotificationSound, showBrowserNotification } from '../services/notifications';

const ChatContext = createContext();

const BASE_TITLE = document.title;

// A typing indicator that never clears itself would just stay stuck on screen forever if
// someone stops typing without sending — this is how long a "so-and-so is typing" entry
// survives without a fresh signal before it's assumed stale and removed.
const TYPING_STALE_MS = 4000;
// How often a signal actually goes out while someone keeps typing continuously — not
// every keystroke, which would be pure noise on the wire for zero perceptible UX benefit.
const TYPING_SEND_THROTTLE_MS = 2000;

// The canonical identifier two people (or a whole group) watching the same conversation
// all agree on — a group's id is already shared, but a DM's chat_id (see buildMessage
// below) is asymmetric: it's the RECIPIENT's id, which is a different value depending on
// who's looking at it. Sorting both participants' ids into one joined string gives both
// sides the exact same channel name regardless of who's viewing from which side.
const getChatChannelKey = (currentUserId, chat) => {
  if (!chat) return null;
  return chat.isGroup ? chat.id : [currentUserId, chat.id].sort().join('_');
};

export const ChatProvider = ({ children }) => {
  const { currentUser, supabaseMode } = useAuth();
  const [groups, setGroups] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChat, setActiveChatState] = useState(null); // { id, name, isGroup, ... }
  const [searchQuery, setSearchQuery] = useState('');

  // Unread tracking, keyed by "thread key" — a group's id for group chats, or the OTHER
  // participant's user id for a direct message. This is the same identifier `activeChat.id`
  // already uses, which is what lets marking a chat "read" and counting its unread
  // messages agree on what a "chat" even is without any extra bookkeeping.
  const [unreadCounts, setUnreadCounts] = useState({});
  const [toast, setToast] = useState(null); // { chatKey, senderName, preview } | null
  const activeChatRef = useRef(null);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  const groupsRef = useRef([]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);

  // Who's currently typing in the ACTIVE chat, as { [userId]: { userName, lastSignalAt } }.
  // Deliberately scoped to just the open conversation, not tracked across every chat at
  // once — a typing signal is only ever meaningful for the thread you're actually looking
  // at, the same way real chat apps never show "X is typing" for a conversation you don't
  // have open.
  const [typingUsers, setTypingUsers] = useState({});
  const typingChannelRef = useRef(null); // Supabase mode: the live { send, unsubscribe } handle
  const lastTypingSentRef = useRef(0);
  const channelKeyRef = useRef(null); // the active chat's canonical key, kept fresh for listeners

  useEffect(() => {
    channelKeyRef.current = activeChat ? getChatChannelKey(currentUser?.id, activeChat) : null;
    setTypingUsers({}); // switching chats — any leftover "typing" from the previous one is stale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  // Prune stale typing entries — someone who stopped typing without sending anything
  // would otherwise stay stuck on screen forever with no further signal to clear them.
  useEffect(() => {
    const timer = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        const next = {};
        let changed = false;
        Object.entries(prev).forEach(([id, info]) => {
          if (now - info.lastSignalAt < TYPING_STALE_MS) next[id] = info;
          else changed = true;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const setActiveChat = (chat) => {
    setActiveChatState(chat);
    if (!chat) return;

    setUnreadCounts(prev => {
      if (!prev[chat.id]) return prev;
      const next = { ...prev };
      delete next[chat.id];
      return next;
    });

    // Read receipts are DM-only (see mark_thread_read for why groups aren't covered).
    // Opening a direct message is what "reading" it means here — there's no separate
    // per-message "mark as read" action, matching how every mainstream chat app works.
    if (!chat.isGroup && currentUser) {
      if (supabaseMode) {
        supabaseChat.markThreadRead(chat.id);
      } else {
        const toMark = localDb.getMessages().filter(m =>
          m.chatId === currentUser.id && m.senderId === chat.id && m.status !== 'read' && !m.deleted
        );
        if (toMark.length > 0) {
          toMark.forEach(m => {
            try { localDb.updateMessage(m.id, { status: 'read' }); } catch (err) { /* non-critical */ }
          });
          setMessages(localDb.getMessages());
        }
      }
    }
  };

  // Figures out which "thread" an incoming message belongs to, from the current user's
  // point of view. A DM's chat_id is the recipient's own id (see sendMessage below), which
  // isn't a useful bucket for the recipient themselves — for an incoming DM, the sender IS
  // the thread. A group message's chat_id already IS the thread key directly. Reads groups
  // from a ref rather than a parameter so this always sees the latest list even from inside
  // a subscription callback set up once when the effect first ran.
  const threadKeyFor = (message) => {
    const isGroupMsg = groupsRef.current.some(g => g.id === message.chatId);
    return isGroupMsg ? message.chatId : message.senderId;
  };

  // Central handler for any newly-arrived message from someone else, regardless of
  // whether it came from a Supabase Realtime event or a same-browser BroadcastChannel
  // message (local mode). This is the one place that decides: is this chat currently
  // open and focused (nothing to announce, they're already looking at it), or does it
  // need a sound + unread badge + toast + native notification?
  const handleIncomingMessage = (message) => {
    if (message.senderId === currentUser?.id) return;

    const key = threadKeyFor(message);
    const isViewingThisChat = activeChatRef.current?.id === key;
    const isTabFocused = document.visibilityState === 'visible' && document.hasFocus();

    if (isViewingThisChat && isTabFocused) return; // already looking right at it — no alert needed

    playNotificationSound();

    setUnreadCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));

    const preview = message.type === 'text' ? message.content
      : message.type === 'image' ? '📷 Sent a photo'
      : message.type === 'file' ? '📎 Sent a file'
      : message.type === 'voice' ? '🎤 Sent a voice note'
      : message.type === 'location' ? '📍 Shared a location'
      : 'New message';
    setToast({ chatKey: key, senderName: message.senderName, preview });

    if (!isTabFocused) {
      showBrowserNotification({ title: message.senderName, body: preview, tag: key });
    }
  };

  // Keep the browser tab title showing the total unread count, restoring the original
  // title once everything's read — a small, standard, genuinely useful touch rather than
  // a cosmetic flourish, since it's the one signal visible even when the tab isn't focused.
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);
    document.title = total > 0 ? `(${total}) ${BASE_TITLE}` : BASE_TITLE;
  }, [unreadCounts]);

  useEffect(() => {
    if (!currentUser) return;
    let unsubscribeMessages = () => {};
    let unsubscribeGroups = () => {};
    let unsubscribeLocal = () => {};

    const init = async () => {
      if (supabaseMode) {
        const [initialGroups, initialMsgs] = await Promise.all([
          supabaseChat.fetchGroups(),
          supabaseChat.fetchMessages()
        ]);
        setGroups(initialGroups);
        setMessages(initialMsgs);

        unsubscribeMessages = supabaseChat.subscribeToMessages(
          (newMessage) => {
            setMessages(prev => (prev.some(m => m.id === newMessage.id) ? prev : [...prev, newMessage]));
            handleIncomingMessage(newMessage);
          },
          (updatedMessage) => {
            setMessages(prev => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m));
          }
        );
        unsubscribeGroups = supabaseChat.subscribeToGroups(setGroups);
      } else {
        const initialGroups = localDb.getGroups();
        const initialMsgs = localDb.getMessages();
        setGroups(initialGroups);
        setMessages(initialMsgs);

        // Local mode's only source of "someone else sent something" is another tab in
        // this same browser, via BroadcastChannel — it can never see a different device.
        unsubscribeLocal = localDb.subscribeToChanges((data) => {
          if (data.type === 'NEW_MESSAGE') {
            setMessages(prev => {
              if (prev.some(m => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
            handleIncomingMessage(data.message);
          } else if (data.type === 'MESSAGE_UPDATED') {
            setMessages(prev => prev.map(m => m.id === data.message.id ? data.message : m));
          } else if (data.type === 'GROUPS_UPDATED') {
            setGroups(data.groups);
          } else if (data.type === 'TYPING') {
            const { userId, userName, channelKey } = data.payload;
            if (userId !== currentUser?.id && channelKey === channelKeyRef.current) {
              setTypingUsers(prev => ({ ...prev, [userId]: { userName, lastSignalAt: Date.now() } }));
            }
          }
        });
      }
    };

    init();
    return () => { unsubscribeMessages(); unsubscribeGroups(); unsubscribeLocal(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, supabaseMode]);

  // Typing indicators need their own subscription that follows the ACTIVE CHAT, not just
  // the signed-in session — unlike messages (one global subscription for everything), a
  // typing broadcast channel is scoped to a single conversation, so it has to be torn down
  // and re-created every time the open chat changes. Local mode doesn't need a separate
  // effect for this — it reuses the one global BroadcastChannel listener above, filtering
  // by channelKeyRef — this effect only does something in Supabase mode.
  useEffect(() => {
    if (!supabaseMode || !currentUser || !activeChat) return;
    const channelKey = getChatChannelKey(currentUser.id, activeChat);
    const handle = supabaseChat.subscribeToTyping(channelKey, (payload) => {
      if (payload.userId !== currentUser.id) {
        setTypingUsers(prev => ({ ...prev, [payload.userId]: { userName: payload.userName, lastSignalAt: Date.now() } }));
      }
    });
    typingChannelRef.current = handle;
    return () => {
      handle.unsubscribe();
      typingChannelRef.current = null;
    };
  }, [supabaseMode, currentUser?.id, activeChat?.id]);

  // Called from the message input on keystrokes — throttled internally, so it's safe to
  // call on every keystroke without worrying about flooding the channel.
  const sendTypingSignal = () => {
    if (!activeChat || !currentUser) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_SEND_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    const channelKey = getChatChannelKey(currentUser.id, activeChat);
    const payload = { userId: currentUser.id, userName: currentUser.name, channelKey };
    if (supabaseMode) {
      typingChannelRef.current?.send(payload);
    } else {
      localDb.broadcastTyping(payload);
    }
  };

  const buildMessage = (fields) => ({
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    chatId: activeChat.id,
    senderId: currentUser.id,
    senderName: currentUser.name,
    status: 'sent',
    timestamp: new Date().toISOString(),
    ...fields
  });

  // Every send function shares the same persist-and-report shape: build the message,
  // save it (Supabase insert or local storage), optimistically add it to state, and
  // report { success, error } rather than assuming it always works — both the Supabase
  // insert (network/RLS) and the local-mode save (localStorage quota) can genuinely fail.
  const persistNewMessage = async (newMsg) => {
    if (supabaseMode) {
      const result = await supabaseChat.insertMessage(newMsg);
      if (!result.success) return { success: false, error: result.error };
      setMessages(prev => [...prev, result.message]);
      return { success: true };
    }
    try {
      const saved = localDb.addMessage(newMsg);
      setMessages(prev => [...prev, saved]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || !activeChat || !currentUser) return { success: false };
    return persistNewMessage(buildMessage({ content: text.trim(), type: 'text' }));
  };

  const sendFileMessage = async (fileData) => {
    if (!activeChat || !currentUser) return { success: false };
    return persistNewMessage(buildMessage({
      content: `Attached File: ${fileData.fileName}`,
      type: 'file',
      fileData: {
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        fileType: fileData.fileType,
        fileUrl: fileData.fileUrl // Supabase Storage URL, or a base64 dataURL in local mode
      }
    }));
  };

  const sendImageMessage = async (imageData, caption = '') => {
    if (!activeChat || !currentUser) return { success: false };
    return persistNewMessage(buildMessage({
      content: caption || 'Shared an image',
      type: 'image',
      imageData: {
        imageUrl: imageData.imageUrl,
        thumbnailUrl: imageData.thumbnailUrl || imageData.imageUrl,
        fileName: imageData.fileName
      }
    }));
  };

  const sendLocationMessage = async (locationData) => {
    if (!activeChat || !currentUser) return { success: false };
    return persistNewMessage(buildMessage({
      content: locationData.address || 'Shared live dispatch location',
      type: 'location',
      location: {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        accuracy: locationData.accuracy ?? 10
      }
    }));
  };

  const sendVoiceMessage = async (audioData) => {
    if (!activeChat || !currentUser) return { success: false };
    return persistNewMessage(buildMessage({
      content: 'Sent a voice message',
      type: 'voice',
      audioData: { audioUrl: audioData.audioUrl, duration: audioData.duration }
    }));
  };

  // Edit your own text message
  const editMessage = async (messageId, newContent) => {
    const target = messages.find(m => m.id === messageId);
    if (!target || target.senderId !== currentUser?.id || target.deleted) return;
    if (supabaseMode) {
      const result = await supabaseChat.updateMessageRow(messageId, { content: newContent, edited: true });
      if (result.success) setMessages(prev => prev.map(m => m.id === messageId ? result.message : m));
      return;
    }
    try {
      const updated = localDb.updateMessage(messageId, { content: newContent, edited: true });
      if (updated) setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
    } catch (err) {
      // Editing text is extremely unlikely to hit the localStorage quota by itself, but
      // localDb.updateMessage can still throw (see the media-upload fix) — catching this
      // means a rare failure here logs instead of becoming an uncaught promise rejection.
      console.error('[ChatContext] editMessage failed:', err.message);
    }
  };

  // Delete your own message — soft-delete so the conversation keeps its place
  // ("This message was deleted"), the same pattern most chat apps use.
  const deleteMessage = async (messageId) => {
    const target = messages.find(m => m.id === messageId);
    if (!target || target.senderId !== currentUser?.id) return;
    if (supabaseMode) {
      const result = await supabaseChat.updateMessageRow(messageId, { deleted: true, content: '' });
      if (result.success) setMessages(prev => prev.map(m => m.id === messageId ? result.message : m));
      return;
    }
    try {
      const updated = localDb.updateMessage(messageId, { deleted: true, content: '' });
      if (updated) setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
    } catch (err) {
      console.error('[ChatContext] deleteMessage failed:', err.message);
    }
  };

  // Admin Action: Create New Group Chat Channel
  const createGroup = async (groupData) => {
    const newGroup = {
      id: `group-${Date.now()}`,
      name: groupData.name,
      description: groupData.description || '',
      isGroup: true,
      created_by: currentUser.id,
      members: [currentUser.id, ...(groupData.members || [])],
      avatar: groupData.avatar || '',
      initials: groupData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    };

    if (supabaseMode) {
      const result = await supabaseChat.insertGroup(newGroup);
      if (!result.success) return { success: false, error: result.error };
      setGroups(prev => [...prev, result.group]);
      setActiveChat(result.group);
      return { success: true, group: result.group };
    }

    const updated = [...groups, newGroup];
    setGroups(updated);
    localDb.saveGroups(updated);
    setActiveChat(newGroup);
    return { success: true, group: newGroup };
  };

  // Admin Action: Edit an existing group (rename, description, membership)
  const updateGroup = async (groupId, groupData) => {
    const fields = {
      name: groupData.name,
      description: groupData.description,
      members: groupData.members,
      initials: groupData.name ? groupData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : undefined
    };

    if (supabaseMode) {
      const result = await supabaseChat.updateGroupRow(groupId, fields);
      if (!result.success) return { success: false, error: result.error };
      setGroups(prev => prev.map(g => g.id === groupId ? result.group : g));
      // A raw state sync, not a "user opened this chat" event — using the plain setter
      // (not the setActiveChat wrapper) avoids incorrectly touching unread counts here.
      setActiveChatState(prev => (prev?.id === groupId ? result.group : prev));
      return { success: true };
    }

    const updated = groups.map(g => g.id === groupId ? {
      ...g,
      name: groupData.name ?? g.name,
      description: groupData.description ?? g.description,
      members: groupData.members ?? g.members,
      initials: groupData.name ? groupData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : g.initials
    } : g);
    setGroups(updated);
    localDb.saveGroups(updated);
    setActiveChatState(prev => (prev?.id === groupId ? updated.find(g => g.id === groupId) : prev));
    return { success: true };
  };

  // Admin Action: Delete a group channel
  const deleteGroup = async (groupId) => {
    if (supabaseMode) {
      const result = await supabaseChat.deleteGroupRow(groupId);
      if (!result.success) return { success: false, error: result.error };
      setGroups(prev => prev.filter(g => g.id !== groupId));
      setActiveChatState(prev => (prev?.id === groupId ? null : prev));
      return { success: true };
    }
    const updated = groups.filter(g => g.id !== groupId);
    setGroups(updated);
    localDb.saveGroups(updated);
    setActiveChatState(prev => (prev?.id === groupId ? null : prev));
    return { success: true };
  };

  // Get active chat messages
  const activeMessages = messages.filter(m => {
    if (!activeChat) return false;
    if (activeChat.isGroup) {
      return m.chatId === activeChat.id;
    } else {
      // 1-on-1 direct chat check (sender is me and chat recipient is active user, OR sender is active user and recipient is me)
      const directIdKey = [currentUser?.id, activeChat.id].sort().join('_');
      return m.chatId === directIdKey || (m.chatId === activeChat.id && m.senderId === currentUser?.id) || (m.senderId === activeChat.id && m.chatId === currentUser?.id);
    }
  });

  // Names of whoever is typing in the active chat right now, for display — derived here
  // rather than exposing the raw { userId: {...} } map, since no consumer needs the ids.
  const typingUserNames = Object.values(typingUsers).map(u => u.userName);

  return (
    <ChatContext.Provider value={{
      groups,
      messages: activeMessages,
      activeChat,
      setActiveChat,
      searchQuery,
      setSearchQuery,
      sendMessage,
      sendFileMessage,
      sendImageMessage,
      sendLocationMessage,
      sendVoiceMessage,
      editMessage,
      deleteMessage,
      createGroup,
      updateGroup,
      deleteGroup,
      unreadCounts,
      toast,
      dismissToast: () => setToast(null),
      typingUserNames,
      sendTypingSignal
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
