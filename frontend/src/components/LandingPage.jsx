/**
 * LandingPage — the storefront
 *
 * A stranger understands the product in 3 seconds and trusts it:
 * full-viewport hero over the field photo, trilingual welcome,
 * three capability cards, one amber primary CTA ("Enter to Scan"),
 * a guest path, and a returning-farmer greeting.
 *
 * The scanner is NOT mounted until onEnter fires (App gate).
 */

import { ScanLine, Volume2, Store, ArrowRight } from 'lucide-react';
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
  enter: { en: 'Enter to Scan', hi: 'स्कैन करने के लिए खोलें', mr: 'स्कॅनसाठी सुरू करा' },
  guest: { en: 'Continue as guest', hi: 'बिना लॉगिन जारी रखें', mr: 'लॉगिनशिवाय सुरू ठेवा' },
  langLabel: { en: 'हिंदी', hi: 'मराठी', mr: 'ENG' },
  langAria: { en: 'Switch language', hi: 'भाषा बदलें', mr: 'भाषा बदला' },
  appName: { en: 'Kisan Mitra', hi: 'किसान मित्र', mr: 'शेतकरी मित्र' },
  greeting: { en: 'Namaste', hi: 'नमस्ते', mr: 'नमस्कार' },
  notYou: { en: 'Not you? Sign out', hi: 'आप नहीं हैं? साइन आउट', mr: 'तुम्ही नाही? साइन आउट' },
  signIn: { en: 'Sign in', hi: 'साइन इन', mr: 'साइन इन' },
  features: [
    {
      key: 'scan',
      icon: ScanLine,
      title: { en: 'Scan', hi: 'स्कैन', mr: 'स्कॅन' },
      desc: {
        en: 'Identify crop diseases from a single leaf photo',
        hi: 'एक पत्ती की फोटो से फसल रोग पहचानें',
        mr: 'एका पानाच्या छायाचित्रातून पीक रोग ओळखा',
      },
    },
    {
      key: 'advice',
      icon: Volume2,
      title: { en: 'Advice', hi: 'सलाह', mr: 'सल्ला' },
      desc: {
        en: 'Treatment steps you can hear in your language',
        hi: 'उपचार के कदम, अपनी भाषा में सुनें',
        mr: 'उपचाराची पायरी, तुमच्या भाषेत ऐका',
      },
    },
    {
      key: 'stores',
      icon: Store,
      title: { en: 'Stores', hi: 'दुकानें', mr: 'दुकाने' },
      desc: {
        en: 'Find agri-input shops near your field',
        hi: 'अपने खेत के पास कृषि दुकानें खोजें',
        mr: 'तुमच्या शेताजवळ कृषी दुकाने शोधा',
      },
    },
  ],
  footer: { en: 'Made for Indian farmers', hi: 'भारतीय किसानों के लिए बनाया गया', mr: 'भारतीय शेतकऱ्यांसाठी बनवले' },
};

function LandingLogo() {
  return (
    <svg viewBox="0 0 64 64" className="landing-logo" aria-hidden="true">
      <g className="landing-rays" stroke="#F2C14E" strokeWidth="2.4" strokeLinecap="round">
        <line x1="32" y1="7" x2="32" y2="10" />
        <line x1="45" y1="12" x2="42.6" y2="14.4" />
        <line x1="19" y1="12" x2="21.4" y2="14.4" />
      </g>
      <circle cx="32" cy="24" r="9" fill="#F2C14E" />
      <path d="M32 54 V30" stroke="#EAF5EC" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 42 C 24 40 20 34 20 27 C 27 28 31.5 33 32 42 Z" fill="#8FD19E" />
      <path d="M32 38 C 40 36 44 30 44 23 C 37 24 32.5 29 32 38 Z" fill="#C8E6C9" />
      <path d="M22 56 q10 -4 20 0" stroke="#EAF5EC" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function LandingPage({ lang, onToggleLang, onEnter, profile, onSignOutRequest }) {
  const t = (key) => TEXT[key][lang] || TEXT[key].en;

  return (
    <div className="landing" lang={lang}>
      <div className="landing-topbar">
        <span className="landing-brand">
          <LandingLogo />
          <span className="landing-brand-name">{t('appName')}</span>
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
        {profile && (
          <p className="landing-greeting">
            {t('greeting')}, {profile.name.split(' ')[0]}
          </p>
        )}

        <h1 className="landing-welcome">{t('welcome')}</h1>
        <p className="landing-tagline">{t('tagline')}</p>

        <ul className="landing-features">
          {TEXT.features.map(({ key, icon: Icon, title, desc }) => (
            <li key={key} className="landing-feature">
              <span className="landing-feature-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span className="landing-feature-copy">
                <span className="landing-feature-title">{title[lang] || title.en}</span>
                <span className="landing-feature-desc">{desc[lang] || desc.en}</span>
              </span>
            </li>
          ))}
        </ul>

        <button className="landing-enter-btn" onClick={onEnter}>
          {t('enter')}
          <ArrowRight size={20} aria-hidden="true" />
        </button>

        {profile ? (
          <p className="landing-guest-note">
            {t('greeting')}, {profile.name} ·{' '}
            <button
              type="button"
              className="landing-guest-hint landing-signout-link"
              onClick={onSignOutRequest}
            >
              {t('notYou')}
            </button>
          </p>
        ) : (
          <button type="button" className="landing-guest-btn" onClick={onEnter}>
            {t('guest')}
          </button>
        )}
      </div>

      <div className="landing-footer">
        <span>{t('footer')} · Kisan Mitra</span>
        <span className="landing-version">v2.0</span>
      </div>
    </div>
  );
}

export default LandingPage;
