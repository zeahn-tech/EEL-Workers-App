import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resizeImageFile } from '../../services/imageUtils';
import { X, User, Mail, Lock, Camera, Check, AlertCircle, Loader2, AlertTriangle, Trash2, Building2, Phone } from 'lucide-react';

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
      {label}
    </label>
    {children}
  </div>
);

const Alert = ({ type, children }) => {
  const isError = type === 'error';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      background: isError ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
      border: `1px solid ${isError ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
      borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: 14,
      fontSize: 12, color: isError ? '#FCA5A5' : '#6EE7B7'
    }}>
      {isError ? <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <Check size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
      <span>{children}</span>
    </div>
  );
};

export const ProfileSettings = ({ onClose }) => {
  const { currentUser, updateOwnProfile, uploadAvatar, changeOwnPassword, deleteOwnAccount, supabaseMode } = useAuth();
  const fileInputRef = useRef(null);

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatar || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null); // { type, text }

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState(null);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileMsg(null);
    setUploadingPhoto(true);
    try {
      const { dataUrl, blob, contentType } = await resizeImageFile(file);
      setAvatarPreview(dataUrl); // instant local preview
      const result = await uploadAvatar({ dataUrl, blob, contentType });
      if (!result.success) {
        setProfileMsg({ type: 'error', text: result.error || 'Could not upload photo.' });
        setAvatarPreview(currentUser?.avatar || '');
      } else {
        setProfileMsg({ type: 'success', text: 'Profile photo updated.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Could not process that image.' });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    const result = await updateOwnProfile({ name, email, avatar: avatarPreview, department, phone });
    setSavingProfile(false);
    if (!result.success) {
      setProfileMsg({ type: 'error', text: result.error || 'Could not save changes.' });
    } else if (result.emailConfirmationSent) {
      setProfileMsg({ type: 'success', text: 'Saved. Check your new email inbox to confirm the address change.' });
    } else {
      setProfileMsg({ type: 'success', text: 'Profile updated.' });
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setSavingPassword(true);
    const result = await changeOwnPassword(currentPassword, newPassword);
    setSavingPassword(false);
    if (!result.success) {
      setPasswordMsg({ type: 'error', text: result.error || 'Could not change password.' });
    } else {
      setPasswordMsg({ type: 'success', text: 'Password changed.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteMsg(null);
    if (deleteConfirmText !== 'DELETE') {
      setDeleteMsg({ type: 'error', text: 'Type DELETE (all caps) to confirm.' });
      return;
    }
    setDeleting(true);
    const result = await deleteOwnAccount(deletePassword);
    setDeleting(false);
    if (!result.success) {
      setDeleteMsg({ type: 'error', text: result.error || 'Could not delete account.' });
      return;
    }
    // AuthContext already cleared the session — closing this modal just tidies up the
    // now-unmounting app shell behind it.
    onClose();
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content amber-border" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>Account Settings</h3>
          <button className="btn btn-secondary btn-icon" onClick={onClose} style={{ width: 32, height: 32, minHeight: 32 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          {/* Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 84, height: 84, borderRadius: '50%', overflow: 'hidden',
                background: 'var(--bg-tertiary)', border: '2px solid var(--amber-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Your avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--amber-primary)' }}>
                    {currentUser?.initials || '?'}
                  </span>
                )}
                {uploadingPhoto && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%'
                  }}>
                    <Loader2 size={22} className="spin" color="var(--amber-primary)" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Change photo"
                style={{
                  position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--amber-primary)', border: '2px solid var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}>
                <Camera size={13} color="#0F172A" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
            </div>
          </div>

          {profileMsg && <Alert type={profileMsg.type}>{profileMsg.text}</Alert>}

          <form onSubmit={handleProfileSubmit}>
            <Field label="Full Name">
              <div style={{ position: 'relative' }}>
                <User size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" className="input-field" style={{ paddingLeft: 36 }}
                  value={name} onChange={e => setName(e.target.value)} required />
              </div>
            </Field>
            <Field label="Email">
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="email" className="input-field" style={{ paddingLeft: 36 }}
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              {supabaseMode && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  Changing your email may require confirming it via a link sent to the new address.
                </div>
              )}
            </Field>
            <Field label="Department">
              <div style={{ position: 'relative' }}>
                <Building2 size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" className="input-field" style={{ paddingLeft: 36 }}
                  placeholder="e.g. Freeport Haulage"
                  value={department} onChange={e => setDepartment(e.target.value)} />
              </div>
            </Field>
            <Field label="Phone Number">
              <div style={{ position: 'relative' }}>
                <Phone size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" className="input-field" style={{ paddingLeft: 36 }}
                  placeholder="+231 88 123 4567"
                  value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </Field>
            <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ width: '100%', minHeight: 38 }}>
              {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '22px 0 18px' }} />

          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>Change Password</h4>
          {passwordMsg && <Alert type={passwordMsg.type}>{passwordMsg.text}</Alert>}
          <form onSubmit={handlePasswordSubmit}>
            <Field label="Current Password">
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" className="input-field" style={{ paddingLeft: 36 }}
                  autoComplete="current-password"
                  value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
              </div>
            </Field>
            <Field label="New Password">
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" className="input-field" style={{ paddingLeft: 36 }}
                  autoComplete="new-password" minLength={8}
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
              </div>
            </Field>
            <Field label="Confirm New Password">
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" className="input-field" style={{ paddingLeft: 36 }}
                  autoComplete="new-password" minLength={8}
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              </div>
            </Field>
            <button type="submit" className="btn btn-secondary amber-border" disabled={savingPassword}
              style={{ width: '100%', minHeight: 38, color: 'var(--amber-primary)' }}>
              {savingPassword ? 'Updating…' : 'Update Password'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '22px 0 18px' }} />

          {/* Danger Zone */}
          <div style={{
            border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-md)', padding: 14
          }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} /> Danger Zone
            </h4>

            {!showDeleteConfirm ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Permanently delete your account. You'll be signed out immediately and won't be able to log back in.
                  Message history you've already sent stays visible to others.
                </p>
                <button type="button" className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}
                  style={{ width: '100%', minHeight: 36, fontSize: 13 }}>
                  <Trash2 size={14} /> Delete My Account
                </button>
              </>
            ) : (
              <form onSubmit={handleDeleteAccount}>
                {deleteMsg && <Alert type={deleteMsg.type}>{deleteMsg.text}</Alert>}
                <Field label={`Type DELETE to confirm`}>
                  <input type="text" className="input-field"
                    value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE" autoComplete="off" />
                </Field>
                <Field label="Current Password">
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="password" className="input-field" style={{ paddingLeft: 36 }}
                      autoComplete="current-password"
                      value={deletePassword} onChange={e => setDeletePassword(e.target.value)} required />
                  </div>
                </Field>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1, minHeight: 36 }}
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeletePassword(''); setDeleteMsg(null); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger" disabled={deleting} style={{ flex: 1, minHeight: 36 }}>
                    {deleting ? 'Deleting…' : 'Permanently Delete'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
