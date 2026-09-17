import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, ImagePlus, FlaskConical, RotateCcw } from 'lucide-react';
import { showToast } from '../utils/toast';
import './CameraCapture.css';

/**
 * Downscale + compress an image file client-side via canvas.
 * Caps the longest edge at 1024px and re-encodes as JPEG q0.85.
 * Shrinks typical phone photos 5-10x — faster uploads on rural
 * bandwidth and a smaller AI payload. Returns the original
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

const T = {
  ready: {
    en: 'Ready to scan a crop leaf',
    hi: 'फसल की पत्ती स्कैन के लिए तैयार',
    mr: 'पिकाच्या पानाच्या स्कॅनसाठी तयार',
  },
  readyHint: {
    en: 'Place one leaf in good light',
    hi: 'अच्छी रोशनी में एक पत्ती रखें',
    mr: 'चांगल्या प्रकाशात एक पान ठेवा',
  },
  camera: { en: 'Camera', hi: 'कैमरा', mr: 'कॅमेरा' },
  cameraAria: { en: 'Open camera', hi: 'कैमरा खोलें', mr: 'कॅमेरा उघडा' },
  upload: { en: 'Upload', hi: 'अपलोड', mr: 'अपलोड' },
  uploadAria: { en: 'Upload a photo', hi: 'फोटो अपलोड करें', mr: 'फोटो अपलोड करा' },
  samples: { en: 'Samples', hi: 'नमूने', mr: 'नमुने' },
  samplesAria: { en: 'Try a sample image', hi: 'नमूना आज़माएँ', mr: 'नमुना वापरा' },
  sampleLabel: { en: 'Or try a sample:', hi: 'या नमूना आज़माएँ:', mr: 'किंवा नमुना वापरा:' },
  retake: { en: 'Retake', hi: 'फिर लें', mr: 'पुन्हा घ्या' },
  cancel: { en: 'Cancel', hi: 'रद्द करें', mr: 'रद्द करा' },
  cameraDenied: {
    en: 'Camera not available — use Upload instead.',
    hi: 'कैमरा उपलब्ध नहीं — अपलोड का उपयोग करें।',
    mr: 'कॅमेरा उपलब्ध नाही — अपलोड वापरा.',
  },
  notImage: {
    en: 'Please choose an image file.',
    hi: 'कृपया एक इमेज फ़ाइल चुनें।',
    mr: 'कृपया प्रतिमा फाइल निवडा.',
  },
  sampleFailed: {
    en: 'Could not load the sample image.',
    hi: 'नमूना इमेज लोड नहीं हो सकी।',
    mr: 'नमुना प्रतिमा लोड होऊ शकली नाही.',
  },
  previewAlt: { en: 'Crop leaf preview', hi: 'फसल पत्ती प्रीव्यू', mr: 'पीक पान प्रीव्ह्यू' },
};

function SproutSvg() {
  return (
    <svg viewBox="0 0 64 64" className="capture-sprout" aria-hidden="true">
      <circle cx="32" cy="22" r="8" fill="#F2C14E" opacity="0.85" />
      <path d="M32 52 V28" stroke="#8FD19E" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 40 C 25 38 21 33 21 27 C 27 28 31 32 32 40 Z" fill="#8FD19E" />
      <path d="M32 36 C 39 34 43 29 43 24 C 37 25 32.5 29 32 36 Z" fill="#C8E6C9" />
    </svg>
  );
}

function CameraCapture({ onImageSelected, disabled, isLoading, lang = 'en' }) {
  const [mode, setMode] = useState('idle'); // 'idle', 'camera', 'preview'
  const [preview, setPreview] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef(null);

  const t = (key) => T[key][lang] || T[key].en;

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
      showToast({ message: t('cameraDenied'), tone: 'warning' });
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
      showToast({ message: t('notImage'), tone: 'warning' });
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
      showToast({ message: t('sampleFailed'), tone: 'warning' });
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
      {/* Viewfinder frame */}
      <div className={`viewfinder-frame ${isLoading ? 'is-scanning' : ''}`}>
        <div className="corner top-left"></div>
        <div className="corner top-right"></div>
        <div className="corner bottom-left"></div>
        <div className="corner bottom-right"></div>

        {isLoading && <div className="scan-line"></div>}

        {mode === 'idle' && (
          <div className="capture-placeholder">
            <SproutSvg />
            <p className="placeholder-title">{t('ready')}</p>
            <p className="placeholder-hint">{t('readyHint')}</p>
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
          <>
            <img src={preview} alt={t('previewAlt')} className={`preview-image ${isLoading ? 'blur-sm' : ''}`} />
            {isLoading && <div className="skeleton-overlay skeleton" />}
          </>
        )}
      </div>

      {/* Preview actions */}
      {mode === 'preview' && !isLoading && (
        <div className="capture-actions">
          <button className="capture-btn secondary" onClick={clearSelection} disabled={disabled}>
            <RotateCcw size={18} aria-hidden="true" /> {t('retake')}
          </button>
        </div>
      )}

      {/* Camera actions */}
      {mode === 'camera' && (
        <div className="capture-actions">
          <button className="capture-btn secondary" onClick={clearSelection} disabled={disabled}>
            {t('cancel')}
          </button>
          <button className="capture-btn shutter" onClick={takePhoto} disabled={disabled} aria-label={t('camera')}>
            <div className="shutter-inner"></div>
          </button>
          <span className="capture-btn-ghost" aria-hidden="true" />
        </div>
      )}

      {/* Idle: three large source buttons */}
      {mode === 'idle' && (
        <div className="capture-actions">
          <button className="capture-btn primary" onClick={startCamera} disabled={disabled}>
            <Camera size={22} aria-hidden="true" />
            <span>{t('camera')}</span>
          </button>
          <label className={`capture-btn upload ${disabled ? 'disabled' : ''}`} htmlFor="file-upload">
            <ImagePlus size={22} aria-hidden="true" />
            <span>{t('upload')}</span>
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
        </div>
      )}

      {/* Fail-safe offline samples */}
      {mode === 'idle' && !isLoading && (
        <div className="sample-images-section">
          <p className="sample-title">
            <FlaskConical size={15} aria-hidden="true" /> {t('sampleLabel')}
          </p>
          <div className="sample-grid">
            <button
              className="sample-btn"
              onClick={() => loadSample('/samples/sample1.jpg', 'tomato_healthy.jpg')}
              disabled={disabled}
              aria-label={t('samplesAria') + ' 1'}
            >
              <img src="/samples/sample1.jpg" alt="" />
            </button>
            <button
              className="sample-btn"
              onClick={() => loadSample('/samples/sample2.jpg', 'tomato_early_blight.jpg')}
              disabled={disabled}
              aria-label={t('samplesAria') + ' 2'}
            >
              <img src="/samples/sample2.jpg" alt="" />
            </button>
            <button
              className="sample-btn"
              onClick={() => loadSample('/samples/sample3.jpg', 'garden_healthy.jpg')}
              disabled={disabled}
              aria-label={t('samplesAria') + ' 3'}
            >
              <img src="/samples/sample3.jpg" alt="" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CameraCapture;
