import { useState, useRef, useEffect, useCallback } from 'react';
import './CameraCapture.css';

function CameraCapture({ onImageSelected, disabled, isLoading }) {
  const [mode, setMode] = useState('idle'); // 'idle', 'camera', 'preview'
  const [preview, setPreview] = useState(null);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

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
        const url = URL.createObjectURL(file);
        setPreview(url);
        setMode('preview');
        onImageSelected(file);
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

    const url = URL.createObjectURL(file);
    setPreview(url);
    setMode('preview');
    onImageSelected(file);
    stopCamera();
  };

  const clearSelection = () => {
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
    </div>
  );
}

export default CameraCapture;
