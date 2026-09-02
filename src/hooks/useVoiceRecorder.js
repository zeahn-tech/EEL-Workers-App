import { useState, useRef, useCallback } from 'react';

// Converts a recorded audio Blob into a base64 data URL — used for local (offline) mode,
// which has no server to upload to. Exported because the caller (ChatArea) needs it too,
// to decide per-mode whether to use this or upload the raw blob to Supabase Storage.
export const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not process the recording.'));
  reader.readAsDataURL(blob);
});

// maxDurationSeconds is a parameter, not a hardcoded constant, because the safe limit is
// genuinely different per storage mode: a real backend (Supabase Storage) can comfortably
// hold a full 5-minute voice note, but local/offline mode still has to fit the recording
// as base64 text inside browser localStorage's few-MB total quota — see the caller in
// ChatArea.jsx for the actual numbers used for each mode.
export const useVoiceRecorder = (maxDurationSeconds = 300) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const elapsedSecondsRef = useRef(0);
  const resolveRef = useRef(null); // resolves the promise returned by stopRecording

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      setIsRecording(false);
      mediaRecorderRef.current.stop();
    });
  }, []);

  const startRecording = useCallback(async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Voice recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Resolves with the raw Blob rather than a data URL — the caller decides how to
      // persist it (upload to Supabase Storage, or convert to base64 for local mode via
      // the exported blobToDataUrl above), matching the same pattern used for files and
      // images so a large voice note doesn't hit the exact same localStorage ceiling that
      // used to silently break large file/image attachments.
      recorder.onstop = () => {
        cleanupStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        resolveRef.current?.({ blob, mimeType: recorder.mimeType || 'audio/webm', duration: elapsedSecondsRef.current });
      };

      recorder.start();
      setIsRecording(true);
      setElapsedSeconds(0);
      elapsedSecondsRef.current = 0;
      timerRef.current = setInterval(() => {
        elapsedSecondsRef.current += 1;
        setElapsedSeconds(elapsedSecondsRef.current);
        if (elapsedSecondsRef.current >= maxDurationSeconds) {
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      setError(err.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow it in your browser settings to record a voice note.'
        : 'Could not access the microphone.');
    }
  }, [stopRecording, maxDurationSeconds]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      resolveRef.current = null;
      mediaRecorderRef.current.stop();
    }
    cleanupStream();
    setIsRecording(false);
    setElapsedSeconds(0);
  }, []);

  return { isRecording, elapsedSeconds, error, startRecording, stopRecording, cancelRecording };
};
