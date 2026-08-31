import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { MessageBubble } from './MessageBubble';
import { FilePickerModal } from './FilePickerModal';
import { ImagePickerModal } from './ImagePickerModal';
import { LocationShareModal } from './LocationShareModal';
import { AttachmentMenu } from './AttachmentMenu';
import { Lightbox } from '../UI/Lightbox';
import { Send, Plus, Hash, Lock, Trash2, Send as SendIcon } from 'lucide-react';

const formatDuration = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export const ChatArea = () => {
  const { currentUser, isSuspended, isBanned } = useAuth();
  const {
    activeChat, messages, sendMessage, sendFileMessage, sendImageMessage,
    sendLocationMessage, sendVoiceMessage, editMessage, deleteMessage
  } = useChat();
  const { isRecording, elapsedSeconds, error: recordError, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  const [inputText, setInputText] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [lightbox, setLightbox] = useState({ open: false, url: '', name: '' });

  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isSuspended || isBanned) return;
    sendMessage(inputText);
    setInputText('');
  };

  const handleMicClick = () => {
    if (isSuspended || isBanned || !activeChat) return;
    startRecording();
  };

  const handleStopAndSend = async () => {
    const result = await stopRecording();
    if (result) sendVoiceMessage(result);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* Chat Top Bar */}
      {activeChat ? (
        <div className="glass-panel" style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: activeChat.isGroup ? 10 : '50%',
            background: 'var(--amber-primary)', color: '#0F172A',
            fontWeight: 800, fontSize: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {activeChat.initials || 'CH'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeChat.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {activeChat.isGroup
                ? `Group Channel · ${activeChat.members?.length || 0} members`
                : `${activeChat.department || 'Direct Message'} · ${activeChat.online ? '🟢 Online' : '⚫ Offline'}`}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select a channel or staff member to start messaging</div>
        </div>
      )}

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', WebkitOverflowScrolling: 'touch' }}>
        {!activeChat ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Hash size={44} color="var(--amber-primary)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>No Dispatch Channel Selected</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Use the sidebar to pick a group or staff member.</p>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            Start of messages in <strong>{activeChat.name}</strong>
          </div>
        ) : (
          messages.map(m => (
            <MessageBubble key={m.id} message={m} isMe={m.senderId === currentUser?.id}
              onOpenLightbox={(url, name) => setLightbox({ open: true, url, name })}
              onEdit={editMessage}
              onDelete={deleteMessage} />
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Input / Status Bar */}
      {(isSuspended || isBanned) ? (
        <div style={{
          padding: '12px 16px', flexShrink: 0,
          background: isBanned ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
          borderTop: `1px solid ${isBanned ? '#EF4444' : '#F59E0B'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 13, fontWeight: 600
        }}>
          <Lock size={16} />
          {isBanned ? 'Account BANNED. Messaging locked.' : 'Account SUSPENDED. Contact Admin.'}
        </div>
      ) : isRecording ? (
        /* RECORDING IN PROGRESS BAR */
        <div className="glass-panel" style={{
          padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: '#EF4444',
            animation: 'pulseGlow 1s infinite ease-in-out', flexShrink: 0
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', flexShrink: 0 }}>
            Recording… {formatDuration(elapsedSeconds)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', flex: 1 }}>Max 2 minutes</span>
          <button onClick={cancelRecording} className="btn btn-secondary btn-icon"
            title="Cancel recording" style={{ width: 36, height: 36, minHeight: 36, flexShrink: 0 }}>
            <Trash2 size={16} color="#FCA5A5" />
          </button>
          <button onClick={handleStopAndSend} className="btn btn-primary"
            title="Send voice note" style={{ minHeight: 36, flexShrink: 0 }}>
            <SendIcon size={15} /> <span className="mobile-hide">Send</span>
          </button>
        </div>
      ) : (
        <div className="glass-panel" style={{
          padding: '8px 12px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0
        }}>
          {/* Attach — opens a popup with document / image / location / voice note */}
          <button className="btn btn-secondary btn-icon" onClick={() => setAttachOpen(true)} disabled={!activeChat}
            style={{ width: 36, height: 36, minHeight: 36 }} title="Attach">
            <Plus size={18} color="var(--amber-primary)" />
          </button>

          {/* Text Input */}
          <form onSubmit={handleSend} style={{ flex: 1, display: 'flex', gap: 6 }}>
            <input type="text" className="input-field"
              placeholder={activeChat ? `Message ${activeChat.name}…` : 'Select a chat first…'}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              disabled={!activeChat}
              style={{ flex: 1, fontSize: 16, padding: '8px 12px', minHeight: 36 }} />
            <button type="submit" className="btn btn-primary"
              disabled={!inputText.trim() || !activeChat}
              style={{ padding: '8px 14px', minHeight: 36, flexShrink: 0 }}>
              <Send size={16} />
              <span className="mobile-hide">Send</span>
            </button>
          </form>
        </div>
      )}

      {recordError && (
        <div style={{
          padding: '8px 16px', flexShrink: 0, background: 'rgba(239,68,68,0.15)',
          borderTop: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', fontSize: 12
        }}>
          {recordError}
        </div>
      )}

      {/* Modals */}
      <AttachmentMenu
        isOpen={attachOpen}
        onClose={() => setAttachOpen(false)}
        onFile={() => setFileOpen(true)}
        onImage={() => setImageOpen(true)}
        onLocation={() => setLocationOpen(true)}
        onVoice={handleMicClick}
        voiceDisabled={!activeChat}
      />
      <FilePickerModal isOpen={fileOpen} onClose={() => setFileOpen(false)} onSendFile={sendFileMessage} />
      <ImagePickerModal isOpen={imageOpen} onClose={() => setImageOpen(false)} onSendImage={sendImageMessage} />
      <LocationShareModal isOpen={locationOpen} onClose={() => setLocationOpen(false)} onSendLocation={sendLocationMessage} />
      {lightbox.open && <Lightbox imageUrl={lightbox.url} fileName={lightbox.name} onClose={() => setLightbox({ open: false, url: '', name: '' })} />}
    </div>
  );
};
