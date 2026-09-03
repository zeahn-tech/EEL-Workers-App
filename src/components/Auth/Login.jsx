import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { Lock, Mail, User, Eye, EyeOff, LogIn, UserPlus, AlertCircle, CheckCircle2, Download, Share } from 'lucide-react';

export const Login = () => {
  const { login, signUp, settings } = useAuth();
  const { installPrompt, showIosInstallHint, promptInstall } = useInstallPrompt();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showIosPanel, setShowIosPanel] = useState(false);
  const [signupSuccessMessage, setSignupSuccessMessage] = useState('');

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setSignupSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (mode === 'signin') {
      const result = await login(email, password);
      setSubmitting(false);
      if (!result.success) setError(result.error || 'Sign in failed.');
      return;
    }

    // Sign up
    const result = await signUp(name, email, password);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Could not create account.');
      return;
    }
    if (result.needsEmailConfirmation) {
      setSignupSuccessMessage(`Account created! Check ${email} for a confirmation link before signing in.`);
      setMode('signin');
      setPassword('');
    }
    // If no confirmation needed, signUp() already logged the person in — AuthGate
    // will swap straight to the app, nothing else to do here.
  };

  return (
    <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Install banner — visible immediately on landing, before any login */}
      {(installPrompt || showIosInstallHint) && (
        <div className="glass-panel amber-border animate-fade-in" style={{
          width: '100%', maxWidth: 380, borderRadius: 'var(--radius-md)',
          padding: '10px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-main)', minWidth: 0 }}>
            <Download size={16} color="var(--amber-primary)" style={{ flexShrink: 0 }} />
            <span>Install this app on your device for the best experience</span>
          </div>
          {installPrompt ? (
            <button className="btn btn-primary" onClick={promptInstall}
              style={{ fontSize: 12, padding: '6px 12px', minHeight: 30, flexShrink: 0 }}>
              Install
            </button>
          ) : (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button className="btn btn-primary" onClick={() => setShowIosPanel(v => !v)}
                style={{ fontSize: 12, padding: '6px 12px', minHeight: 30 }}>
                Install
              </button>
              {showIosPanel && (
                <div className="dropdown-panel amber-border animate-fade-in" style={{
                  position: 'absolute', top: 38, right: 0, width: 240,
                  borderRadius: 'var(--radius-md)', padding: 14,
                  boxShadow: 'var(--shadow-lg)', zIndex: 200, fontSize: 12, color: 'var(--text-main)'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--amber-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Share size={13} /> Install on iPhone / iPad
                  </div>
                  <ol style={{ paddingLeft: 18, lineHeight: 1.6, color: 'var(--text-muted)' }}>
                    <li>Tap the <strong style={{ color: 'var(--text-main)' }}>Share</strong> icon in Safari's toolbar</li>
                    <li>Tap <strong style={{ color: 'var(--text-main)' }}>Add to Home Screen</strong></li>
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
        </div>
      )}

      <div className="glass-panel amber-border animate-fade-in" style={{
        width: '100%', maxWidth: 380, borderRadius: 'var(--radius-lg)',
        padding: '32px 28px', boxShadow: 'var(--shadow-lg)'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 14,
            background: 'var(--navy-dark)', border: '2px solid var(--amber-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', marginBottom: 14, boxShadow: 'var(--shadow-glow)'
          }}>
            {settings.appLogo
              ? <img src={settings.appLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ fontFamily: 'Outfit', fontWeight: 900, color: 'var(--amber-primary)', fontSize: 22 }}>EEL</span>
            }
          </div>
          <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 18, color: 'var(--text-main)', textAlign: 'center' }}>
            {settings.companyName || 'Elite Express Logistics Liberia'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, textAlign: 'center' }}>
            {mode === 'signin' ? 'Sign in to your dispatch account' : 'Create your dispatch account'}
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', background: 'rgba(15,23,42,0.6)', borderRadius: 'var(--radius-md)',
          padding: 3, marginBottom: 20, border: '1px solid var(--border-subtle)'
        }}>
          <button type="button" onClick={() => switchMode('signin')}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, transition: 'all 0.15s ease',
              background: mode === 'signin' ? 'var(--amber-primary)' : 'transparent',
              color: mode === 'signin' ? '#0F172A' : 'var(--text-muted)'
            }}>
            Sign In
          </button>
          <button type="button" onClick={() => switchMode('signup')}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, transition: 'all 0.15s ease',
              background: mode === 'signup' ? 'var(--amber-primary)' : 'transparent',
              color: mode === 'signup' ? '#0F172A' : 'var(--text-muted)'
            }}>
            Create Account
          </button>
        </div>

        {signupSuccessMessage && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
            borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: 14,
            fontSize: 12, color: '#6EE7B7'
          }}>
            <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{signupSuccessMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: 36 }}
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                className="input-field"
                style={{ paddingLeft: 36 }}
                placeholder="you@company.com"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                style={{ paddingLeft: 36, paddingRight: 38 }}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                  display: 'flex', color: 'var(--text-dim)'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: 14,
              fontSize: 12, color: '#FCA5A5'
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={submitting}
            style={{ width: '100%', minHeight: 42, fontSize: 14 }}>
            {mode === 'signin' ? <LogIn size={16} /> : <UserPlus size={16} />}
            {submitting
              ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
              : (mode === 'signin' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
          {mode === 'signin' ? (
            <>Don't have an account?{' '}
              <button type="button" onClick={() => switchMode('signup')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber-primary)', fontWeight: 600, fontSize: 12 }}>
                Create one
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button type="button" onClick={() => switchMode('signin')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber-primary)', fontWeight: 600, fontSize: 12 }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
