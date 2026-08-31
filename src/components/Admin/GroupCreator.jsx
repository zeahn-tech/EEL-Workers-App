import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Users, X, CheckSquare, Square, Hash } from 'lucide-react';

// Handles both creating a new group channel and editing an existing one — pass
// `editingGroup` to switch into edit mode (pre-fills the form, submit calls
// updateGroup instead of createGroup).
export const GroupCreator = ({ isOpen, onClose, editingGroup }) => {
  const { users, currentUser } = useAuth();
  const { createGroup, updateGroup } = useChat();
  const isEditMode = !!editingGroup;

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    if (editingGroup) {
      setGroupName(editingGroup.name || '');
      setDescription(editingGroup.description || '');
      setSelectedMembers((editingGroup.members || []).filter(id => id !== currentUser?.id));
    } else {
      setGroupName('');
      setDescription('');
      setSelectedMembers([]);
    }
  }, [editingGroup, isOpen]);

  if (!isOpen) return null;

  const toggleMember = (userId) => {
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    if (isEditMode) {
      updateGroup(editingGroup.id, {
        name: groupName.trim(),
        description: description.trim(),
        members: [currentUser.id, ...selectedMembers]
      });
    } else {
      createGroup({
        name: groupName.trim(),
        description: description.trim(),
        members: selectedMembers
      });
    }

    onClose();
  };

  // Deleted accounts are hidden from the chat directory/sidebar everywhere else in the
  // app, so they shouldn't be offered as enrollable members here either. If a deleted
  // user was already a member of a group being edited, submitting the form still drops
  // them from `members` since they're no longer in this list to stay checked.
  const eligibleUsers = users.filter(u => u.id !== currentUser?.id && u.status !== 'Deleted');

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content amber-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} color="var(--amber-primary)" />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
              {isEditMode ? 'Edit Group Channel' : 'Create New Operational Group Channel'}
            </h3>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Group Channel Name
            </label>
            <div style={{ position: 'relative' }}>
              <Hash size={16} color="var(--amber-primary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="input-field" 
                style={{ paddingLeft: '36px' }}
                placeholder="e.g. Buchanan Highway Customs Clearance" 
                required
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Channel Description / Dispatch Purpose
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Real-time updates for container haulage to Buchanan..." 
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Member Checkbox Picker */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--amber-primary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              Enroll Workforce Members ({selectedMembers.length} selected)
            </label>

            <div style={{
              maxHeight: '180px',
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '8px',
              background: 'rgba(15, 23, 42, 0.5)'
            }}>
              {eligibleUsers.map(u => {
                const isChecked = selectedMembers.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleMember(u.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isChecked ? 'var(--amber-light)' : 'transparent',
                      marginBottom: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--amber-primary)',
                        fontWeight: 700,
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {u.avatar
                          ? <img src={u.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : u.initials
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>{u.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{u.role} • {u.department}</div>
                      </div>
                    </div>

                    {isChecked ? (
                      <CheckSquare size={18} color="var(--amber-primary)" />
                    ) : (
                      <Square size={18} color="var(--text-dim)" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!groupName.trim()}>
              {isEditMode ? 'Save Changes' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
