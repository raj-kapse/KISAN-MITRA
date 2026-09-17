/**
 * Home — the dashboard farmers land on after entering
 *
 * - Greeting + localized date
 * - Weather mini-card (fetched only after entering home; failures never
 *   block the page — a compact retry chip instead)
 * - Quick actions: Scan / History / Ask AI (callback into App) / Advisory
 * - Recent scans (3) with skeletons; tapping opens a read-only result view
 * - Empty state: big "Scan your crop" hero CTA
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ScanLine, History, MessageCircle, CloudSun,
  Sprout, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { getWeather, geocodeCity } from '../api';
import { WeatherIcon } from '../utils/weatherIcons';
import './Home.css';

const T = {
  greeting: { en: 'Namaste', hi: 'नमस्ते', mr: 'नमस्कार' },
  farmer: { en: 'Farmer', hi: 'किसान', mr: 'शेतकरी' },
  weatherTitle: { en: 'Weather', hi: 'मौसम', mr: 'हवामान' },
  weatherRetry: { en: 'Retry', hi: 'पुनः प्रयास', mr: 'पुन्हा प्रयत्न' },
  weatherCityPh: { en: 'e.g. Nashik', hi: 'जैसे: नाशिक', mr: 'उदा. नाशिक' },
  weatherCityGo: { en: 'Go', hi: 'खोजें', mr: 'शोधा' },
  weatherCityFail: { en: 'City not found — try another.', hi: 'शहर नहीं मिला — दूसरा आज़माएँ।', mr: 'शहर सापडले नाही — दुसरे वापरा.' },
  quickTitle: { en: 'What do you want to do?', hi: 'आप क्या करना चाहते हैं?', mr: 'तुम्ही काय करू इच्छिता?' },
  scan: { en: 'Scan Crop', hi: 'फसल स्कैन', mr: 'पीक स्कॅन' },
  history: { en: 'History', hi: 'इतिहास', mr: 'इतिहास' },
  askAi: { en: 'Ask AI', hi: 'AI से पूछें', mr: 'AI ला विचारा' },
  advisory: { en: 'Advisory', hi: 'सलाह', mr: 'सल्ला' },
  recent: { en: 'Recent scans', hi: 'हाल के स्कैन', mr: 'अलीकडील स्कॅन' },
  seeAll: { en: 'See all', hi: 'सभी देखें', mr: 'सर्व पहा' },
  emptyTitle: { en: 'No scans yet', hi: 'अभी कोई स्कैन नहीं', mr: 'अजून स्कॅन नाही' },
  emptyDesc: {
    en: 'Scan a leaf and Kisan Mitra will identify the disease and treatment.',
    hi: 'पत्ती स्कैन करें — किसान मित्र रोग और उपचार बताएगा।',
    mr: 'पान स्कॅन करा — शेतकरी मित्र रोग आणि उपचार सांगेल.',
  },
  scanCta: { en: 'Scan your crop', hi: 'अपनी फसल स्कैन करें', mr: 'तुमचे पीक स्कॅन करा' },
  healthy: { en: 'Healthy', hi: 'स्वस्थ', mr: 'निरोगी' },
};

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
    const t = setTimeout(() => {
      loadWeather();
    }, 0);
    return () => clearTimeout(t);
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

  return (
    <div className="home animate-slide-up">
      <header className="home-greeting">
        <h2>
          {t('greeting')}, {profile?.name?.split(' ')[0] || t('farmer')}
        </h2>
        <p>{dateStr}</p>
      </header>

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

      {/* Quick actions 2×2 */}
      <section aria-label={t('quickTitle')}>
        <h3 className="home-section-title">{t('quickTitle')}</h3>
        <div className="home-quick-grid">
          <button type="button" className="home-quick" onClick={() => onNavigate('scan')}>
            <ScanLine size={24} aria-hidden="true" />
            <span>{t('scan')}</span>
          </button>
          <button type="button" className="home-quick" onClick={() => onNavigate('history')}>
            <History size={24} aria-hidden="true" />
            <span>{t('history')}</span>
          </button>
          <button type="button" className="home-quick" onClick={onAskAi}>
            <MessageCircle size={24} aria-hidden="true" />
            <span>{t('askAi')}</span>
          </button>
          <button type="button" className="home-quick" onClick={() => onNavigate('advisory')}>
            <Sprout size={24} aria-hidden="true" />
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
              const isHealthy = (d.disease_name || '').toLowerCase() === 'healthy';
              return (
                <li key={scan.id}>
                  <button
                    type="button"
                    className="home-recent-item glass-panel"
                    onClick={() => onOpenScan(scan)}
                  >
                    <span
                      className={`home-recent-icon ${isHealthy ? 'healthy' : 'diseased'}`}
                      aria-hidden="true"
                    >
                      {isHealthy ? <Sprout size={20} /> : <AlertTriangle size={20} />}
                    </span>
                    <span className="home-recent-text">
                      <span className="home-recent-name">
                        {isHealthy ? t('healthy') : (d.disease_name || '—')}
                      </span>
                      <span className="home-recent-crop">{d.crop_type || ''}</span>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
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
