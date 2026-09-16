import { useState, useRef, useEffect, useCallback } from 'react';
import './CameraCapture.css';

/**
 * Downscale + compress an image file client-side via canvas.
 * Caps the longest edge at 1024px and re-encodes as JPEG q0.85.
 * Shrinks typical phone photos 5-10x — faster uploads on rural
 * bandwidth and a smaller Gemini payload. Returns the original
 * file untouched if it is already small enough.
 */
async function compressImage(file) {
  const MAX_EDGE = 1024;
  const QUALITY = 0.85;

  if (!file.type.startsWith('image/')) return file;

  try {
    const img = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      image.src = url;
    });

    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (longest <= MAX_EDGE && file.size < 400 * 1024) return file;

    const scale = Math.min(1, MAX_EDGE / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', QUALITY)
    );
    if (!blob || blob.size >= file.size) return file; // compression made it bigger — keep original
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // any failure: use the original file
  }
}

function CameraCapture({ onImageSelected, disabled, isLoading, lang = 'en' }) {
  const [mode, setMode] = useState('idle'); // 'idle', 'camera', 'preview'
  const [preview, setPreview] = useState(null);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef(null);

  /** Compress, then show the file as preview (revoking the previous object URL). */
  const showPreview = async (file) => {
    const compressed = await compressImage(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(compressed);
    previewUrlRef.current = url;
    setPreview(url);
    setMode('preview');
    onImageSelected(compressed);
  };

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to load metadata to ensure dimensions are ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
        };
      }
      setMode('camera');
      onImageSelected(null);
    } catch (err) {
      console.error("Camera access failed:", err);
      alert('Camera access denied or not available. Please use the upload option.');
      setMode('idle');
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        showPreview(file);
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    showPreview(file);
    stopCamera();
  };

  const loadSample = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'image/jpeg' });
      showPreview(file);
      stopCamera();
    } catch (err) {
      console.error("Failed to load sample", err);
      alert("Failed to load sample image.");
    }
  };

  const clearSelection = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
    setMode('idle');
    onImageSelected(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    stopCamera();
  };

  return (
    <div className="camera-capture-container">
      {/* Viewfinder Frame */}
      <div className={`viewfinder-frame ${isLoading ? 'is-scanning' : ''}`}>
        {/* Motif corners */}
        <div className="corner top-left"></div>
        <div className="corner top-right"></div>
        <div className="corner bottom-left"></div>
        <div className="corner bottom-right"></div>

        {/* Scan line animation */}
        {isLoading && <div className="scan-line"></div>}

        {mode === 'idle' && (
          <div className="capture-placeholder">
            <span className="placeholder-icon">📸</span>
            <p>Ready to scan crop leaf</p>
          </div>
        )}

        {mode === 'camera' && (
          <video
            ref={videoRef}
            className="camera-video"
            playsInline
            autoPlay
            muted
          />
        )}

        {mode === 'preview' && preview && (
          <img src={preview} alt="Crop preview" className="preview-image" />
        )}
      </div>

      {/* Action Buttons */}
      <div className="capture-actions">
        {mode === 'camera' ? (
          <>
            <button className="capture-btn shutter" onClick={takePhoto} disabled={disabled}>
              <div className="shutter-inner"></div>
            </button>
            <button className="capture-btn secondary" onClick={clearSelection} disabled={disabled}>
              Cancel
            </button>
          </>
        ) : mode === 'preview' ? (
          <button className="capture-btn secondary" onClick={clearSelection} disabled={disabled}>
            ✕ Clear
          </button>
        ) : (
          <>
            <button className="capture-btn primary" onClick={startCamera} disabled={disabled}>
              📷 Open Camera
            </button>
            <label className="capture-btn upload" htmlFor="file-upload">
              🖼️ Upload
            </label>
            <input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="sr-only"
              disabled={disabled}
            />
          </>
        )}
      </div>

      {/* Fail-safe Samples for Demo */}
      {mode === 'idle' && !isLoading && (
        <div className="sample-images-section">
          <p className="sample-title">{lang === 'hi' ? 'या नमूना आज़माएँ:' : 'Or try a sample:'}</p>
          <div className="sample-grid">
            <button className="sample-btn" onClick={() => loadSample('/samples/sample1.jpg', 'tomato_healthy.jpg')} disabled={disabled}>
              <img src="/samples/sample1.jpg" alt="Sample 1" />
            </button>
            <button className="sample-btn" onClick={() => loadSample('/samples/sample2.jpg', 'tomato_early_blight.jpg')} disabled={disabled}>
              <img src="/samples/sample2.jpg" alt="Sample 2" />
            </button>
            <button className="sample-btn" onClick={() => loadSample('/samples/sample3.jpg', 'garden_healthy.jpg')} disabled={disabled}>
              <img src="/samples/sample3.jpg" alt="Sample 3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CameraCapture;
