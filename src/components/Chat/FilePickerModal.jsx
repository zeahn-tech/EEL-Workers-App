import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadChatMedia } from '../../services/supabaseAuth';

// Supabase mode routes the actual file bytes through Storage, so this cap is a real,
// working limit (Supabase's own project-level Storage limit is the only thing above it).
const SUPABASE_MAX_BYTES = 25 * 1024 * 1024; // 25MB

// Local (offline) mode has no server — the entire file gets embedded as base64 text
// directly inside the message record, which is persisted to browser localStorage. That
// has a hard quota of only a few MB total, shared across every key this app stores, so
// this cap is deliberately much lower than the Supabase one: it's not an arbitrary
// restriction, it's what actually fits without risking a silent, uncaught storage error.
const LOCAL_MAX_BYTES = 3 * 1024 * 1024; // 3MB

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FilePickerModal = ({ isOpen, onClose, onSendFile, chatId, supabaseMode }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const maxBytes = supabaseMode ? SUPABASE_MAX_BYTES : LOCAL_MAX_BYTES;
  const maxLabel = supabaseMode ? '25MB' : '3MB (local/offline mode)';

  const validateAndSet = (file) => {
    if (file.size > maxBytes) {
      setErrorMsg(
        supabaseMode
          ? `File size exceeds the maximum limit of ${maxLabel}.`
          : `File size exceeds the ${maxLabel} limit for offline mode. Switch to Supabase mode in Admin Settings for uploads up to 25MB.`
      );
      return;
    }
    setErrorMsg('');
    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) validateAndSet(file);
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) validateAndSet(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMsg('');

    if (supabaseMode) {
      // Upload the real file to Storage — the message only ever holds the resulting URL,
      // not the file's bytes, which is what makes large attachments actually reliable.
      const result = await uploadChatMedia(chatId || 'general', selectedFile);
      setIsUploading(false);
      if (!result.success) {
        setErrorMsg(result.error || 'Upload failed. Please try again.');
        return;
      }
      onSendFile({
        fileName: selectedFile.name,
        fileSize: formatBytes(selectedFile.size),
        fileType: selectedFile.type || 'application/octet-stream',
        fileUrl: result.url
      });
      setSelectedFile(null);
      onClose();
      return;
    }

    // Local mode: no server to upload to, so the file is embedded as base64 directly in
    // the message. The size cap above keeps this within reach of localStorage's quota, but
    // sendFileMessage can still legitimately report failure (e.g. quota already mostly
    // used up by earlier attachments) — that error surfaces back in the chat input bar.
    const reader = new FileReader();
    reader.onload = (event) => {
      onSendFile({
        fileName: selectedFile.name,
        fileSize: formatBytes(selectedFile.size),
        fileType: selectedFile.type || 'application/octet-stream',
        fileUrl: event.target.result
      });
      setIsUploading(false);
      setSelectedFile(null);
      onClose();
    };
    reader.onerror = () => {
      setIsUploading(false);
      setErrorMsg('Could not read that file. Please try again.');
    };
    reader.readAsDataURL(selectedFile);
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content amber-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="var(--amber-primary)" />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Attach Dispatch Document</h3>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Drop Zone */}
        <div style={{ padding: '20px' }}>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border-amber)',
              borderRadius: 'var(--radius-md)',
              padding: '30px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(15, 23, 42, 0.4)',
              transition: 'background 0.2s'
            }}
          >
            {/* No `accept` restriction — any file type is allowed, up to the size cap */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <UploadCloud size={40} color="var(--amber-primary)" style={{ margin: '0 auto 12px' }} />

            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              Click or drag file to attach
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Any file type · Max {maxLabel}
            </p>
          </div>

          {errorMsg && (
            <div style={{ marginTop: '12px', color: '#EF4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {selectedFile && (
            <div style={{
              marginTop: '16px',
              padding: '12px 14px',
              background: 'var(--amber-light)',
              border: '1px solid var(--amber-primary)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={20} color="var(--amber-primary)" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {formatBytes(selectedFile.size)}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isUploading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!selectedFile || isUploading}>
            {isUploading ? 'Uploading…' : 'Send File'}
          </button>
        </div>
      </div>
    </div>
  );
};
