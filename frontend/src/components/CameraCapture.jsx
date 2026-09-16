/**
 * CameraCapture — Photo capture/upload component
 *
 * Provides two methods of image input:
 * 1. Camera capture (uses device camera via file input accept="image/*" capture)
 * 2. File upload (select from gallery/filesystem)
 *
 * Shows a live preview of the selected image before submission.
 */

import { useState, useRef } from 'react';
import './CameraCapture.css';

function CameraCapture({ onImageSelected, disabled }) {
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  /**
   * Handle file selection from either camera or file picker.
   * Creates an object URL for preview and passes the file up.
   */
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, or WebP)');
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image too large. Maximum size is 10MB.');
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreview(url);
    onImageSelected(file);
  };

  /**
   * Clear the current selection and reset inputs.
   */
  const clearSelection = () => {
    setPreview(null);
    onImageSelected(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="camera-capture">
      {/* Preview area */}
      {preview ? (
        <div className="preview-container">
          <img src={preview} alt="Selected crop leaf" className="preview-image" />
          <button
            className="clear-btn"
            onClick={clearSelection}
            disabled={disabled}
            aria-label="Remove selected image"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="capture-placeholder">
          <span className="placeholder-icon">📸</span>
          <p>Take a photo or upload an image of the affected crop leaf</p>
        </div>
      )}

      {/* Action buttons */}
      {!preview && (
        <div className="capture-actions">
          {/* Camera capture — opens native camera on mobile */}
          <label className="capture-btn camera" htmlFor="camera-input">
            📷 Take Photo
          </label>
          <input
            ref={cameraInputRef}
            id="camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="sr-only"
            disabled={disabled}
          />

          {/* File upload — opens file picker */}
          <label className="capture-btn upload" htmlFor="file-input">
            🖼️ Upload Image
          </label>
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="sr-only"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

export default CameraCapture;
