import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Search, Plus, Hash, User, Settings } from 'lucide-react';

export const ChatSidebar = ({ onOpenGroupCreator, onSelectChat, onOpenAdmin, onOpenProfile }) => {
  const { users, currentUser, isAdmin } = useAuth();
  const { groups, activeChat, setActiveChat, searchQuery, setSearchQuery } = useChat();

  const handleSelect = (item) => {
    setActiveChat(item);
    if (onSelectChat) onSelectChat();
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    u.id !== currentUser?.id &&
    u.status !== 'Deleted' &&
    (u.name.toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      u.department.toLowerCase().includes((searchQuery || '').toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Sidebar Header */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>Channels & Staff</span>
          {isAdmin && (
            <button className="btn btn-primary" onClick={onOpenGroupCreator}
              style={{ padding: '4px 10px', fontSize: 11, minHeight: 30 }}>
              <Plus size={13} /> New Group
            </button>
          )}
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} color="var(--text-dim)"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" className="input-field"
            style={{ paddingLeft: 32, fontSize: 13, minHeight: 34 }}
            placeholder="Search channels or staff..."
            value={searchQuery || ''}
            onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Scrollable List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', WebkitOverflowScrolling: 'touch' }}>

        {/* GROUP CHANNELS */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber-primary)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '2px 6px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Hash size={11} /> Channels ({filteredGroups.length})
        </p>
        {filteredGroups.map(g => {
          const active = activeChat?.id === g.id;
          return (
            <button key={g.id} onClick={() => handleSelect(g)} style={{
              width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: 'none',
              background: active ? 'var(--amber-light)' : 'transparent',
              borderLeft: `3px solid ${active ? 'var(--amber-primary)' : 'transparent'}`,
              color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', textAlign: 'left', marginBottom: 2, transition: 'all 0.15s ease'
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: 'var(--bg-tertiary)',
                color: 'var(--amber-primary)', fontWeight: 700, fontSize: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{g.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--amber-primary)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {g.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{g.members.length} members</div>
              </div>
            </button>
          );
        })}

        {/* DIRECT MESSAGES */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber-primary)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '10px 6px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <User size={11} /> Staff ({filteredUsers.length})
        </p>
        {filteredUsers.map(u => {
          const active = activeChat?.id === u.id;
          return (
            <button key={u.id} onClick={() => handleSelect(u)} style={{
              width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: 'none',
              background: active ? 'var(--amber-light)' : 'transparent',
              borderLeft: `3px solid ${active ? 'var(--amber-primary)' : 'transparent'}`,
              color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', textAlign: 'left', marginBottom: 2,
              opacity: u.status !== 'Active' ? 0.6 : 1
            }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                  background: u.status === 'Banned' ? '#EF4444' : u.status === 'Suspended' ? '#F59E0B' : 'var(--bg-tertiary)',
                  color: u.status !== 'Active' ? '#fff' : 'var(--amber-primary)',
                  fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {u.avatar
                    ? <img src={u.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : u.initials
                  }
                </div>
                {u.status === 'Active' && (
                  <div style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: u.online ? '#10B981' : 'var(--text-dim)',
                    border: '2px solid var(--bg-secondary)',
                    position: 'absolute', bottom: 0, right: 0
                  }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--amber-primary)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.name}
                  </span>
                  {u.status !== 'Active' && (
                    <span className={`badge badge-${u.status.toLowerCase()}`} style={{ fontSize: 8, padding: '1px 5px', flexShrink: 0 }}>
                      {u.status}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.department}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer — account + admin settings, moved here to keep the top header clean */}
      <div style={{
        flexShrink: 0, padding: '10px', borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <button
          onClick={onOpenProfile}
          title="Account Settings"
          style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderRadius: 'var(--radius-md)', padding: '6px 8px', textAlign: 'left'
          }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: 'var(--bg-tertiary)', color: 'var(--amber-primary)',
            fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {currentUser?.avatar
              ? <img src={currentUser.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (currentUser?.initials || '?')
            }
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.role}
            </div>
          </div>
        </button>

        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            title="Admin Dashboard"
            className="btn btn-secondary btn-icon"
            style={{ flexShrink: 0, color: 'var(--amber-primary)' }}
          >
            <Settings size={17} />
          </button>
        )}
      </div>
    </div>
  );
};
