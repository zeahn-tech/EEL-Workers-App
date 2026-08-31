import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  UserPlus, 
  Search, 
  Trash2, 
  Ban, 
  UserCheck, 
  ShieldAlert, 
  X, 
  Building2, 
  Phone, 
  Mail, 
  User as UserIcon,
  KeyRound,
  Copy,
  Check
} from 'lucide-react';

export const StaffManager = () => {
  const { users, addWorker, updateWorkerStatus, deleteWorker, resetWorkerPassword, supabaseMode } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [issuedCreds, setIssuedCreds] = useState(null); // { name, email, tempPassword } or { name, email, emailSent }
  const [copied, setCopied] = useState(false);

  // Form State for Adding Worker
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Worker',
    department: 'Freight Operations',
    phone: '+231 88 ',
    password: ''
  });

  const filtered = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setSubmitting(true);
    setFormError('');
    const result = await addWorker(formData);
    setSubmitting(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setFormData({ name: '', email: '', role: 'Worker', department: 'Freight Operations', phone: '+231 88 ', password: '' });
    setShowAddModal(false);
    setIssuedCreds({ name: result.worker.name, email: result.worker.email, tempPassword: result.tempPassword });
  };

  const handleResetPassword = async (u) => {
    if (!window.confirm(`Reset the password for ${u.name}?${supabaseMode ? ' A reset link will be emailed to them.' : ' Their current password will stop working immediately.'}`)) return;
    const result = await resetWorkerPassword(u);
    if (supabaseMode) {
      if (result.error) { alert(`Could not send reset email: ${result.error}`); return; }
      setIssuedCreds({ name: u.name, email: u.email, emailSent: true });
    } else {
      setIssuedCreds({ name: u.name, email: u.email, tempPassword: result.tempPassword });
    }
  };

  const handleUpdateStatus = async (userId, status) => {
    const result = await updateWorkerStatus(userId, status);
    if (result && result.error) alert(`Could not update status: ${result.error}`);
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Are you sure you want to delete worker ${u.name}?`)) return;
    const result = await deleteWorker(u.id);
    if (result && result.error) alert(`Could not delete worker: ${result.error}`);
  };

  const copyCreds = () => {
    if (!issuedCreds || !issuedCreds.tempPassword) return;
    const text = `Email: ${issuedCreds.email}\nTemporary password: ${issuedCreds.tempPassword}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header & Add Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
            EEL Workforce & Staff Management
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Admin portal to register new staff, manage roles, suspend or ban workforce accounts.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <UserPlus size={16} />
          <span>Add New Worker</span>
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '20px', position: 'relative', maxWidth: '380px' }}>
        <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input 
          type="text"
          className="input-field"
          style={{ paddingLeft: '36px' }}
          placeholder="Filter staff by name, email, department..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Staff Table / Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {filtered.map(u => (
          <div key={u.id} className="glass-panel" style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            border: u.status === 'Banned' ? '1px solid #EF4444' : u.status === 'Suspended' ? '1px solid #F59E0B' : u.status === 'Deleted' ? '1px solid var(--border-subtle)' : '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: u.status === 'Banned' ? '#EF4444' : u.status === 'Suspended' ? '#F59E0B' : u.status === 'Deleted' ? 'var(--text-dim)' : 'var(--amber-primary)',
                    color: u.status !== 'Active' ? 'white' : 'var(--navy-dark)',
                    fontWeight: 700,
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {u.initials}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {u.name} {u.role === 'Admin' && '👑'}
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--amber-primary)', fontWeight: 600 }}>
                      {u.role}
                    </span>
                  </div>
                </div>

                <span className={`badge badge-${u.status.toLowerCase()}`}>
                  {u.status}
                </span>
              </div>

              {/* Contact Details */}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={12} color="var(--amber-primary)" />
                  <span>{u.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={12} color="var(--amber-primary)" />
                  <span>{u.department}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={12} color="var(--amber-primary)" />
                  <span>{u.phone}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {u.role !== 'Admin' && (
              <div style={{ 
                paddingTop: '12px', 
                borderTop: '1px solid var(--border-subtle)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                gap: '8px' 
              }}>
                {u.status === 'Deleted' ? (
                  <>
                    {/* Self-deleted accounts: just Restore or purge permanently */}
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleUpdateStatus(u.id, 'Active')}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                      <UserCheck size={14} color="#10B981" />
                      <span>Restore Account</span>
                    </button>
                    <button 
                      className="btn btn-secondary btn-icon"
                      onClick={() => handleDelete(u)}
                      title="Delete Worker Permanently"
                      style={{ width: '28px', height: '28px', color: '#EF4444' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    {/* Suspend / Unsuspend */}
                    {u.status === 'Suspended' ? (
                      <button 
                        className="btn btn-secondary"
                        onClick={() => handleUpdateStatus(u.id, 'Active')}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        <UserCheck size={14} color="#10B981" />
                        <span>Unsuspend</span>
                      </button>
                    ) : (
                      <button 
                        className="btn btn-secondary"
                        onClick={() => handleUpdateStatus(u.id, 'Suspended')}
                        style={{ fontSize: '11px', padding: '4px 8px', color: '#F59E0B' }}
                      >
                        <ShieldAlert size={14} />
                        <span>Suspend</span>
                      </button>
                    )}

                    {/* Ban / Unban */}
                    {u.status === 'Banned' ? (
                      <button 
                        className="btn btn-secondary"
                        onClick={() => handleUpdateStatus(u.id, 'Active')}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        <UserCheck size={14} color="#10B981" />
                        <span>Unban</span>
                      </button>
                    ) : (
                      <button 
                        className="btn btn-danger"
                        onClick={() => handleUpdateStatus(u.id, 'Banned')}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        <Ban size={14} />
                        <span>Ban Worker</span>
                      </button>
                    )}

                    {/* Reset Password */}
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleResetPassword(u)}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      title="Issue a new temporary password"
                    >
                      <KeyRound size={14} color="var(--amber-primary)" />
                      <span className="mobile-hide">Reset Password</span>
                    </button>

                    {/* Delete Worker */}
                    <button 
                      className="btn btn-secondary btn-icon"
                      onClick={() => handleDelete(u)}
                      title="Delete Worker Permanently"
                      style={{ width: '28px', height: '28px', color: '#EF4444' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Worker Modal */}
      {showAddModal && (
        <div className="modal-overlay animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="modal-content amber-border" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus size={20} color="var(--amber-primary)" />
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Register New Workforce Member</h3>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddWorker} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Full Worker Name
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Melvin Barclay" 
                  required 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Company Email
                </label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="melvin.b@eel-logistics.com" 
                  required 
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Staff Role
                  </label>
                  <select 
                    className="input-field"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="Worker">Worker / Driver</option>
                    <option value="Dispatcher">Logistics Dispatcher</option>
                    <option value="Admin">Executive Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Department
                  </label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Freeport Haulage" 
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Phone Number
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="+231 88 123 4567" 
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Initial Password <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(optional — leave blank to auto-generate)</span>
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Leave blank to generate a secure temp password" 
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Registering…' : 'Register Worker'}
                </button>
              </div>

              {formError && (
                <div style={{
                  marginTop: '14px', fontSize: '12px', color: '#FCA5A5',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 'var(--radius-sm)', padding: '8px 10px'
                }}>
                  {formError}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Issued Credentials Modal — shown once after creating a worker or resetting a password */}
      {issuedCreds && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIssuedCreds(null)}>
          <div className="modal-content amber-border" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <KeyRound size={20} color="var(--amber-primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                  {issuedCreds.emailSent ? 'Reset Email Sent' : 'Login Credentials Issued'}
                </h3>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIssuedCreds(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              {issuedCreds.emailSent ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  A password-reset link was emailed to <strong style={{ color: 'var(--text-main)' }}>{issuedCreds.email}</strong>.
                  {' '}They'll need to open it to set a new password.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Share this password with <strong style={{ color: 'var(--text-main)' }}>{issuedCreds.name}</strong> through
                    a secure channel. It will not be shown again{supabaseMode ? '' : ' — this app has no email delivery, so this is the only copy'}.
                  </p>
                  <div style={{
                    background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-amber)',
                    borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '14px'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>Email</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '10px', fontFamily: 'monospace' }}>{issuedCreds.email}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>Temporary Password</div>
                    <div style={{ fontSize: '15px', color: 'var(--amber-primary)', fontWeight: 700, fontFamily: 'monospace' }}>{issuedCreds.tempPassword}</div>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                {!issuedCreds.emailSent && (
                  <button className="btn btn-secondary" onClick={copyCreds} style={{ flex: 1 }}>
                    {copied ? <Check size={15} color="#10B981" /> : <Copy size={15} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
                <button className="btn btn-primary" onClick={() => setIssuedCreds(null)} style={{ flex: 1 }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
