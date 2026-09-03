import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  MapPin,
  ExternalLink,
  CheckCheck,
  Check,
  Image as ImageIcon,
  Play,
  Pause,
  MoreVertical,
  Pencil,
  Trash2,
  X as XIcon,
  Ban
} from 'lucide-react';

const formatDuration = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

// A plain `<a download>` only forces a real "save as" for same-origin URLs — browsers
// silently ignore the `download` attribute for cross-origin ones, so a Supabase Storage
// file link would just navigate to/open the file instead of downloading it, with no
// indication anything different happened. Fetching the bytes and creating a local object
// URL sidesteps that entirely and gives a genuine download regardless of where the file
// actually lives. Same-origin base64 data URLs (local/offline mode) already download
// correctly on their own, so this only needs to intervene for real http(s) URLs.
const downloadAttachment = async (url, fileName) => {
  if (!url.startsWith('http')) {
    // data: URL (local mode) — the plain anchor `download` attribute already works here.
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'file';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName || 'file';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    // CORS or network issue — fall back to just opening it so the person can still save
    // it manually, rather than the click silently doing nothing at all.
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

// Simple custom audio player — play/pause + progress bar + duration, styled to match
// the bubble it sits in (dark bubble vs amber "my message" bubble).
const VoiceMessagePlayer = ({ audioData, isMe }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onEnd = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  const barColor = isMe ? 'rgba(15,23,42,0.35)' : 'var(--bg-tertiary)';
  const fillColor = isMe ? 'var(--navy-dark)' : 'var(--amber-primary)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
      <audio ref={audioRef} src={audioData.audioUrl} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer',
          background: isMe ? 'var(--navy-dark)' : 'var(--amber-primary)',
          color: isMe ? 'var(--amber-primary)' : 'var(--navy-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
        {playing ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: 1 }} />}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ height: 4, borderRadius: 2, background: barColor, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: fillColor, transition: 'width 0.1s linear' }} />
        </div>
        <div style={{ fontSize: 10, opacity: 0.8, marginTop: 3 }}>
          {formatDuration(playing || currentTime ? currentTime : audioData.duration)}
        </div>
      </div>
    </div>
  );
};

export const MessageBubble = ({ message, isMe, onOpenLightbox, onEdit, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const formatTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const canEdit = isMe && !message.deleted && message.type === 'text';
  const canDelete = isMe && !message.deleted;

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit(message.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleDeleteClick = () => {
    setShowMenu(false);
    if (window.confirm('Delete this message? This cannot be undone.')) {
      onDelete(message.id);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isMe ? 'flex-end' : 'flex-start',
      marginBottom: '16px',
      maxWidth: '100%'
    }}>
      {/* Sender Name for incoming messages */}
      {!isMe && (
        <span style={{
          fontSize: '11px',
          color: 'var(--amber-primary)',
          fontWeight: 600,
          marginBottom: '4px',
          paddingLeft: '4px'
        }}>
          {message.senderName}
        </span>
      )}

      {/* Bubble Row (bubble + action menu trigger) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexDirection: isMe ? 'row-reverse' : 'row' }}>
        {(canEdit || canDelete) && !isEditing && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(v => !v)}
              title="Message options"
              style={{
                width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'var(--text-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
              <MoreVertical size={14} />
            </button>
            {showMenu && (
              <>
                <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                <div className="dropdown-panel amber-border animate-fade-in" style={{
                  position: 'absolute', top: 24, [isMe ? 'right' : 'left']: 0, width: 130,
                  borderRadius: 'var(--radius-md)', padding: 4, zIndex: 200, boxShadow: 'var(--shadow-lg)'
                }}>
                  {canEdit && (
                    <button onClick={() => { setIsEditing(true); setShowMenu(false); }}
                      style={{
                        width: '100%', padding: '7px 8px', borderRadius: 'var(--radius-sm)', border: 'none',
                        cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7,
                        background: 'transparent', color: 'var(--text-main)', fontSize: 12, fontWeight: 600
                      }}>
                      <Pencil size={13} /> Edit
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={handleDeleteClick}
                      style={{
                        width: '100%', padding: '7px 8px', borderRadius: 'var(--radius-sm)', border: 'none',
                        cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7,
                        background: 'transparent', color: '#FCA5A5', fontSize: 12, fontWeight: 600
                      }}>
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Bubble Container */}
        <div style={{
          maxWidth: '75vw',
          width: isEditing ? '320px' : undefined,
          background: message.deleted ? 'transparent' : (isMe ? 'var(--amber-primary)' : 'var(--bg-secondary)'),
          color: isMe ? 'var(--navy-dark)' : 'var(--text-main)',
          borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
          padding: message.deleted ? '8px 14px' : '12px 16px',
          boxShadow: message.deleted ? 'none' : (isMe ? '0 4px 14px rgba(245, 158, 11, 0.25)' : '0 4px 12px rgba(0, 0, 0, 0.3)'),
          border: message.deleted ? '1px dashed var(--border-subtle)' : (isMe ? 'none' : '1px solid var(--border-subtle)'),
          position: 'relative'
        }}>
          {/* DELETED MESSAGE */}
          {message.deleted ? (
            <p style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ban size={13} /> This message was deleted
            </p>
          ) : isEditing ? (
            /* EDIT MODE */
            <div>
              <textarea
                autoFocus
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                style={{
                  width: '100%', minHeight: 60, fontSize: 14, lineHeight: 1.5, resize: 'vertical',
                  background: 'rgba(15,23,42,0.15)', border: '1px solid rgba(15,23,42,0.3)',
                  borderRadius: 8, padding: 8, color: 'inherit', fontFamily: 'inherit'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                <button onClick={() => setIsEditing(false)} style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'rgba(15,23,42,0.15)', color: 'inherit', display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <XIcon size={12} /> Cancel
                </button>
                <button onClick={handleSaveEdit} style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'var(--navy-dark)', color: 'var(--amber-primary)', display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <Check size={12} /> Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TEXT MESSAGE */}
              {message.type === 'text' && (
                <p style={{
                  fontSize: '14px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontWeight: isMe ? 500 : 400
                }}>
                  {message.content}
                </p>
              )}

              {/* VOICE MESSAGE */}
              {message.type === 'voice' && message.audioData && (
                <VoiceMessagePlayer audioData={message.audioData} isMe={isMe} />
              )}

              {/* FILE ATTACHMENT MESSAGE */}
              {message.type === 'file' && message.fileData && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: isMe ? 'rgba(15, 23, 42, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    border: isMe ? '1px solid rgba(15, 23, 42, 0.2)' : '1px solid var(--border-amber)',
                    borderRadius: '10px',
                    padding: '10px 14px'
                  }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: isMe ? 'var(--navy-dark)' : 'var(--amber-light)',
                      color: isMe ? 'var(--amber-primary)' : 'var(--amber-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <FileText size={20} />
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        color: isMe ? 'var(--navy-dark)' : 'var(--text-main)'
                      }}>
                        {message.fileData.fileName}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>
                        {message.fileData.fileSize}
                      </div>
                    </div>

                    <button
                      onClick={() => downloadAttachment(message.fileData.fileUrl, message.fileData.fileName)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: isMe ? 'var(--navy-dark)' : 'var(--amber-primary)',
                        color: isMe ? 'var(--amber-primary)' : 'var(--navy-dark)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                      title="Download Attachment"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                  {message.content && message.content !== `Attached File: ${message.fileData.fileName}` && (
                    <p style={{ marginTop: '8px', fontSize: '13px' }}>{message.content}</p>
                  )}
                </div>
              )}

              {/* IMAGE ATTACHMENT MESSAGE */}
              {message.type === 'image' && message.imageData && (
                <div>
                  <div
                    onClick={() => onOpenLightbox(message.imageData.imageUrl, message.imageData.fileName)}
                    style={{
                      borderRadius: '10px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      position: 'relative',
                      maxHeight: '220px',
                      background: '#000'
                    }}
                  >
                    <img
                      src={message.imageData.imageUrl}
                      alt="Shared cargo photo"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      background: 'rgba(15, 23, 42, 0.75)',
                      color: 'white',
                      borderRadius: 'full',
                      padding: '4px 8px',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <ImageIcon size={12} />
                      <span>Click to expand</span>
                    </div>
                  </div>
                  {message.content && message.content !== 'Shared an image' && (
                    <p style={{ marginTop: '8px', fontSize: '13px', fontWeight: 500 }}>{message.content}</p>
                  )}
                </div>
              )}

              {/* LOCATION MESSAGE */}
              {message.type === 'location' && message.location && (
                <div style={{ width: '280px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    marginBottom: '6px',
                    color: isMe ? 'var(--navy-dark)' : 'var(--amber-primary)'
                  }}>
                    <MapPin size={16} />
                    <span>Live GPS Dispatch Pinpoint</span>
                  </div>

                  {/* Static Leaflet Embed */}
                  <div style={{
                    height: '130px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(0,0,0,0.2)',
                    marginBottom: '8px',
                    position: 'relative'
                  }}>
                    <iframe
                      title="Message location map"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${message.location.longitude - 0.005}%2C${message.location.latitude - 0.005}%2C${message.location.longitude + 0.005}%2C${message.location.latitude + 0.005}&layer=mapnik&marker=${message.location.latitude}%2C${message.location.longitude}`}
                    />
                  </div>

                  <p style={{ fontSize: '12px', lineHeight: 1.3, marginBottom: '8px', fontWeight: 500 }}>
                    {message.location.address}
                  </p>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${message.location.latitude},${message.location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{
                      width: '100%',
                      fontSize: '11px',
                      padding: '6px 10px',
                      background: isMe ? 'var(--navy-dark)' : 'var(--amber-primary)',
                      color: isMe ? 'var(--amber-primary)' : 'var(--navy-dark)',
                      fontWeight: 700
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>Open in Google Maps</span>
                  </a>
                </div>
              )}

              {/* Footer Meta (Timestamp + Edited tag + Status Ticks) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '4px',
                marginTop: '4px',
                fontSize: '10px',
                opacity: 0.8
              }}>
                {message.edited && <span style={{ fontStyle: 'italic' }}>edited</span>}
                <span>{formatTime(message.timestamp)}</span>
                {isMe && (
                  <span>
                    {message.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} />}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
