import React, { useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, X } from 'lucide-react';

const AUTO_DISMISS_MS = 6000;

export const MessageToast = () => {
  const { toast, dismissToast, groups, setActiveChat } = useChat();
  const { users } = useAuth();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;

  const handleClick = () => {
    const group = groups.find(g => g.id === toast.chatKey);
    const user = users.find(u => u.id === toast.chatKey);
    const target = group || user;
    if (target) setActiveChat(target);
    dismissToast();
  };

  return (
    <div
      onClick={handleClick}
      className="animate-fade-in"
      style={{
        position: 'fixed', top: 70, right: 16, zIndex: 500, maxWidth: 320,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-amber)',
        borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
        cursor: 'pointer'
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--amber-light)',
        color: 'var(--amber-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <MessageSquare size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
          {toast.senderName}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {toast.preview}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); dismissToast(); }}
        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0, padding: 2 }}
      >
        <X size={14} />
      </button>
    </div>
  );
};
