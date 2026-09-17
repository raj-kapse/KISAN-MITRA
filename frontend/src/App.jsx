/**
 * Kisan Mitra — Main App Component
 *
 * Flow: Landing gate → Home dashboard → Scan / History / Advisory.
 * The scan flow mounts ONLY after the farmer presses Enter (entered state,
 * persisted in localStorage). Guests work end-to-end; history scopes by
 * device until a profile signs in.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { House, History, ScanLine, User, LogOut, Moon, Palette } from 'lucide-react';
import CameraCapture from './components/CameraCapture';
import DiagnosisResult from './components/DiagnosisResult';
import WeatherAdvisory from './components/WeatherAdvisory';
import VoiceButton from './components/VoiceButton';
import ScanHistory from './components/ScanHistory';
import Chatbot from './components/Chatbot';
import LandingPage from './components/LandingPage';
import ProfileModal from './components/ProfileModal';
import ConfirmDialog from './components/ConfirmDialog';
import OfflineBanner from './components/OfflineBanner';
import Home from './components/Home';
import { ToastHost, showToast } from './components/Toast';
import { getHistory, diagnoseCrop, saveScanHistory, clearProfileToken } from './api';
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

const NAV_TEXT = {
  home: { en: 'Home', hi: 'होम', mr: 'होम' },
  scan: { en: 'Scan', hi: 'स्कैन', mr: 'स्कॅन' },
  history: { en: 'History', hi: 'इतिहास', mr: 'इतिहास' },
  profile: { en: 'Profile', hi: 'प्रोफ़ाइल', mr: 'प्रोफाइल' },
  scanAria: { en: 'Scan a crop', hi: 'फसल स्कैन करें', mr: 'पीक स्कॅन करा' },
  signin: { en: 'Sign in', hi: 'साइन इन', mr: 'साइन इन' },
  signout: { en: 'Sign out', hi: 'साइन आउट', mr: 'साइन आउट' },
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
  const [view, setView] = useState('home'); // 'home' | 'scan' | 'history' | 'advisory' | 'result'
  const [entered, setEntered] = useState(() => {
    // Returning visitors skip the landing page (per browser)
    try { return localStorage.getItem('kisan_mitra_entered') === '1'; } catch { return false; }
  });

  // Read-only result view from history/dashboard
  const [viewingScan, setViewingScan] = useState(null);

  // Dashboard data — fetched only after entering home
  const [recentScans, setRecentScans] = useState([]);
  const [scansLoading, setScansLoading] = useState(false);

  // Farmer profile — phone-number identity. Persisted so history is
  // linked to the same farmer across visits.
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kisan_mitra_profile') || 'null'); } catch { return null; }
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Black & white theme — persisted per browser, applied via <html data-theme>.
  const [monoTheme, setMonoTheme] = useState(() => {
    try { return localStorage.getItem('kisan_mitra_theme') === 'mono'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', monoTheme ? 'mono' : 'default');
    try { localStorage.setItem('kisan_mitra_theme', monoTheme ? 'mono' : 'green'); } catch { /* storage blocked */ }
  }, [monoTheme]);

  const handleSignedIn = (p) => {
    setProfile(p);
    setProfileOpen(false);
    try { localStorage.setItem('kisan_mitra_profile', JSON.stringify(p)); } catch { /* storage blocked */ }
  };

  const confirmSignOut = () => {
    setProfile(null);
    setSignOutOpen(false);
    clearProfileToken(); // friend's fix: also clear the backend profile token
    try { localStorage.removeItem('kisan_mitra_profile'); } catch { /* storage blocked */ }
  };

  const handleEnter = () => {
    setEntered(true);
    setView('home');
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

  // Dashboard recent scans — only when home is visible
  useEffect(() => {
    if (!entered || view !== 'home') return;
    let cancelled = false;
    setScansLoading(true);
    getHistory(3, profile)
      .then((result) => {
        if (!cancelled && result.success) setRecentScans(result.scans || []);
      })
      .catch(() => { /* dashboard shows the empty state on failure */ })
      .finally(() => { if (!cancelled) setScansLoading(false); });
    return () => { cancelled = true; };
  }, [entered, view, profile]);

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
    setViewingScan(null);
  };

  /** Open a saved scan read-only (from dashboard or history) */
  const openSavedScan = (scan) => {
    setViewingScan(scan);
    setView('result');
  };

  /** Cycle language: English → हिंदी → मराठी → English */
  const toggleLang = () => setLang(l => l === 'en' ? 'hi' : l === 'hi' ? 'mr' : 'en');
  const nextLangLabel = { en: 'हिंदी', hi: 'मराठी', mr: 'ENG' }[lang];

  const nav = (key) => NAV_TEXT[key][lang] || NAV_TEXT[key].en;

  // Landing page gate — first visit shows the welcome screen.
  // The scan flow is NOT mounted until the farmer enters.
  if (!entered) {
    return (
      <>
        <LandingPage
          lang={lang}
          onToggleLang={toggleLang}
          onEnter={handleEnter}
          profile={profile}
          onSignOutRequest={() => setSignOutOpen(true)}
        />
        {profileOpen && (
          <ProfileModal lang={lang} onClose={() => setProfileOpen(false)} onSignedIn={handleSignedIn} />
        )}
      </>
    );
  }

  const inResultView = view === 'result' && viewingScan;

  return (
    <div className="app" lang={lang}>
      <OfflineBanner lang={lang} />

      {/* Soft field-photo backdrop behind the content panels */}
      <div className="field-bg" aria-hidden="true" />

      <header className="app-header glass-panel header-blur no-print">
        <div className="header-top">
          <div className="header-brand">
            <KisanLogo className="header-logo" />
            <div className="header-titles">
              <h1>{HEADER_TEXT.appName[lang]}</h1>
              <p className="subtitle">{HEADER_TEXT.subtitle[lang]}</p>
            </div>
          </div>
          <div className="header-controls">
            {profile && (
              <button
                className="header-signout"
                onClick={() => setSignOutOpen(true)}
                aria-label={nav('signout')}
                title={nav('signout')}
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            )}
            <button
              className="lang-toggle"
              onClick={() => setMonoTheme(!monoTheme)}
              aria-label="Toggle black & white theme"
              aria-pressed={monoTheme}
              title="Theme"
            >
              {monoTheme ? <Palette size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </button>
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
        {view === 'home' && (
          <Home
            lang={lang}
            profile={profile}
            recentScans={recentScans}
            scansLoading={scansLoading}
            onNavigate={setView}
            onAskAi={() => setChatOpen(true)}
            onOpenScan={openSavedScan}
          />
        )}

        {view === 'history' && (
          <div className="animate-slide-up">
            <ScanHistory lang={lang} profile={profile} onBack={() => setView('home')} onOpenScan={openSavedScan} />
          </div>
        )}

        {view === 'advisory' && (
          <div className="animate-slide-up">
            <WeatherAdvisory lang={lang} diagnosis={diagnosis} onLocationResolved={handleLocationResolved} />
          </div>
        )}

        {inResultView && (
          <div className="animate-slide-up">
            <DiagnosisResult diagnosis={viewingScan.diagnosis} lang={lang} />
            <button className="scan-again-btn" onClick={() => { setViewingScan(null); setView('home'); }}>
              {lang === 'hi' ? 'वापस' : lang === 'mr' ? 'मागे' : 'Back'}
            </button>
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
                    className={`diagnose-btn ${loading ? 'disabled' : ''}`}
                    onClick={handleDiagnose}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="loading-content">
                        <span className="spinner" aria-hidden="true" />
                        {lang === 'hi' ? 'विश्लेषण हो रहा है...' : lang === 'mr' ? 'विश्लेषण सुरू आहे...' : 'Analyzing...'}
                      </span>
                    ) : (
                      lang === 'hi' ? 'फसल का विश्लेषण करें' : lang === 'mr' ? 'पीक विश्लेषण करा' : 'Analyze Crop'
                    )}
                  </button>
                )}
              </>
            )}

            {error && (
              <div className="error-msg glass-panel" role="alert">
                {error}
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
                <button className="scan-again-btn" onClick={handleScanAgain}>
                  {lang === 'hi' ? 'दूसरी फसल स्कैन करें' : lang === 'mr' ? 'दुसरे पीक स्कॅन करा' : 'Scan Another Crop'}
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* Floating Chatbot */}
      <Chatbot diagnosis={diagnosis} lang={lang} chatOpen={chatOpen} setChatOpen={setChatOpen} />

      {profileOpen && (
        <ProfileModal lang={lang} onClose={() => setProfileOpen(false)} onSignedIn={handleSignedIn} />
      )}

      {signOutOpen && (
        <ConfirmDialog
          lang={lang}
          onConfirm={confirmSignOut}
          onCancel={() => setSignOutOpen(false)}
        />
      )}

      <ToastHost />

      <nav className="bottom-nav glass-panel no-print" aria-label="Primary">
        <button
          className={`nav-item ${view === 'home' ? 'active' : ''}`}
          onClick={() => setView('home')}
          aria-current={view === 'home' ? 'page' : undefined}
        >
          <House size={22} aria-hidden="true" />
          <span>{nav('home')}</span>
        </button>

        <button
          className={`nav-item ${view === 'history' ? 'active' : ''}`}
          onClick={() => setView('history')}
          aria-current={view === 'history' ? 'page' : undefined}
        >
          <History size={22} aria-hidden="true" />
          <span>{nav('history')}</span>
        </button>

        <button
          className="nav-scan"
          onClick={() => { handleScanAgain(); setView('scan'); }}
          aria-label={nav('scanAria')}
        >
          <ScanLine size={26} aria-hidden="true" />
        </button>

        <button
          className={`nav-item ${view === 'scan' ? 'active' : ''}`}
          onClick={() => setView('scan')}
          aria-current={view === 'scan' ? 'page' : undefined}
        >
          <span className="nav-item-ghost" aria-hidden="true" />
          <span className="nav-item-label">{nav('scan')}</span>
        </button>

        <button
          className="nav-item"
          onClick={() => (profile ? setSignOutOpen(true) : setProfileOpen(true))}
        >
          <User size={22} aria-hidden="true" />
          <span>{profile ? profile.name.split(' ')[0] : nav('profile')}</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
