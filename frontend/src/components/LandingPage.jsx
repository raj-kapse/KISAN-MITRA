/**
 * LandingPage — the app's welcome screen
 *
 * Full-screen field photo with a warm trilingual welcome, the Kisan
 * Mitra logo, and one big Enter button leading to the scan flow.
 * Buttons are large and high-contrast for village-first usability.
 */

import './LandingPage.css';

const TEXT = {
  welcome: {
    en: 'Welcome to Kisan Mitra',
    hi: 'किसान मित्र में आपका स्वागत है',
    mr: 'शेतकरी मित्र मध्ये आपले स्वागत आहे',
  },
  tagline: {
    en: 'Point your camera at a crop leaf — know the disease in seconds, in your language, free.',
    hi: 'फसल की पत्ती पर कैमरा पकड़ें — रोग की पहचान सेकंडों में, अपनी भाषा में, बिल्कुल मुफ़्त।',
    mr: 'पिकाच्या पानावर कॅमेरा धरा — रोगाची ओळख सेकंदांत, तुमच्या भाषेत, पूर्णपणे मोफत.',
  },
  enter: { en: 'Get Started', hi: 'शुरू करें', mr: 'सुरू करा' },
  langLabel: { en: 'हिंदी', hi: 'मराठी', mr: 'ENG' },
  langAria: { en: 'Switch language', hi: 'भाषा बदलें', mr: 'भाषा बदला' },
  points: {
    en: ['📷 Scan a leaf', '🔊 Hear the advice', '🏪 Find agri-stores'],
    hi: ['📷 पत्ती की जाँच करें', '🔊 सलाह सुनें', '🏪 कृषि स्टोर खोजें'],
    mr: ['📷 पानाची तपासणी करा', '🔊 सल्ला ऐका', '🏪 कृषी दुकाने शोधा'],
  },
};

function LandingPage({ lang, onToggleLang, onEnter, profile }) {
  const t = (key) => TEXT[key][lang] || TEXT[key].en;

  return (
    <div className="landing">
      <div className="landing-topbar">
        <span className="landing-brand">
          <svg viewBox="0 0 64 64" className="landing-logo" aria-hidden="true">
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
          <span className="landing-brand-name">{profile ? profile.name : 'Kisan Mitra'}</span>
        </span>
        <button
          className="landing-lang-btn"
          onClick={onToggleLang}
          aria-label={TEXT.langAria[lang]}
        >
          {TEXT.langLabel[lang]}
        </button>
      </div>

      <div className="landing-center">
        <h1 className="landing-welcome">{t('welcome')}</h1>
        <p className="landing-tagline">{t('tagline')}</p>

        <ul className="landing-points">
          {t && TEXT.points[lang].map((p) => <li key={p}>{p}</li>)}
        </ul>

        <button className="landing-enter-btn" onClick={onEnter}>
          {t('enter')} <span className="landing-enter-arrow" aria-hidden="true">→</span>
        </button>

        {profile && (
          <p className="landing-profile-note">
            {lang === 'hi'
              ? `नमस्ते ${profile.name} — आपका इतिहास सुरक्षित है।`
              : lang === 'mr'
              ? `नमस्कार ${profile.name} — तुमचा इतिहास सुरक्षित आहे.`
              : `Namaste ${profile.name} — your history is saved.`}
          </p>
        )}
      </div>
    </div>
  );
}

export default LandingPage;
