import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useVoiceRecorder, blobToDataUrl } from '../../hooks/useVoiceRecorder';
import { uploadChatMedia } from '../../services/supabaseAuth';
import { MessageBubble } from './MessageBubble';
import { FilePickerModal } from './FilePickerModal';
import { ImagePickerModal } from './ImagePickerModal';
import { LocationShareModal } from './LocationShareModal';
import { AttachmentMenu } from './AttachmentMenu';
import { Lightbox } from '../UI/Lightbox';
import { Send, Plus, Hash, Lock, Trash2, Send as SendIcon, X } from 'lucide-react';

// Supabase mode uploads the real recording to Storage, so a full 5-minute voice note is
// genuinely reliable — there's no meaningful ceiling below Supabase's own project limits.
const VOICE_MAX_SECONDS_SUPABASE = 300; // 5 minutes

// Local (offline) mode has no server — the recording gets embedded as base64 text
// directly in the message, persisted to browser localStorage's few-MB total quota. A
// typical voice recording runs roughly 200-500KB per minute depending on the browser's
// codec choice, so this cap is set well within what reliably fits, the same reasoning
// used for the local-mode file/image caps.
const VOICE_MAX_SECONDS_LOCAL = 60; // 1 minute

const formatDuration = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export const ChatArea = () => {
  const { currentUser, isSuspended, isBanned, supabaseMode, isUserOnline, getLastSeen } = useAuth();
  const {
    activeChat, messages, sendMessage, sendFileMessage, sendImageMessage,
    sendLocationMessage, sendVoiceMessage, editMessage, deleteMessage
  } = useChat();
  const maxRecordingSeconds = supabaseMode ? VOICE_MAX_SECONDS_SUPABASE : VOICE_MAX_SECONDS_LOCAL;
  const { isRecording, elapsedSeconds, error: recordError, startRecording, stopRecording, cancelRecording } = useVoiceRecorder(maxRecordingSeconds);

  const [inputText, setInputText] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [lightbox, setLightbox] = useState({ open: false, url: '', name: '' });
  const [sendError, setSendError] = useState('');
  const [isSendingVoice, setIsSendingVoice] = useState(false);

  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isSuspended || isBanned) return;
    const result = sendMessage(inputText);
    if (result && !result.success && result.error) {
      setSendError(result.error);
      return; // keep the typed text so nothing is lost
    }
    setSendError('');
    setInputText('');
  };

  const handleMicClick = () => {
    if (isSuspended || isBanned || !activeChat) return;
    startRecording();
  };

  const handleStopAndSend = async () => {
    const result = await stopRecording();
    if (!result) return;

    setIsSendingVoice(true);
    setSendError('');

    let audioUrl;
    if (supabaseMode) {
      // Upload the real recording to Storage — the message only ever holds the resulting
      // URL, which is what makes a full 5-minute voice note actually reliable to send.
      const ext = result.mimeType.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([result.blob], `voice-note-${Date.now()}.${ext}`, { type: result.mimeType });
      const uploadResult = await uploadChatMedia(activeChat?.id || 'general', file);
      if (!uploadResult.success) {
        setSendError(uploadResult.error || 'Voice note upload failed. Please try again.');
        setIsSendingVoice(false);
        return;
      }
      audioUrl = uploadResult.url;
    } else {
      // Local mode: no server to upload to, so the recording is embedded as base64 —
      // kept within reach of localStorage's quota by the shorter local-mode duration cap.
      try {
        audioUrl = await blobToDataUrl(result.blob);
      } catch (err) {
        setSendError(err.message || 'Could not process the recording.');
        setIsSendingVoice(false);
        return;
      }
    }

    const sendResult = sendVoiceMessage({ audioUrl, duration: result.duration });
    if (sendResult && !sendResult.success && sendResult.error) setSendError(sendResult.error);
    setIsSendingVoice(false);
  };

  const handleSendFile = (fileData) => {
    const result = sendFileMessage(fileData);
    if (result && !result.success && result.error) setSendError(result.error);
  };

  const handleSendImage = (imageData, caption) => {
    const result = sendImageMessage(imageData, caption);
    if (result && !result.success && result.error) setSendError(result.error);
  };

  const handleSendLocation = (locationData) => {
    const result = sendLocationMessage(locationData);
    if (result && !result.success && result.error) setSendError(result.error);
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
                : (() => {
                    const online = isUserOnline(activeChat.id);
                    const lastSeen = !online && getLastSeen(activeChat.id);
                    return `${activeChat.department || 'Direct Message'} · ${
                      online ? '🟢 Online' : lastSeen ? `⚫ Last seen ${lastSeen}` : '⚫ Offline'
                    }`;
                  })()}
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
      ) : isRecording || isSendingVoice ? (
        /* RECORDING IN PROGRESS BAR */
        <div className="glass-panel" style={{
          padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: isSendingVoice ? 'var(--amber-primary)' : '#EF4444',
            animation: 'pulseGlow 1s infinite ease-in-out', flexShrink: 0
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', flexShrink: 0 }}>
            {isSendingVoice ? 'Uploading voice note…' : `Recording… ${formatDuration(elapsedSeconds)}`}
          </span>
          {!isSendingVoice && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', flex: 1 }}>
              Max {maxRecordingSeconds >= 60 ? `${Math.round(maxRecordingSeconds / 60)} min` : `${maxRecordingSeconds}s`}
              {!supabaseMode && ' (offline mode)'}
            </span>
          )}
          <button onClick={cancelRecording} className="btn btn-secondary btn-icon" disabled={isSendingVoice}
            title="Cancel recording" style={{ width: 36, height: 36, minHeight: 36, flexShrink: 0 }}>
            <Trash2 size={16} color="#FCA5A5" />
          </button>
          <button onClick={handleStopAndSend} className="btn btn-primary" disabled={isSendingVoice || !isRecording}
            title="Send voice note" style={{ minHeight: 36, flexShrink: 0 }}>
            <SendIcon size={15} /> <span className="mobile-hide">{isSendingVoice ? 'Sending…' : 'Send'}</span>
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

      {(sendError || recordError) && (
        <div style={{
          padding: '8px 16px', flexShrink: 0, background: 'rgba(239,68,68,0.15)',
          borderTop: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
        }}>
          <span>{sendError || recordError}</span>
          {sendError && (
            <button onClick={() => setSendError('')} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', flexShrink: 0 }}>
              <X size={14} />
            </button>
          )}
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
      <FilePickerModal isOpen={fileOpen} onClose={() => setFileOpen(false)} onSendFile={handleSendFile}
        chatId={activeChat?.id} supabaseMode={supabaseMode} />
      <ImagePickerModal isOpen={imageOpen} onClose={() => setImageOpen(false)} onSendImage={handleSendImage}
        chatId={activeChat?.id} supabaseMode={supabaseMode} />
      <LocationShareModal isOpen={locationOpen} onClose={() => setLocationOpen(false)} onSendLocation={handleSendLocation} />
      {lightbox.open && <Lightbox imageUrl={lightbox.url} fileName={lightbox.name} onClose={() => setLightbox({ open: false, url: '', name: '' })} />}
    </div>
  );
};
