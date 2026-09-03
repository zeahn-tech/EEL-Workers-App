import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { ChatSidebar } from './components/Chat/ChatSidebar';
import { ChatArea } from './components/Chat/ChatArea';
import { MessageToast } from './components/Chat/MessageToast';
import { StaffManager } from './components/Admin/StaffManager';
import { SystemSettings } from './components/Admin/SystemSettings';
import { GroupManager } from './components/Admin/GroupManager';
import { GroupCreator } from './components/Admin/GroupCreator';
import { Login } from './components/Auth/Login';
import { ProfileSettings } from './components/Auth/ProfileSettings';
import { useAuth } from './context/AuthContext';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import {
  Download,
  Settings,
  ChevronDown,
  X,
  Users,
  Hash,
  Settings as SettingsIcon,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  UserCog,
  ShieldCheck,
  Cloud,
  HardDrive
} from 'lucide-react';

// --- TOP HEADER ---
const AppHeader = ({ onToggleSidebar, sidebarOpen, onOpenProfile, installPrompt, onInstallApp, showIosInstallHint }) => {
  const { currentUser, logout, settings, isSuspended, isBanned } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showIosPanel, setShowIosPanel] = useState(false);

  return (
    <header className="app-header">
      {/* LEFT: Sidebar Toggle + Logo + Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {/* Sidebar Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className="btn btn-secondary btn-icon"
          title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          style={{ flexShrink: 0 }}
        >
          {sidebarOpen ? <PanelLeftClose size={18} color="var(--amber-primary)" /> : <PanelLeftOpen size={18} color="var(--amber-primary)" />}
        </button>

        {/* Logo Box */}
        <div style={{
          width: 38, height: 38,
          borderRadius: 10,
          background: 'var(--navy-dark)',
          border: '2px solid var(--amber-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
          boxShadow: 'var(--shadow-glow)'
        }}>
          {settings.appLogo
            ? <img src={settings.appLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <span style={{ fontFamily: 'Outfit', fontWeight: 900, color: 'var(--amber-primary)', fontSize: 15 }}>EEL</span>
          }
        </div>

        {/* Brand Text */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'Outfit', fontWeight: 700, fontSize: 15,
            color: 'var(--text-main)', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240
          }}>
            {settings.companyName || 'Elite Express Logistics Liberia'}
          </div>
          <div className="mobile-hide" style={{
            fontSize: 10, color: 'var(--amber-primary)', fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240
          }}>
            {settings.tagline || 'Real-Time Enterprise Messenger'}
          </div>
        </div>
      </div>

      {/* RIGHT: Install + Admin + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {installPrompt && (
          <button className="btn btn-primary" onClick={onInstallApp}
            style={{ fontSize: 12, padding: '6px 12px', minHeight: 34 }}>
            <Download size={14} />
            <span className="mobile-hide">Install App</span>
          </button>
        )}

        {showIosInstallHint && (
          <div style={{ position: 'relative' }}>
            <button className="btn btn-primary" onClick={() => setShowIosPanel(v => !v)}
              style={{ fontSize: 12, padding: '6px 12px', minHeight: 34 }}>
              <Download size={14} />
              <span className="mobile-hide">Install App</span>
            </button>
            {showIosPanel && (
              <div className="dropdown-panel amber-border animate-fade-in" style={{
                position: 'absolute', top: 44, right: 0, width: 250,
                borderRadius: 'var(--radius-md)', padding: 14,
                boxShadow: 'var(--shadow-lg)', zIndex: 200, fontSize: 12, color: 'var(--text-main)'
              }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--amber-primary)' }}>
                  Install on iPhone / iPad
                </div>
                <ol style={{ paddingLeft: 18, lineHeight: 1.6, color: 'var(--text-muted)' }}>
                  <li>Tap the <strong style={{ color: 'var(--text-main)' }}>Share</strong> icon in Safari's toolbar</li>
                  <li>Scroll down and tap <strong style={{ color: 'var(--text-main)' }}>Add to Home Screen</strong></li>
                  <li>Tap <strong style={{ color: 'var(--text-main)' }}>Add</strong> to confirm</li>
                </ol>
                <button className="btn btn-secondary" onClick={() => setShowIosPanel(false)}
                  style={{ width: '100%', marginTop: 10, fontSize: 12, minHeight: 30 }}>
                  Got it
                </button>
              </div>
            )}
          </div>
        )}

        {/* User Avatar Switcher */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(30,41,59,0.9)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '3px 8px 3px 4px',
              cursor: 'pointer', color: 'var(--text-main)'
            }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', overflow: 'hidden',
              background: isBanned ? '#EF4444' : isSuspended ? '#F59E0B' : 'var(--amber-primary)',
              color: '#0F172A', fontWeight: 700, fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              {currentUser?.avatar
                ? <img src={currentUser.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (currentUser?.initials || '?')
              }
            </div>
            <span className="mobile-hide" style={{ fontSize: 12, fontWeight: 600, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name}
            </span>
            <ChevronDown size={12} color="var(--text-muted)" />
          </button>

          {showDropdown && (
            <div className="dropdown-panel animate-fade-in" style={{
              position: 'absolute', top: 44, right: 0, width: 240,
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-amber)',
              padding: 6, boxShadow: 'var(--shadow-lg)', zIndex: 200
            }}>
              <div style={{ padding: '10px 8px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {currentUser?.name} {currentUser?.role === 'Admin' && '👑'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {currentUser?.email}
                </div>
                <div style={{ fontSize: 10, color: 'var(--amber-primary)', fontWeight: 600, marginTop: 4 }}>
                  {currentUser?.role} • {currentUser?.department}
                </div>
              </div>
              <button onClick={() => { setShowDropdown(false); onOpenProfile(); }}
                style={{
                  width: '100%', padding: '8px 8px', borderRadius: 'var(--radius-sm)',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'transparent', color: 'var(--text-main)', fontSize: 13, fontWeight: 600
                }}>
                <UserCog size={15} />
                Account Settings
              </button>
              <button onClick={logout}
                style={{
                  width: '100%', padding: '8px 8px', borderRadius: 'var(--radius-sm)',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'transparent', color: '#FCA5A5', fontSize: 13, fontWeight: 600
                }}>
                <LogOut size={15} />
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// --- ADMIN MODAL ---
const AdminModal = ({ onClose }) => {
  const { isAdmin, users, supabaseMode } = useAuth();
  const { groups } = useChat();
  const [adminTab, setAdminTab] = useState('staff');

  // Defense in depth: even if something ever renders this modal without going through
  // the gated header button, a non-admin account still can't see admin content here.
  useEffect(() => {
    if (!isAdmin) onClose();
  }, [isAdmin]);

  if (!isAdmin) return null;

  // "Total Staff" and "Suspended / Banned" reflect the visible, active roster — matching
  // Staff Manager, where Deleted accounts are tucked into their own collapsed section
  // rather than mixed into the main list. Counting them here too would make these numbers
  // inconsistent with what's actually shown, undermining the whole point of hiding them.
  const nonDeletedUsers = users.filter(u => u.status !== 'Deleted');
  const activeCount = nonDeletedUsers.filter(u => u.status === 'Active').length;
  const flaggedCount = nonDeletedUsers.filter(u => u.status === 'Suspended' || u.status === 'Banned').length;
  const deletedCount = users.length - nonDeletedUsers.length;
  const adminCount = users.filter(u => u.role === 'Admin').length;

  const navItems = [
    { key: 'staff', label: 'Staff', icon: Users },
    { key: 'groups', label: 'Groups', icon: Hash },
    { key: 'settings', label: 'Settings & Logo', icon: SettingsIcon }
  ];

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content amber-border admin-modal-content" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 960 }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', background: 'var(--navy-dark)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={18} color="var(--amber-primary)" />
            <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: 15, color: 'var(--amber-primary)' }}>
              Admin Dashboard
            </span>
            <span title={supabaseMode ? 'Connected to Supabase' : 'Local / offline mode'} style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700,
              padding: '3px 8px', borderRadius: 'var(--radius-full)',
              background: supabaseMode ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
              color: supabaseMode ? '#6EE7B7' : 'var(--text-muted)'
            }}>
              {supabaseMode ? <Cloud size={11} /> : <HardDrive size={11} />}
              {supabaseMode ? 'Supabase' : 'Local'}
            </span>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}
            style={{ width: 32, height: 32, minHeight: 32 }}>
            <X size={16} />
          </button>
        </div>

        {/* Stats overview */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 18px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div className="admin-stat-card">
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>{nonDeletedUsers.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Staff</div>
          </div>
          <div className="admin-stat-card">
            <div style={{ fontSize: 20, fontWeight: 800, color: '#6EE7B7' }}>{activeCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Active</div>
          </div>
          <div className="admin-stat-card">
            <div style={{ fontSize: 20, fontWeight: 800, color: flaggedCount ? '#FCA5A5' : 'var(--text-main)' }}>{flaggedCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Suspended / Banned</div>
          </div>
          <div className="admin-stat-card">
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber-primary)' }}>{adminCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Admins</div>
          </div>
          <div className="admin-stat-card">
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>{groups.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Group Channels</div>
          </div>
          {deletedCount > 0 && (
            <div className="admin-stat-card">
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-dim)' }}>{deletedCount}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Deleted</div>
            </div>
          )}
        </div>

        {/* Nav + Content */}
        <div className="admin-dashboard">
          <div className="admin-nav">
            {navItems.map(({ key, label, icon: Icon }) => (
              <button key={key} className={`admin-nav-item ${adminTab === key ? 'active' : ''}`}
                onClick={() => setAdminTab(key)}>
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          <div className="admin-content">
            {adminTab === 'staff' && <StaffManager />}
            {adminTab === 'groups' && <GroupManager />}
            {adminTab === 'settings' && <SystemSettings />}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP LAYOUT ---
const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const { installPrompt, showIosInstallHint, promptInstall } = useInstallPrompt();

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-show sidebar on desktop resize
      if (!mobile) setMobileSidebarOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setMobileSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileSidebarOpen(v => !v);
    } else {
      setSidebarOpen(v => !v);
    }
  };

  const openAdmin = () => { setShowAdmin(true); setMobileSidebarOpen(false); };
  const openProfile = () => { setShowProfile(true); setMobileSidebarOpen(false); };

  return (
    <div className="app-container">
      {/* ===== FIXED TOP HEADER ===== */}
      <AppHeader
        onToggleSidebar={toggleSidebar}
        sidebarOpen={isMobile ? mobileSidebarOpen : sidebarOpen}
        onOpenProfile={openProfile}
        installPrompt={installPrompt}
        onInstallApp={promptInstall}
        showIosInstallHint={showIosInstallHint}
      />

      {/* ===== MAIN BODY ===== */}
      <div className="main-body">
        {/* DESKTOP SIDEBAR (collapsible) */}
        {!isMobile && (
          <div className={`sidebar-panel ${sidebarOpen ? '' : 'collapsed-desktop'}`}>
            <ChatSidebar
              onOpenGroupCreator={() => setShowGroupCreator(true)}
              onOpenAdmin={openAdmin}
              onOpenProfile={openProfile}
            />
          </div>
        )}

        {/* MOBILE SIDEBAR DRAWER + BACKDROP */}
        {isMobile && (
          <>
            {/* Dark backdrop behind drawer */}
            {mobileSidebarOpen && (
              <div className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
            )}
            {/* Sliding Drawer (modal-style flyout on mobile) */}
            <div className={`sidebar-panel sidebar-mobile-drawer ${mobileSidebarOpen ? 'open' : ''}`}
              style={{ background: 'var(--bg-secondary)' }}>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="btn btn-secondary btn-icon"
                title="Close menu"
                style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, width: 32, height: 32, minHeight: 32 }}
              >
                <X size={16} />
              </button>
              <ChatSidebar
                onOpenGroupCreator={() => { setShowGroupCreator(true); setMobileSidebarOpen(false); }}
                onSelectChat={() => setMobileSidebarOpen(false)}
                onOpenAdmin={openAdmin}
                onOpenProfile={openProfile}
              />
            </div>
          </>
        )}

        {/* CHAT AREA — always fills remaining space */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <ChatArea />
        </div>
      </div>

      {/* MODALS */}
      {showAdmin && <AdminModal onClose={() => setShowAdmin(false)} />}
      {showProfile && <ProfileSettings onClose={() => setShowProfile(false)} />}
      <GroupCreator isOpen={showGroupCreator} onClose={() => setShowGroupCreator(false)} />
      <MessageToast />
    </div>
  );
};

// --- AUTH GATE ---
// Renders the login screen until there's a real, verified session. Nothing about the
// app shell — including the Admin Dashboard button and any chat data — is reachable
// before that.
const AuthGate = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  return <AppLayout />;
};

// Root export
export function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <AuthGate />
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
