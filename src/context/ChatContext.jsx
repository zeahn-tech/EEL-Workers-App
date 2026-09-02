import React, { createContext, useContext, useState, useEffect } from 'react';
import { localDb } from '../services/localDb';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [groups, setGroups] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // { id, name, isGroup, ... }
  const [searchQuery, setSearchQuery] = useState('');

  // Play notification chime using Web Audio API
  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      // Audio autoplay policy ignored silently
    }
  };

  useEffect(() => {
    const initialGroups = localDb.getGroups();
    const initialMsgs = localDb.getMessages();
    setGroups(initialGroups);
    setMessages(initialMsgs);

    // Default to the first general group channel on load
    if (initialGroups.length > 0 && !activeChat) {
      setActiveChat(initialGroups[0]);
    }

    // Subscribe to multi-tab real-time sync
    const unsubscribe = localDb.subscribeToChanges((data) => {
      if (data.type === 'NEW_MESSAGE') {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          if (data.message.senderId !== currentUser?.id) {
            playNotificationSound();
          }
          return [...prev, data.message];
        });
      } else if (data.type === 'MESSAGE_UPDATED') {
        setMessages(prev => prev.map(m => m.id === data.message.id ? data.message : m));
      } else if (data.type === 'GROUPS_UPDATED') {
        setGroups(data.groups);
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Send standard text message
  const sendMessage = (text) => {
    if (!text.trim() || !activeChat || !currentUser) return { success: false };

    const newMsg = {
      chatId: activeChat.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: text.trim(),
      type: 'text',
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    try {
      const saved = localDb.addMessage(newMsg);
      setMessages(prev => [...prev, saved]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Send attachment file (File Picker). `fileData.fileUrl` may be a real Supabase Storage
  // URL (Supabase mode — see uploadChatMedia) or a base64 data URL (local mode, where
  // there's no server to upload to). Either way this function just persists the message;
  // it returns { success, error } instead of assuming it always works, because the local-
  // mode base64 path can still legitimately fail if it pushes localStorage over quota.
  const sendFileMessage = (fileData) => {
    if (!activeChat || !currentUser) return { success: false };

    const newMsg = {
      chatId: activeChat.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: `Attached File: ${fileData.fileName}`,
      type: 'file',
      fileData: {
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        fileType: fileData.fileType,
        fileUrl: fileData.fileUrl // Supabase Storage URL, or a base64 dataURL in local mode
      },
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    try {
      const saved = localDb.addMessage(newMsg);
      setMessages(prev => [...prev, saved]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Send photo/image (Image Picker). Same shape as sendFileMessage — imageUrl may be a
  // real Storage URL or a local-mode base64 data URL.
  const sendImageMessage = (imageData, caption = '') => {
    if (!activeChat || !currentUser) return { success: false };

    const newMsg = {
      chatId: activeChat.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: caption || 'Shared an image',
      type: 'image',
      imageData: {
        imageUrl: imageData.imageUrl,
        thumbnailUrl: imageData.thumbnailUrl || imageData.imageUrl,
        fileName: imageData.fileName
      },
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    try {
      const saved = localDb.addMessage(newMsg);
      setMessages(prev => [...prev, saved]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Send GPS location (Location Picker)
  const sendLocationMessage = (locationData) => {
    if (!activeChat || !currentUser) return { success: false };

    const newMsg = {
      chatId: activeChat.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: locationData.address || 'Shared live dispatch location',
      type: 'location',
      location: {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        accuracy: locationData.accuracy ?? 10
      },
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    try {
      const saved = localDb.addMessage(newMsg);
      setMessages(prev => [...prev, saved]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Send a recorded voice note. `audioData.audioUrl` may be a real Storage URL (Supabase
  // mode) or a base64 data URL (local mode).
  const sendVoiceMessage = (audioData) => {
    if (!activeChat || !currentUser) return { success: false };

    const newMsg = {
      chatId: activeChat.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: 'Sent a voice message',
      type: 'voice',
      audioData: {
        audioUrl: audioData.audioUrl,
        duration: audioData.duration  // seconds
      },
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    try {
      const saved = localDb.addMessage(newMsg);
      setMessages(prev => [...prev, saved]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Edit your own text message
  const editMessage = (messageId, newContent) => {
    const target = messages.find(m => m.id === messageId);
    if (!target || target.senderId !== currentUser?.id || target.deleted) return;
    const updated = localDb.updateMessage(messageId, { content: newContent, edited: true });
    if (updated) setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
  };

  // Delete your own message — soft-delete so the conversation keeps its place
  // ("This message was deleted"), the same pattern most chat apps use.
  const deleteMessage = (messageId) => {
    const target = messages.find(m => m.id === messageId);
    if (!target || target.senderId !== currentUser?.id) return;
    const updated = localDb.updateMessage(messageId, { deleted: true, content: '' });
    if (updated) setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
  };

  // Admin Action: Create New Group Chat Channel
  const createGroup = (groupData) => {
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

    const updated = [...groups, newGroup];
    setGroups(updated);
    localDb.saveGroups(updated);
    setActiveChat(newGroup);
    return newGroup;
  };

  // Admin Action: Edit an existing group (rename, description, membership)
  const updateGroup = (groupId, groupData) => {
    const updated = groups.map(g => g.id === groupId ? {
      ...g,
      name: groupData.name ?? g.name,
      description: groupData.description ?? g.description,
      members: groupData.members ?? g.members,
      initials: groupData.name ? groupData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : g.initials
    } : g);
    setGroups(updated);
    localDb.saveGroups(updated);
    setActiveChat(prev => (prev?.id === groupId ? updated.find(g => g.id === groupId) : prev));
  };

  // Admin Action: Delete a group channel
  const deleteGroup = (groupId) => {
    const updated = groups.filter(g => g.id !== groupId);
    setGroups(updated);
    localDb.saveGroups(updated);
    setActiveChat(prev => (prev?.id === groupId ? null : prev));
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
      deleteGroup
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
