/**
 * Home — the dashboard farmers land on after entering
 *
 * - Hero: greeting, localized date, and a chip for the resolved city, with a
 *   staggered entrance (greeting → meta → sections, 0.1s apart)
 * - One primary CTA ("Scan a Crop") with a one-line trilingual helper
 * - Weather mini-card (failures never block the page — retry chip + city
 *   search fallback instead)
 * - Weather advisory highlight, severity-coloured, from the shared tips module
 * - Secondary quick actions (History / Ask AI / Advisory)
 * - Recent scans: severity-coloured icon, per-language disease name, mini
 *   confidence ring, localized relative time; skeletons while loading
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ScanLine, History, MessageCircle, CloudSun, MapPin,
  Sprout, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { getWeather, geocodeCity } from '../api';
import { WeatherIcon } from '../utils/weatherIcons';
import { getAdvisoryHighlight } from '../utils/advisory';
import {
  pickDiseaseName, relativeTime, confidenceTier, isHealthyScan, severityTone,
} from '../utils/diagnosis';
import './Home.css';

const T = {
  greeting: { en: 'Namaste', hi: 'नमस्ते', mr: 'नमस्कार' },
  farmer: { en: 'Farmer', hi: 'किसान', mr: 'शेतकरी' },
  weatherTitle: { en: 'Weather', hi: 'मौसम', mr: 'हवामान' },
  weatherRetry: { en: 'Retry', hi: 'पुनः प्रयास', mr: 'पुन्हा प्रयत्न' },
  weatherCityPh: { en: 'e.g. Nashik', hi: 'जैसे: नाशिक', mr: 'उदा. नाशिक' },
  weatherCityGo: { en: 'Go', hi: 'खोजें', mr: 'शोधा' },
  weatherCityFail: { en: 'City not found — try another.', hi: 'शहर नहीं मिला — दूसरा आज़माएँ।', mr: 'शहर सापडले नाही — दुसरे वापरा.' },
  advisoryLabel: { en: 'Weather advisory', hi: 'मौसम सलाह', mr: 'हवामान सल्ला' },
  quickTitle: { en: 'What do you want to do?', hi: 'आप क्या करना चाहते हैं?', mr: 'तुम्ही काय करू इच्छिता?' },
  history: { en: 'History', hi: 'इतिहास', mr: 'इतिहास' },
  askAi: { en: 'Ask AI', hi: 'AI से पूछें', mr: 'AI ला विचारा' },
  advisory: { en: 'Advisory', hi: 'सलाह', mr: 'सल्ला' },
  recent: { en: 'Recent scans', hi: 'हाल के स्कैन', mr: 'अलीकडील स्कॅन' },
  seeAll: { en: 'See all', hi: 'सभी देखें', mr: 'सर्व पहा' },
  emptyTitle: { en: 'No scans yet', hi: 'अभी कोई स्कैन नहीं', mr: 'अजून स्कॅन नाही' },
  emptyDesc: {
    en: 'Tap "Scan a Crop" to begin.',
    hi: 'शुरू करने के लिए "फसल स्कैन करें" दबाएँ।',
    mr: 'सुरू करण्यासाठी "पीक स्कॅन करा" दाबा.',
  },
  scanCta: { en: 'Scan a Crop', hi: 'फसल स्कैन करें', mr: 'पीक स्कॅन करा' },
  scanHelper: {
    en: 'Photograph a leaf — get a diagnosis in seconds.',
    hi: 'पत्ती की फोटो लें — सेकंडों में निदान पाएँ।',
    mr: 'पानाचा फोटो घ्या — सेकंदांत निदान मिळवा.',
  },
  healthy: { en: 'Healthy', hi: 'स्वस्थ', mr: 'निरोगी' },
  unknown: { en: 'Unknown', hi: 'अज्ञात', mr: 'अज्ञात' },
};

/** Mini confidence ring for a history row. */
function RecentRing({ percent, tier }) {
  const RADIUS = 12;
  const CIRC = 2 * Math.PI * RADIUS;
  const offset = CIRC * (1 - Math.min(Math.max(percent, 0), 100) / 100);
  return (
    <span className={`home-ring home-ring-${tier}`} aria-label={`${percent}%`}>
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <circle className="home-ring-track" cx="16" cy="16" r={RADIUS} fill="none" strokeWidth="3.5" />
        <circle
          className="home-ring-fill"
          cx="16" cy="16" r={RADIUS} fill="none" strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          transform="rotate(-90 16 16)"
        />
        <text className="home-ring-num" x="16" y="20" textAnchor="middle">{percent}</text>
      </svg>
    </span>
  );
}

function Home({ lang = 'en', profile, recentScans, scansLoading, onNavigate, onAskAi, onOpenScan }) {
  const t = (key) => T[key][lang] || T[key].en;
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN';

  const [weather, setWeather] = useState(null);
  const [weatherState, setWeatherState] = useState('loading'); // loading | ok | error
  const [cityQuery, setCityQuery] = useState('');
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState(null);

  const loadWeather = useCallback(async () => {
    if (!navigator.geolocation) {
      setWeatherState('error');
      return;
    }
    setWeatherState('loading');
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      });
      const { latitude, longitude } = position.coords;
      const result = await getWeather(latitude, longitude);
      if (result.success) {
        setWeather(result);
        setWeatherState('ok');
      } else {
        setWeatherState('error');
      }
    } catch {
      setWeatherState('error');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadWeather();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadWeather]);

  // City fallback — when geolocation is denied/unavailable the farmer types
  // a city name instead, so weather is still reachable (same path as the
  // full advisory view).
  const handleCitySearch = async (e) => {
    e.preventDefault();
    const q = cityQuery.trim();
    if (!q || cityLoading) return;
    setCityLoading(true);
    setCityError(null);
    try {
      const loc = await geocodeCity(q);
      const result = await getWeather(loc.lat, loc.lon);
      if (result.success) {
        setWeather(result);
        setWeatherState('ok');
        setCityQuery('');
      } else {
        setCityError(t('weatherCityFail'));
      }
    } catch {
      setCityError(t('weatherCityFail'));
    } finally {
      setCityLoading(false);
    }
  };

  const dateStr = new Date().toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const hasScans = recentScans.length > 0;
  const city = weatherState === 'ok' ? weather?.current?.city : null;
  const advisory = weatherState === 'ok'
    ? getAdvisoryHighlight(weather?.current, weather?.forecast, lang)
    : null;

  const advisoryIcon = advisory?.tone === 'severe'
    ? <AlertTriangle size={18} />
    : advisory?.tone === 'healthy' ? <Sprout size={18} /> : <CloudSun size={18} />;

  return (
    <div className="home">
      {/* Hero — greeting, date, resolved city */}
      <header className="home-hero">
        <h2 className="home-hero-greeting">
          {t('greeting')}, {profile?.name?.split(' ')[0] || t('farmer')}
        </h2>
        <div className="home-hero-meta">
          <p className="home-hero-date">{dateStr}</p>
          {city && (
            <span className="home-city-chip">
              <MapPin size={13} aria-hidden="true" />
              {city}
            </span>
          )}
        </div>
      </header>

      {/* Primary action — one obvious next step */}
      <section className="home-hero-cta-block">
        <button type="button" className="home-hero-cta" onClick={() => onNavigate('scan')}>
          <ScanLine size={22} aria-hidden="true" />
          {t('scanCta')}
        </button>
        <p className="home-hero-helper">{t('scanHelper')}</p>
      </section>

      {/* Weather mini-card — failure never blocks the page */}
      <section className="home-weather glass-panel" aria-label={t('weatherTitle')}>
        {weatherState === 'loading' && (
          <div className="home-weather-loading">
            <div className="skeleton home-weather-skel-temp" />
            <div className="home-weather-skel-col">
              <div className="skeleton home-weather-skel-line" />
              <div className="skeleton home-weather-skel-line short" />
            </div>
          </div>
        )}
        {weatherState === 'error' && (
          <div className="home-weather-error">
            <button type="button" className="home-weather-retry" onClick={loadWeather}>
              <CloudSun size={16} aria-hidden="true" />
              <span>{t('weatherTitle')} · {t('weatherRetry')}</span>
            </button>
            <form className="home-weather-city" onSubmit={handleCitySearch}>
              <input
                type="text"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder={t('weatherCityPh')}
                aria-label={t('weatherCityGo')}
              />
              <button type="submit" disabled={cityLoading || !cityQuery.trim()}>
                {cityLoading ? '…' : t('weatherCityGo')}
              </button>
            </form>
            {cityError && <small className="home-weather-city-error">{cityError}</small>}
          </div>
        )}
        {weatherState === 'ok' && weather?.current && (
          <>
            <div className="home-weather-main">
              <WeatherIcon description={weather.current.description} size={34} aria-hidden="true" />
              <span className="home-weather-temp">{weather.current.temp}°C</span>
              <span className="home-weather-desc">{weather.current.description}</span>
            </div>
            {Array.isArray(weather.forecast) && weather.forecast.length > 0 && (
              <div className="home-weather-strip">
                {weather.forecast.slice(0, 3).map((day, i) => (
                  <div key={i} className="home-weather-day">
                    <WeatherIcon description={day.description} size={16} aria-hidden="true" />
                    <span>{day.temp_min}°–{day.temp_max}°</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Advisory highlight — appears only once the weather resolves */}
      {advisory && (
        <section className={`home-advisory tone-${advisory.tone}`} aria-label={t('advisoryLabel')}>
          <span className="home-advisory-icon" aria-hidden="true">{advisoryIcon}</span>
          <p className="home-advisory-text">{advisory.text}</p>
        </section>
      )}

      {/* Secondary actions — the hero CTA already covers scanning */}
      <section aria-label={t('quickTitle')}>
        <h3 className="home-section-title">{t('quickTitle')}</h3>
        <div className="home-quick-grid">
          <button type="button" className="home-quick" onClick={() => onNavigate('history')}>
            <History size={22} aria-hidden="true" />
            <span>{t('history')}</span>
          </button>
          <button type="button" className="home-quick" onClick={onAskAi}>
            <MessageCircle size={22} aria-hidden="true" />
            <span>{t('askAi')}</span>
          </button>
          <button type="button" className="home-quick" onClick={() => onNavigate('advisory')}>
            <Sprout size={22} aria-hidden="true" />
            <span>{t('advisory')}</span>
          </button>
        </div>
      </section>

      {/* Recent scans */}
      <section>
        <div className="home-recent-head">
          <h3 className="home-section-title">{t('recent')}</h3>
          {hasScans && (
            <button type="button" className="home-see-all" onClick={() => onNavigate('history')}>
              {t('seeAll')} <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {scansLoading && (
          <ul className="home-recent-list" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="home-recent-skel glass-panel">
                <div className="skeleton home-recent-skel-icon" />
                <div className="home-recent-skel-col">
                  <div className="skeleton home-recent-skel-line" />
                  <div className="skeleton home-recent-skel-line short" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {!scansLoading && hasScans && (
          <ul className="home-recent-list">
            {recentScans.map((scan) => {
              const d = scan.diagnosis || {};
              const healthy = isHealthyScan(d);
              const confPercent = Math.round((d.confidence || 0) * 100);
              const name = pickDiseaseName(d, lang);
              const tone = severityTone(d);
              const when = relativeTime(scan.createdAt || scan.timestamp, locale);

              return (
                <li key={scan.id}>
                  <button
                    type="button"
                    className="home-recent-item glass-panel"
                    onClick={() => onOpenScan(scan)}
                  >
                    <span className={`home-recent-icon tone-${tone}`} aria-hidden="true">
                      {healthy ? <Sprout size={20} /> : <AlertTriangle size={20} />}
                    </span>
                    <span className="home-recent-text">
                      <span className="home-recent-name">
                        {healthy ? t('healthy') : (name || t('unknown'))}
                      </span>
                      <span className="home-recent-meta">
                        {d.crop_type && <span className="home-recent-crop">{d.crop_type}</span>}
                        {when && <span className="home-recent-when">{when}</span>}
                      </span>
                    </span>
                    <RecentRing percent={confPercent} tier={confidenceTier(confPercent)} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!scansLoading && !hasScans && (
          <div className="home-empty glass-panel">
            <p className="home-empty-title">{t('emptyTitle')}</p>
            <p className="home-empty-desc">{t('emptyDesc')}</p>
            <button type="button" className="home-empty-cta" onClick={() => onNavigate('scan')}>
              <ScanLine size={20} aria-hidden="true" />
              {t('scanCta')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;
