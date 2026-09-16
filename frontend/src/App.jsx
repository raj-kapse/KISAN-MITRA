/**
 * Kisan Mitra — Main App Component
 *
 * Complete flow:
 * 1. User captures/uploads a crop leaf photo
 * 2. Photo → backend → Gemini AI → structured diagnosis
 * 3. Results: disease card, weather advisory, treatment — all bilingual
 * 4. Voice read-aloud, scan history, language toggle
 */

import { useState, useCallback } from 'react';
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

    try {
      const result = await diagnoseCrop(selectedImage);
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
      console.error('Diagnosis error:', err);
      setError(err.message || 'Failed to analyze image. Please try again.');
    } finally {
      setLoading(false);
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

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-top">
          <h1>🌾 Kisan Mitra</h1>
          <div className="header-controls">
            <button className="lang-toggle" onClick={toggleLang} aria-label="Toggle language">
              {lang === 'en' ? 'हिंदी' : 'ENG'}
            </button>
          </div>
        </div>
        <p className="subtitle">
          {lang === 'hi' ? 'AI फसल स्वास्थ्य एवं सलाह' : 'AI Crop Health & Advisory'}
        </p>
        {/* Nav tabs */}
        <nav className="header-nav">
          <button
            className={`nav-tab ${view === 'scan' ? 'active' : ''}`}
            onClick={() => setView('scan')}
          >
            {lang === 'hi' ? '📸 स्कैन' : '📸 Scan'}
          </button>
          <button
            className={`nav-tab ${view === 'history' ? 'active' : ''}`}
            onClick={() => setView('history')}
          >
            {lang === 'hi' ? '📜 इतिहास' : '📜 History'}
          </button>
        </nav>
      </header>

      {/* Main content */}
      <main className="app-main">

        {/* History view */}
        {view === 'history' && (
          <ScanHistory lang={lang} onBack={() => setView('scan')} />
        )}

        {/* Scan view */}
        {view === 'scan' && (
          <>
            {/* Step 1: Capture / Upload */}
            {!diagnosis && (
              <>
                <CameraCapture
                  onImageSelected={handleImageSelected}
                  disabled={loading}
                  isLoading={loading}
                />

                {selectedImage && (
                  <button
                    className="diagnose-btn"
                    onClick={handleDiagnose}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="loading-content">
                        {lang === 'hi' ? 'विश्लेषण हो रहा है...' : 'Analyzing...'}
                      </span>
                    ) : (
                      lang === 'hi' ? '🔬 फसल का विश्लेषण करें' : '🔬 Analyze Crop'
                    )}
                  </button>
                )}
              </>
            )}

            {/* Error display */}
            {error && (
              <div className="error-msg">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Step 2: Results */}
            {diagnosis && (
              <>
                {/* Scanned image */}
                {imagePreviewUrl && (
                  <div className="scanned-image-container">
                    <img src={imagePreviewUrl} alt="Scanned crop" className="scanned-image" />
                  </div>
                )}

                {/* Voice read-aloud */}
                <VoiceButton diagnosis={diagnosis} lang={lang} />

                {/* Diagnosis card */}
                <DiagnosisResult diagnosis={diagnosis} lang={lang} />

                {/* Weather advisory */}
                <WeatherAdvisory lang={lang} diagnosis={diagnosis} />

                {/* Scan again */}
                <button className="scan-again-btn" onClick={handleScanAgain}>
                  {lang === 'hi' ? '📸 दूसरी फसल स्कैन करें' : '📸 Scan Another Crop'}
                </button>
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        {lang === 'hi'
          ? 'किसान मित्र · भारतीय किसानों के लिए AI फसल सलाह'
          : 'Kisan Mitra · AI-powered crop advisory for Indian farmers'
        }
      </footer>

      {/* Floating Chatbot */}
      <Chatbot diagnosis={diagnosis} lang={lang} />
    </div>
  );
}

export default App;
