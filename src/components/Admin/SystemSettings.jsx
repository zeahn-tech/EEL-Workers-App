import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { 
  Settings, 
  Upload, 
  Image as ImageIcon, 
  Database, 
  ShieldCheck, 
  Save, 
  Check, 
  RotateCcw, 
  Building2,
  Key,
  Globe
} from 'lucide-react';

export const SystemSettings = () => {
  const { settings, updateSettings } = useAuth();

  const [companyName, setCompanyName] = useState(settings.companyName || 'Elite Express Logistics Liberia (EEL)');
  const [tagline, setTagline] = useState(settings.tagline || 'Premier Freight, Customs & Supply Chain Dispatch');
  const [appLogo, setAppLogo] = useState(settings.appLogo || '');
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings.supabaseAnonKey || '');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const logoInputRef = useRef(null);

  // Handle Logo Upload File Selection (Converts image file to Base64 DataURL dynamically)
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, SVG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAppLogo(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e) => {
    e.preventDefault();

    updateSettings({
      companyName,
      tagline,
      appLogo,
      supabaseUrl,
      supabaseAnonKey
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetLogo = () => {
    setAppLogo('');
  };

  const connectedToSupabase = isSupabaseConfigured();

  return (
    <div style={{ padding: '24px', maxWidth: '780px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={22} color="var(--amber-primary)" />
          <span>EEL System & Branding Settings</span>
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Configure enterprise branding, dynamic company logo upload, and live Supabase cloud database credentials.
        </p>
      </div>

      <form onSubmit={handleSave}>
        {/* DYNAMIC COMPANY LOGO UPLOAD CARD */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '20px', border: '1px solid var(--border-amber)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--amber-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ImageIcon size={18} />
            <span>Company Logo Upload (Dynamic Branding)</span>
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Logo Preview Box */}
            <div style={{
              width: '90px',
              height: '90px',
              borderRadius: '14px',
              background: 'var(--navy-dark)',
              border: '2px dashed var(--border-amber)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              {appLogo ? (
                <img src={appLogo} alt="Uploaded App Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--amber-primary)', fontWeight: 800, fontSize: '20px' }}>
                  EEL
                </div>
              )}
            </div>

            {/* Upload Action Buttons */}
            <div>
              <input 
                type="file" 
                ref={logoInputRef} 
                accept="image/*" 
                onChange={handleLogoChange} 
                style={{ display: 'none' }} 
              />

              <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload size={16} />
                  <span>Upload New Logo</span>
                </button>

                {appLogo && (
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={handleResetLogo}
                  >
                    <RotateCcw size={14} />
                    <span>Reset Logo</span>
                  </button>
                )}
              </div>

              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Upload PNG, JPG, or SVG company emblem. Logo updates dynamically on headers, sign-in screens, and PWA icons.
              </p>
            </div>
          </div>
        </div>

        {/* COMPANY NAME & TAGLINE */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--amber-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} />
            <span>Company General Profile</span>
          </h3>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Official Company Name
            </label>
            <input 
              type="text"
              className="input-field"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              App Tagline / Subtitle
            </label>
            <input 
              type="text"
              className="input-field"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
            />
          </div>
        </div>

        {/* SUPABASE CLOUD BACKEND CONFIGURATION */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--amber-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} />
              <span>Supabase Cloud Integration</span>
            </h3>

            <span className={`badge ${connectedToSupabase ? 'badge-active' : 'badge-suspended'}`}>
              {connectedToSupabase ? 'Connected to Supabase' : 'Offline / Local PWA Mode'}
            </span>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '14px' }}>
            Login, the staff directory, and password resets run through Supabase once this is
            configured. Chat messages stay stored on this device either way. After saving,
            <strong style={{ color: 'var(--text-muted)' }}> reload the app</strong> for the change to take effect.
          </p>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Supabase Project URL
            </label>
            <div style={{ position: 'relative' }}>
              <Globe size={16} color="var(--amber-primary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text"
                className="input-field"
                style={{ paddingLeft: '36px' }}
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={e => setSupabaseUrl(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Supabase Anon Public API Key
            </label>
            <div style={{ position: 'relative' }}>
              <Key size={16} color="var(--amber-primary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="password"
                className="input-field"
                style={{ paddingLeft: '36px' }}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseAnonKey}
                onChange={e => setSupabaseAnonKey(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {savedSuccess && (
            <div style={{ color: '#10B981', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={18} />
              <span>System Settings & Dynamic Logo Updated Successfully!</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginLeft: 'auto', padding: '10px 24px' }}>
            <Save size={18} />
            <span>Save System Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
