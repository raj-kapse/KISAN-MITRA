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
import { Home, History, Leaf, User, LogOut } from 'lucide-react';
import CameraCapture from './components/CameraCapture';
import DiagnosisResult from './components/DiagnosisResult';
import WeatherAdvisory from './components/WeatherAdvisory';
import VoiceButton from './components/VoiceButton';
import ScanHistory from './components/ScanHistory';
import Chatbot from './components/Chatbot';
import LandingPage from './components/LandingPage';
import ProfileModal from './components/ProfileModal';
import { diagnoseCrop, saveScanHistory, clearProfileToken } from './api';
import './App.css';

/**
 * KisanLogo — custom brand mark: a rising sun over a young sprout.
 * Inline SVG so it is crisp at any size, needs no network request,
 * and adds zero load time.
 */
function KisanLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="24" r="9" fill="#F2C14E" />
      <g stroke="#F2C14E" strokeWidth="2.4" strokeLinecap="round">
        <line x1="32" y1="7" x2="32" y2="10" />
        <line x1="45" y1="12" x2="42.6" y2="14.4" />
        <line x1="19" y1="12" x2="21.4" y2="14.4" />
      </g>
      <path d="M32 54 V30" stroke="#EAF5EC" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 42 C 24 40 20 34 20 27 C 27 28 31.5 33 32 42 Z" fill="#8FD19E" />
      <path d="M32 38 C 40 36 44 30 44 23 C 37 24 32.5 29 32 38 Z" fill="#C8E6C9" />
      <path d="M22 56 q10 -4 20 0" stroke="#EAF5EC" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Header name + tagline per language. */
const HEADER_TEXT = {
  appName: { en: 'Kisan Mitra', hi: 'किसान मित्र', mr: 'शेतकरी मित्र' },
  subtitle: {
    en: 'AI Crop Health & Advisory',
    hi: 'AI फसल स्वास्थ्य एवं सलाह',
    mr: 'AI पीक आरोग्य व सल्ला',
  },
};

function App() {
  // Image state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  // Diagnosis state
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [lang, setLang] = useState('en'); // 'en' | 'hi' | 'mr'
  const [view, setView] = useState('scan'); // 'scan' or 'history'
  const [entered, setEntered] = useState(() => {
    // Returning visitors skip the landing page (per browser)
    try { return localStorage.getItem('kisan_mitra_entered') === '1'; } catch { return false; }
  });

  // Farmer profile — phone-number identity. Persisted so history is
  // linked to the same farmer across visits.
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kisan_mitra_profile') || 'null'); } catch { return null; }
  });
  const [profileOpen, setProfileOpen] = useState(false);

  const handleSignedIn = (p) => {
    setProfile(p);
    setProfileOpen(false);
    try { localStorage.setItem('kisan_mitra_profile', JSON.stringify(p)); } catch { /* storage blocked */ }
  };

  const handleSignOut = () => {
    setProfile(null);
    clearProfileToken();
    try { localStorage.removeItem('kisan_mitra_profile'); } catch { /* storage blocked */ }
  };

  const handleEnter = () => {
    setEntered(true);
    try { localStorage.setItem('kisan_mitra_entered', '1'); } catch { /* storage blocked */ }
  };

  // Increments on every new diagnose request; responses from superseded
  // requests are discarded so a slow old scan can't overwrite fresh state.
  const diagnoseRequestIdRef = useRef(0);

  // H4: last resolved location from the weather panel — geotags history
  // saves. Reset per scan so an old location never sticks to a new one.
  const [lastLocation, setLastLocation] = useState(null);
  const handleLocationResolved = useCallback((loc) => setLastLocation(loc), []);

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
    setLastLocation(null); // fresh scan → fresh geotag

    // Guard against stale responses: only the latest request may write state
    const requestId = ++diagnoseRequestIdRef.current;
    const isCurrent = () => diagnoseRequestIdRef.current === requestId;
    try {
      const result = await diagnoseCrop(selectedImage);
      if (!isCurrent()) return; // a newer scan started meanwhile
      if (result.success && result.diagnosis) {
        setDiagnosis(result.diagnosis);
        // Fire-and-forget save to history (don't block the UI),
        // tagged with the farmer's profile when signed in and the
        // location resolved by the weather panel when available
        saveScanHistory(result.diagnosis, lastLocation, profile).catch(err =>
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

  /** Cycle language: English → हिंदी → मराठी → English */
  const toggleLang = () => setLang(l => l === 'en' ? 'hi' : l === 'hi' ? 'mr' : 'en');
  const nextLangLabel = { en: 'हिंदी', hi: 'मराठी', mr: 'ENG' }[lang];

  // Landing page gate — first visit shows the welcome screen
  if (!entered) {
    return (
      <>
        <LandingPage
          lang={lang}
          onToggleLang={toggleLang}
          onEnter={handleEnter}
          profile={profile}
        />
        {profileOpen && (
          <ProfileModal lang={lang} onClose={() => setProfileOpen(false)} onSignedIn={handleSignedIn} />
        )}
      </>
    );
  }

  return (
    <div className="app">
      {/* Soft field-photo backdrop behind the frosted content panels */}
      <div className="field-bg" aria-hidden="true" />
      <header className="app-header glass-panel">
        <div className="header-top">
          <div className="header-brand">
            <KisanLogo className="header-logo" />
            <div className="header-titles">
              <h1>{HEADER_TEXT.appName[lang]}</h1>
              <p className="subtitle">{HEADER_TEXT.subtitle[lang]}</p>
            </div>
          </div>
          <div className="header-controls">
            {profile ? (
              <button
                className="profile-chip"
                onClick={handleSignOut}
                title={lang === 'hi' ? 'साइन आउट' : lang === 'mr' ? 'साइन आउट' : 'Sign out'}
              >
                <User size={15} />
                <span className="profile-chip-name">{profile.name.split(' ')[0]}</span>
                <LogOut size={14} />
              </button>
            ) : (
              <button
                className="profile-chip profile-chip-signin"
                onClick={() => setProfileOpen(true)}
                title={lang === 'hi' ? 'साइन इन करें' : lang === 'mr' ? 'साइन इन करा' : 'Sign in'}
              >
                <User size={15} />
                <span>{lang === 'hi' ? 'साइन इन' : lang === 'mr' ? 'साइन इन' : 'Sign in'}</span>
              </button>
            )}
            <button
              className="lang-toggle"
              onClick={toggleLang}
              aria-label="Toggle language"
            >
              {nextLangLabel}
            </button>
          </div>
        </div>
      </header>

      <main className="app-main pb-bottom-nav">
        {view === 'history' && (
          <div className="animate-slide-up">
            <ScanHistory lang={lang} profile={profile} onBack={() => setView('scan')} />
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
                        {lang === 'hi' ? 'विश्लेषण हो रहा है...' : lang === 'mr' ? 'विश्लेषण सुरू आहे...' : 'Analyzing...'}
                      </span>
                    ) : (
                      <>
                        <Leaf size={20} className="btn-icon" />
                        {lang === 'hi' ? 'फसल का विश्लेषण करें' : lang === 'mr' ? 'पीक विश्लेषण करा' : 'Analyze Crop'}
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
                <WeatherAdvisory lang={lang} diagnosis={diagnosis} onLocationResolved={handleLocationResolved} />
                <button className="scan-again-btn btn-3d-outline" onClick={handleScanAgain}>
                  {lang === 'hi' ? 'दूसरी फसल स्कैन करें' : lang === 'mr' ? 'दुसरे पीक स्कॅन करा' : 'Scan Another Crop'}
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* Floating Chatbot */}
      <Chatbot diagnosis={diagnosis} lang={lang} />

      {profileOpen && (
        <ProfileModal lang={lang} onClose={() => setProfileOpen(false)} onSignedIn={handleSignedIn} />
      )}

      <nav className="bottom-nav glass-panel">
        <button 
          className={`nav-item ${view === 'scan' ? 'active' : ''}`}
          onClick={() => setView('scan')}
        >
          <Home size={24} />
          <span>{lang === 'hi' ? 'स्कैन' : lang === 'mr' ? 'स्कॅन' : 'Scan'}</span>
        </button>
        <button 
          className={`nav-item ${view === 'history' ? 'active' : ''}`}
          onClick={() => setView('history')}
        >
          <History size={24} />
          <span>{lang === 'hi' ? 'इतिहास' : lang === 'mr' ? 'इतिहास' : 'History'}</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
