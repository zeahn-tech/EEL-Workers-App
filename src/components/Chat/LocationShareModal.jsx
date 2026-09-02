import React, { useState, useEffect } from 'react';
import { X, MapPin, Navigation, Compass, AlertCircle, RefreshCw, ShieldAlert } from 'lucide-react';

// Maps a browser GeolocationPositionError code to a specific, honest explanation. There is
// deliberately no fallback coordinate anywhere in this file — if the browser can't produce
// a real GPS fix, the person sees exactly why and can retry, but nothing gets sent. Silently
// substituting a placeholder location (this component used to default to a fixed Monrovia
// Freeport coordinate) would mean a dispatcher could believe a worker is somewhere they
// aren't, which is worse than sharing nothing at all.
const describeGeoError = (err) => {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission was denied. Enable location access for this site in your browser or device settings, then try again.';
    case err.POSITION_UNAVAILABLE:
      return "Your device couldn't determine its location right now. Make sure GPS / location services are turned on, then try again.";
    case err.TIMEOUT:
      return 'Getting a GPS fix took too long. Try again — a clear view of the sky or a stronger signal usually helps.';
    default:
      return 'Could not get your location. Please try again.';
  }
};

export const LocationShareModal = ({ isOpen, onClose, onSendLocation }) => {
  const [coords, setCoords] = useState(null);
  const [address, setAddress] = useState('');
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && !coords) {
      fetchCurrentLocation();
    }
    // Reset everything when the modal closes, so reopening it always requests a fresh,
    // current fix rather than silently reusing a potentially stale/old one from earlier.
    if (!isOpen) {
      setCoords(null);
      setAddress('');
      setErrorMsg('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchCurrentLocation = () => {
    setLoadingLoc(true);
    setErrorMsg('');
    setCoords(null);

    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by this browser, so a real location cannot be shared here.');
      setLoadingLoc(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy || 0);

        setCoords({ latitude: lat, longitude: lng, accuracy });

        // Reverse geocoding is purely cosmetic (a human-readable label) — if it fails or is
        // slow, the real coordinates above are already set and shareable regardless.
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(res => res.json())
          .then(data => {
            setAddress(data?.display_name || `GPS Pinpoint (${lat.toFixed(5)}°, ${lng.toFixed(5)}°)`);
          })
          .catch(() => {
            setAddress(`GPS Pinpoint (${lat.toFixed(5)}°, ${lng.toFixed(5)}°)`);
          })
          .finally(() => setLoadingLoc(false));
      },
      (err) => {
        console.warn('Geolocation error:', err.code, err.message);
        setErrorMsg(describeGeoError(err));
        setLoadingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSubmit = () => {
    // No coords means no real fix was ever obtained — there is nothing to fall back to,
    // by design, so this is the only way to guarantee every shared location is genuine.
    if (!coords) return;

    onSendLocation({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy || 0,
      address: address.trim() || `GPS Coordinates (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content amber-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MapPin size={20} color="var(--amber-primary)" />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Share Live Dispatch Location</h3>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Location Content */}
        <div style={{ padding: '20px' }}>
          {loadingLoc && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <RefreshCw size={36} color="var(--amber-primary)" className="glow-amber" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>Acquiring your real GPS coordinates…</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Communicating with device location sensors</p>
            </div>
          )}

          {!loadingLoc && !coords && (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <ShieldAlert size={36} color="#F59E0B" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                No location acquired
              </p>
              {errorMsg && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 16, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
                  {errorMsg}
                </p>
              )}
              <button className="btn btn-primary" onClick={fetchCurrentLocation}>
                <RefreshCw size={14} />
                Try Again
              </button>
            </div>
          )}

          {!loadingLoc && coords && (
            <div>
              {/* Map Preview Iframe Embed — only ever rendered once we have a REAL fix, so
                  this can never display a placeholder location as if it were live. */}
              <div style={{
                height: '200px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--border-amber)',
                marginBottom: '16px',
                position: 'relative'
              }}>
                <iframe
                  title="Live Location Map Preview"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.longitude - 0.01}%2C${coords.latitude - 0.01}%2C${coords.longitude + 0.01}%2C${coords.latitude + 0.01}&layer=mapnik&marker=${coords.latitude}%2C${coords.longitude}`}
                />
              </div>

              {/* Coordinates Badge */}
              <div style={{
                padding: '12px 14px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--amber-primary)', fontWeight: 600 }}>
                    <Compass size={14} />
                    <span>GPS Telemetry</span>
                  </div>
                  <button onClick={fetchCurrentLocation} style={{ background: 'none', border: 'none', color: 'var(--amber-primary)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RefreshCw size={12} />
                    Recalibrate
                  </button>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Lat: {coords.latitude.toFixed(6)}°, Lng: {coords.longitude.toFixed(6)}°
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Precision Radius: ~{coords.accuracy || 'unknown'} meters
                </div>
              </div>

              {/* Location Description Input */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Location Landmark / Dispatch Address
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. EEL Freeport Container Yard #2..."
                />
                <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: 4 }}>
                  This label is just a note for readability — the coordinates above are what
                  actually gets shared, and they're your device's real current GPS fix.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={loadingLoc}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!coords || loadingLoc}>
            <Navigation size={16} />
            <span>Share Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};
