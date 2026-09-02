import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, UploadCloud, AlertCircle } from 'lucide-react';
import { uploadChatMedia } from '../../services/supabaseAuth';

// Supabase mode uploads the real image file to Storage, so this is a genuine, working cap.
const SUPABASE_MAX_BYTES = 15 * 1024 * 1024; // 15MB

// Local mode embeds the image as base64 directly in the message, persisted to browser
// localStorage — which has a hard quota of only a few MB total across everything this app
// stores. This lower cap is what actually fits reliably, not an arbitrary restriction.
const LOCAL_MAX_BYTES = 2 * 1024 * 1024; // 2MB

export const ImagePickerModal = ({ isOpen, onClose, onSendImage, chatId, supabaseMode }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef(null);

  if (!isOpen) return null;

  const maxBytes = supabaseMode ? SUPABASE_MAX_BYTES : LOCAL_MAX_BYTES;
  const maxLabel = supabaseMode ? '15MB' : '2MB (local/offline mode)';

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Accepts every image MIME type the browser reports (PNG, JPG, WEBP, GIF, HEIC, SVG,
    // BMP, TIFF, AVIF...) — nothing narrower than "starts with image/", so no legitimate
    // photo format gets rejected just because it isn't one of a hardcoded few.
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file.');
      return;
    }

    if (file.size > maxBytes) {
      setErrorMsg(
        supabaseMode
          ? `Image size exceeds the maximum limit of ${maxLabel}.`
          : `Image size exceeds the ${maxLabel} limit for offline mode. Switch to Supabase mode in Admin Settings for uploads up to 15MB.`
      );
      return;
    }

    setErrorMsg('');
    setSelectedImage(file);

    const reader = new FileReader();
    reader.onload = (event) => setPreviewUrl(event.target.result);
    reader.readAsDataURL(file); // local preview only — doesn't decide how it's actually sent
  };

  const handleSubmit = async () => {
    if (!selectedImage) return;
    setIsUploading(true);
    setErrorMsg('');

    if (supabaseMode) {
      const result = await uploadChatMedia(chatId || 'general', selectedImage);
      setIsUploading(false);
      if (!result.success) {
        setErrorMsg(result.error || 'Upload failed. Please try again.');
        return;
      }
      onSendImage({ imageUrl: result.url, fileName: selectedImage.name }, caption);
      resetAndClose();
      return;
    }

    // Local mode: previewUrl is already the base64 data URL from handleImageChange —
    // that's what gets sent since there's no server to upload the real file to.
    onSendImage({ imageUrl: previewUrl, fileName: selectedImage.name }, caption);
    setIsUploading(false);
    resetAndClose();
  };

  const resetAndClose = () => {
    setSelectedImage(null);
    setPreviewUrl('');
    setCaption('');
    onClose();
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content amber-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ImageIcon size={20} color="var(--amber-primary)" />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Share Dispatch Photo</h3>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px' }}>
          {!previewUrl ? (
            <div
              onClick={() => imageInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-amber)',
                borderRadius: 'var(--radius-md)',
                padding: '35px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(15, 23, 42, 0.4)'
              }}
            >
              <input
                type="file"
                ref={imageInputRef}
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              <UploadCloud size={44} color="var(--amber-primary)" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                Select Cargo or Dispatch Photo
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Any image format · Max {maxLabel}
              </p>
            </div>
          ) : (
            <div>
              <div style={{
                position: 'relative',
                maxHeight: '260px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--border-amber)',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{ maxHeight: '250px', width: '100%', objectFit: 'contain' }}
                />
                <button
                  onClick={() => {
                    setPreviewUrl('');
                    setSelectedImage(null);
                  }}
                  className="btn btn-secondary"
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    padding: 0
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Photo Caption / Dispatch Notes (Optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Container bill of lading inspection completed at gate 4..."
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div style={{ marginTop: '12px', color: '#EF4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isUploading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!previewUrl || isUploading}>
            {isUploading ? 'Uploading…' : 'Send Image'}
          </button>
        </div>
      </div>
    </div>
  );
};
