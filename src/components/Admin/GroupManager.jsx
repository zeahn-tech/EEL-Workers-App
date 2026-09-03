import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { GroupCreator } from './GroupCreator';
import { Hash, Users, Pencil, Trash2, Plus, Search } from 'lucide-react';

export const GroupManager = () => {
  const { groups, deleteGroup } = useChat();
  const { users } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingGroup, setEditingGroup] = useState(null); // group object or null
  const [creatingNew, setCreatingNew] = useState(false);

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (group) => {
    if (!window.confirm(`Delete the "${group.name}" channel? This removes it for everyone — message history stays intact but the channel disappears from the sidebar.`)) return;
    const result = await deleteGroup(group.id);
    if (result && !result.success) alert(`Could not delete channel: ${result.error}`);
  };

  const memberNames = (group) =>
    group.members
      .map(id => users.find(u => u.id === id)?.name)
      .filter(Boolean)
      .join(', ');

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} color="var(--text-dim)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: 32 }}
            placeholder="Search channels..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setCreatingNew(true)} style={{ flexShrink: 0 }}>
          <Plus size={15} /> New Group
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
          {groups.length === 0 ? 'No group channels yet — create your first one.' : 'No channels match your search.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {filtered.map(g => (
            <div key={g.id} className="glass-panel" style={{
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: 'var(--bg-tertiary)', color: 'var(--amber-primary)',
                  fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Hash size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {g.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {g.description || 'No description'}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)',
                marginBottom: '12px'
              }}>
                <Users size={12} />
                <span title={memberNames(g)}>{g.members.length} member{g.members.length !== 1 ? 's' : ''}</span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setEditingGroup(g)}
                  style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}>
                  <Pencil size={13} /> Edit
                </button>
                <button className="btn btn-danger" onClick={() => handleDelete(g)}
                  style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <GroupCreator isOpen={creatingNew} onClose={() => setCreatingNew(false)} />
      <GroupCreator isOpen={!!editingGroup} onClose={() => setEditingGroup(null)} editingGroup={editingGroup} />
    </div>
  );
};
