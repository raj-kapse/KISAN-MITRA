/**
 * Kisan Mitra — Main App Component
 *
 * Complete flow:
 * 1. User captures/uploads a crop leaf photo
 * 2. Photo → backend → Gemini AI → structured diagnosis
 * 3. Results: disease card, weather advisory, treatment — all bilingual
 * 4. Voice read-aloud, scan history, language toggle
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import CameraCapture from './components/CameraCapture';
import DiagnosisResult from './components/DiagnosisResult';
import WeatherAdvisory from './components/WeatherAdvisory';
import VoiceButton from './components/VoiceButton';
import ScanHistory from './components/ScanHistory';
import Chatbot from './components/Chatbot';
import { diagnoseCrop, saveScanHistory } from './api';
import './App.css';

function App() {
  // Image state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  // Diagnosis state
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [lang, setLang] = useState('en'); // 'en' or 'hi'
  const [view, setView] = useState('scan'); // 'scan' or 'history'

  // Increments on every new diagnose request; responses from superseded
  // requests are discarded so a slow old scan can't overwrite fresh state.
  const diagnoseRequestIdRef = useRef(0);

  // Free the previous blob URL whenever a new one is created or the app
  // resets — object URLs pin the image bytes in memory until revoked.
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  /** Handle image selection from CameraCapture component. */
  const handleImageSelected = useCallback((file) => {
    if (file) {
      setSelectedImage(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setDiagnosis(null);
      setError(null);
    } else {
      setSelectedImage(null);
      setImagePreviewUrl(null);
    }
  }, []);

  /** Submit image for AI diagnosis + auto-save to history */
  const handleDiagnose = async () => {
    if (!selectedImage) return;

    setLoading(true);
    setError(null);
    setDiagnosis(null);

    // Guard against stale responses: only the latest request may write state
    const requestId = ++diagnoseRequestIdRef.current;
    const isCurrent = () => diagnoseRequestIdRef.current === requestId;
    try {
      const result = await diagnoseCrop(selectedImage);
      if (!isCurrent()) return; // a newer scan started meanwhile
      if (result.success && result.diagnosis) {
        setDiagnosis(result.diagnosis);
        // Fire-and-forget save to history (don't block the UI)
        saveScanHistory(result.diagnosis).catch(err =>
          console.warn('History save skipped:', err.message)
        );
      } else {
        throw new Error(result.error || 'Unexpected response from server');
      }
    } catch (err) {
      if (!isCurrent()) return; // stale — ignore
      console.error('Diagnosis error:', err);
      setError(err.message || 'Failed to analyze image. Please try again.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  /** Reset for a new scan */
  const handleScanAgain = () => {
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setDiagnosis(null);
    setError(null);
  };

  /** Toggle language */
  const toggleLang = () => setLang(l => l === 'en' ? 'hi' : 'en');

  // We'll import Lucide icons for the UI
  const { Home, History, Leaf } = require('lucide-react');

  return (
    <div className="app">
      <header className="app-header glass-panel">
        <div className="header-top">
          <h1>Kisan Mitra</h1>
          <div className="header-controls">
            <button
              className="lang-toggle"
              onClick={toggleLang}
              aria-label="Toggle language"
            >
              {lang === 'en' ? 'EN' : 'HI'}
            </button>
          </div>
        </div>
        <p className="subtitle">AI Crop Doctor & Advisor</p>
      </header>

      <main className="app-main pb-bottom-nav">
        {view === 'history' && (
          <div className="animate-slide-up">
            <ScanHistory lang={lang} onBack={() => setView('scan')} />
          </div>
        )}

        {view === 'scan' && (
          <div className="animate-slide-up">
            {!diagnosis && (
              <>
                <CameraCapture
                  onImageSelected={handleImageSelected}
                  disabled={loading}
                  isLoading={loading}
                  lang={lang}
                />
                {selectedImage && (
                  <button
                    className={`diagnose-btn btn-3d ${loading ? 'disabled' : ''}`}
                    onClick={handleDiagnose}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="loading-content">
                        <div className="spinner" /> 
                        {lang === 'hi' ? 'विश्लेषण हो रहा है...' : 'Analyzing...'}
                      </span>
                    ) : (
                      <>
                        <Leaf size={20} className="btn-icon" /> 
                        {lang === 'hi' ? 'फसल का विश्लेषण करें' : 'Analyze Crop'}
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            {error && (
              <div className="error-msg glass-panel">
                <strong>Error:</strong> {error}
              </div>
            )}

            {diagnosis && (
              <>
                {imagePreviewUrl && (
                  <div className="scanned-image-container glass-panel">
                    <img src={imagePreviewUrl} alt="Scanned crop" className="scanned-image" />
                  </div>
                )}
                
                <VoiceButton diagnosis={diagnosis} lang={lang} />
                <DiagnosisResult diagnosis={diagnosis} lang={lang} />
                <WeatherAdvisory lang={lang} diagnosis={diagnosis} />
                
                <button className="scan-again-btn btn-3d-outline" onClick={handleScanAgain}>
                  {lang === 'hi' ? 'दूसरी फसल स्कैन करें' : 'Scan Another Crop'}
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* Floating Chatbot */}
      <Chatbot diagnosis={diagnosis} lang={lang} />

      <nav className="bottom-nav glass-panel">
        <button 
          className={`nav-item ${view === 'scan' ? 'active' : ''}`}
          onClick={() => setView('scan')}
        >
          <Home size={24} />
          <span>{lang === 'hi' ? 'स्कैन' : 'Scan'}</span>
        </button>
        <button 
          className={`nav-item ${view === 'history' ? 'active' : ''}`}
          onClick={() => setView('history')}
        >
          <History size={24} />
          <span>{lang === 'hi' ? 'इतिहास' : 'History'}</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
