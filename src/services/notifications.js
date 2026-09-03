// Plays a short two-tone chime using the Web Audio API — no audio file to load, works
// offline, and respects browser autoplay policy by simply doing nothing if it's blocked
// (wrapped in try/catch) rather than throwing and breaking the message-receive flow.
export const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // Audio autoplay policy blocked it — silently skip rather than break the caller.
  }
};

// Returns 'granted' | 'denied' | 'default' | 'unsupported'. Never guessed — reflects
// exactly what the browser actually reports, so the UI can show the real current state.
export const getNotificationPermission = () => {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
};

// Must be called from a user gesture (a click) — browsers ignore or auto-reject a
// permission request that isn't, so this is deliberately never called automatically on
// page load. Returns the resulting permission string.
export const requestNotificationPermission = async () => {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
};

// Shows a native OS/browser notification popup. Only actually shows anything if
// permission is genuinely 'granted' — no fallback, no fake banner pretending to be a
// system notification. Returns the Notification instance (or null) so the caller can
// wire up onclick behavior (e.g. jump to the relevant chat).
export const showBrowserNotification = ({ title, body, tag }) => {
  if (getNotificationPermission() !== 'granted') return null;
  try {
    return new Notification(title, { body, tag, icon: './icon-192.png' });
  } catch {
    return null;
  }
};
