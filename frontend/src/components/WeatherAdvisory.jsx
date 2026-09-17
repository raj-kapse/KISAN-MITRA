/**
 * WeatherAdvisory — Displays weather data + crop advisory
 *
 * Gets the farmer's location two ways:
 * 1. Browser geolocation (preferred)
 * 2. Manual fallback: city-name search via /api/geocode when geolocation
 *    is denied, unavailable, or times out — the feature never dead-ends.
 *
 * Shows:
 * - Current conditions (temp, humidity, wind, description)
 * - 5-day forecast cards
 * - Crop-specific guidance: AI combined advisory when a diagnosis exists,
 *   otherwise rule-based tips
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CloudSun, MapPin, Sparkles, Info } from 'lucide-react';
import { getWeather, getAiWeatherAdvisory, geocodeCity } from '../api';
import { WeatherIcon } from '../utils/weatherIcons';
import './WeatherAdvisory.css';

function WeatherAdvisory({ lang = 'en', diagnosis, onLocationResolved }) {
  const [weather, setWeather] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [manualError, setManualError] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualCity, setManualCity] = useState(null);

  const [aiError, setAiError] = useState(null);

  // Weather fetch — the data layer. Runs when location or manual city changes.
  const fetchWeatherAndAdvice = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAiAdvice(null);
    setAiError(null);

    try {
      // Request browser geolocation (skipped when we already picked a city manually)
      const position = await new Promise((resolve, reject) => {
        if (manualCity) {
          resolve({ coords: { latitude: manualCity.lat, longitude: manualCity.lon } });
          return;
        }
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported by your browser.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, (err) => {
          if (err.code === 1) {
            setLocationDenied(true);
            reject(new Error('Location access denied. Please enable location permissions.'));
          } else {
            reject(new Error('Could not get your location. Please try again.'));
          }
        }, { timeout: 10000 });
      });

      const { latitude, longitude } = position.coords;
      const weatherResult = await getWeather(latitude, longitude);

      if (!weatherResult.success) {
        throw new Error(weatherResult.error || 'Failed to fetch weather data');
      }

      setWeather({ current: weatherResult.current, forecast: weatherResult.forecast });

      // H4: hand the resolved coordinates back to App so the NEXT scan's
      // history entry is geotagged (before this, location was always null).
      if (onLocationResolved) {
        onLocationResolved({
          lat: latitude,
          lon: longitude,
          city: weatherResult.current?.city || manualCity?.name || null,
        });
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [manualCity, onLocationResolved]);

  // Auto-fetch on mount and when a manual city is picked. Without this the
  // advisory view rendered an empty panel forever on first open — the only
  // trigger was the Retry button, which itself only renders once an error
  // exists. Keyed so a completed fetch never re-triggers the effect.
  const fetchedKeyRef = useRef(null);
  useEffect(() => {
    const key = manualCity ? `${manualCity.lat},${manualCity.lon}` : 'geo';
    if (fetchedKeyRef.current === key) return;
    fetchedKeyRef.current = key;
    fetchWeatherAndAdvice();
  }, [manualCity, fetchWeatherAndAdvice]);

  // AI advisory — a SEPARATE flow. An advisory failure (429/quota) must
  // never replace working weather data; the UI falls back to rule-based
  // tips instead (C2). adviceKey dedupes: the advisory refetches only when
  // the weather, the diagnosis, or the language actually changed — so the
  // toggle no longer re-prompts geolocation or refetches weather (M3).
  const adviceKey = `${weather?.current?.temp || ''}|${weather?.current?.description || ''}|${diagnosis?.disease_name || ''}|${lang}`;
  const lastAdviceKeyRef = useRef(null);
  useEffect(() => {
    if (!weather?.current || !diagnosis) return;
    if (lastAdviceKeyRef.current === adviceKey) return; // already fetched for this state
    lastAdviceKeyRef.current = adviceKey;
    let cancelled = false;
    (async () => {
      try {
        const aiResult = await getAiWeatherAdvisory(diagnosis, weather.current, lang);
        if (!cancelled && aiResult.success) {
          setAiAdvice(aiResult.advice);
          setAiError(null);
        }
      } catch (err) {
        if (!cancelled) setAiError(err.message);
      }
    })();
    return () => { cancelled = true; };
    // deps intentionally keyed on adviceKey — it captures diagnosis/weather/lang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviceKey]);

  /** Manual city fallback — resolve city name to coordinates, then fetch weather */
  const handleManualSearch = async (e) => {
    e.preventDefault();
    const q = cityQuery.trim();
    if (!q || manualLoading) return;

    setManualLoading(true);
    setManualError(null);
    try {
      const loc = await geocodeCity(q);
      setManualCity(loc); // triggers the fetch effect with the new coordinates
      setCityQuery('');
      setShowManualInput(false);
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualLoading(false);
    }
  };

  const isHi = lang === 'hi';
  const isMr = lang === 'mr';

  if (loading) {
    return (
      <div className="weather-card loading-state">
        <span className="spinner" /> {isHi ? 'आपके स्थान के लिए मौसम लाया जा रहा है…' : isMr ? 'तुमच्या ठिकाण्यासाठी हवामान आणत आहे…' : 'Fetching weather for your location…'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="weather-card error-state">
        <p>🌦️ {error}</p>
        {locationDenied ? (
          <small>{isHi ? 'स्थान की अनुमति बंद है — नीचे अपने शहर का नाम डालें।' : isMr ? 'स्थान परवानगी बंद आहे — खाली तुमच्या शहराचे नाव टाका.' : 'Location permission is off — search your city by name below.'}</small>
        ) : (
          <button className="retry-btn" onClick={fetchWeatherAndAdvice}>
            {isHi ? 'पुनः प्रयास करें' : isMr ? 'पुन्हा प्रयत्न करा' : 'Retry'}
          </button>
        )}
        {!showManualInput && (
          <button className="retry-btn manual-toggle" onClick={() => { setShowManualInput(true); setManualError(null); }}>
            {isHi ? '🏙️ शहर खोजें' : isMr ? '🏙️ शहर शोधा' : '🏙️ Search by city'}
          </button>
        )}
        {showManualInput && (
          <form className="manual-city-form" onSubmit={handleManualSearch}>
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder={isHi ? "जैसे: नाशिक या Nashik" : isMr ? "उदा. नाशिक" : "e.g. Nashik"}
              autoFocus
            />
            <button type="submit" disabled={manualLoading || !cityQuery.trim()}>
              {manualLoading ? '…' : (isHi ? "खोजें" : isMr ? "शोधा" : "Search")}
            </button>
          </form>
        )}
        {manualError && <small className="manual-error">{manualError}</small>}
      </div>
    );
  }

  if (!weather) return null;

  const { current, forecast } = weather;
  const dayNames = isHi
    ? ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Determine dynamic background class based on weather description
  const desc = (current.description || '').toLowerCase();
  let weatherTheme = 'weather-theme-default';
  if (desc.includes('rain') || desc.includes('drizzle')) weatherTheme = 'weather-theme-rain';
  else if (desc.includes('cloud')) weatherTheme = 'weather-theme-cloudy';
  else if (desc.includes('clear') || desc.includes('sun')) weatherTheme = 'weather-theme-sunny';

  return (
    <div className={`weather-panel glass-panel ${weatherTheme}`}>
      <div className="weather-header">
        <h3>
          <CloudSun size={18} aria-hidden="true" />
          {lang === 'hi' ? 'मौसम आधारित कृषि सलाह' : isMr ? 'हवामान आधारित कृषी सल्ला' : 'Weather-Driven Advisory'}
        </h3>
      </div>

      {/* Current conditions */}
      {current && (
        <div className="current-weather">
          <div className="current-main">
            <WeatherIcon description={current.description} size={36} className="current-temp-icon" aria-hidden="true" />
            <span className="current-temp">{current.temp}°C</span>
            <div className="current-details">
              <span>{current.description}</span>
              {(current.city || manualCity?.name) && (
                <span className="city-name"><MapPin size={11} aria-hidden="true" /> {current.city || `${manualCity.name}${manualCity.state ? ', ' + manualCity.state : ''}`}</span>
              )}
            </div>
          </div>
          <div className="current-stats">
            <span>💧 {current.humidity}%</span>
            <span>🌡️ {isHi ? "महसूस" : isMr ? "भासणारे" : "Feels"} {current.feels_like}°C</span>
            {current.wind_speed && <span>💨 {current.wind_speed} m/s</span>}
          </div>
        </div>
      )}

      {/* 5-day forecast */}
      {forecast && forecast.length > 0 && (
        <div className="forecast-row">
          {forecast.map((day, i) => {
            const date = new Date(day.date + 'T00:00:00');
            const dayName = dayNames[date.getDay()];
            return (
              <div className="forecast-day" key={i}>
                <span className="forecast-day-name">{dayName}</span>
                <span className="forecast-temp">{day.temp_min}–{day.temp_max}°</span>
                <span className="forecast-rain">💧{day.rain_probability}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Combined Crop Advisory — falls back to rule-based tips on failure */}
      {aiAdvice ? (
        <div className="crop-advice ai-advice">
          <h4><Sparkles size={16} aria-hidden="true" /> {isHi ? 'AI फसल एवं मौसम सुझाव' : isMr ? 'AI पीक व हवामान सल्ला' : 'AI Crop & Weather Advisory'}</h4>
          <p>{aiAdvice}</p>
        </div>
      ) : (
        <div className="crop-advice">
          <h4><Info size={16} aria-hidden="true" /> {isHi ? 'सामान्य मौसम सुझाव' : isMr ? 'सामान्य हवामान सल्ला' : 'General Weather Advice'}</h4>
          {aiError && (
            <small className="manual-error" style={{ display: 'block', marginBottom: '0.35rem' }}>
              {isHi ? '(AI सलाह अभी उपलब्ध नहीं है — सामान्य सुझाव देखें)' : isMr ? '(AI सल्ला सध्या उपलब्ध नाही — सामान्य सल्ला पहा)' : '(AI advice unavailable right now — general tips shown)'}
            </small>
          )}
          <ul>
            {getCropAdvice(current, forecast, lang).map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Location switcher — always available after a successful load */}
      <button
        className="location-switch no-print"
        onClick={() => { setShowManualInput(true); setManualError(null); setError(null); }}
      >
        {isHi ? '📍 स्थान बदलें' : '📍 Change location'}
      </button>

      {showManualInput && weather && (
        <form className="manual-city-form" onSubmit={handleManualSearch}>
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            placeholder={isHi ? "जैसे: नाशिक या Nashik" : isMr ? "उदा. नाशिक" : "e.g. Nashik"}
            autoFocus
          />
          <button type="submit" disabled={manualLoading || !cityQuery.trim()}>
            {manualLoading ? '…' : (isHi ? "खोजें" : isMr ? "शोधा" : "Search")}
          </button>
        </form>
      )}
      {manualError && weather && <small className="manual-error">{manualError}</small>}
    </div>
  );
}

/**
 * Rule-based tips when no AI advisory is available (trilingual M4).
 * Each rule holds the same tip in en/hi/mr.
 */
function getCropAdvice(current, forecast, lang = 'en') {
  const idx = lang === 'hi' ? 1 : lang === 'mr' ? 2 : 0;
  const rules = [
    { when: c => c.humidity > 80, tip: [
      'High humidity — watch for fungal outbreaks; consider a preventive fungicide spray.',
      'अधिक आर्द्रता — फंगल रोग का खतरा; बचाव के लिए फफूंदनाशक छिड़काव पर विचार करें।',
      'जास्त आर्द्रता — बुरशीचा धोका; प्रतिबंधात्मक बुरशीनाशक फवारणीचा विचार करा.',
    ]},
    { when: c => c.wind_speed && c.wind_speed > 10, tip: [
      'Strong winds — avoid pesticide spraying today; drift will reduce effectiveness.',
      'तेज़ हवा — आज कीटकनाशक छिड़काव न करें; दवा बिखर जाएगी।',
      'मोठा वारा — आज कीटकनाशक फवारणी करू नका; औषध वाहून जाईल.',
    ]},
    { when: c => c.temp > 35, tip: [
      'Heat stress likely — irrigate in the early morning or evening, not midday.',
      'गर्मी का खतरा — पानी सुबह या शाम को दें, दोपहर में नहीं।',
      'उष्णतेचा ताण — पाणी सकाळी किंवा संध्याकाळी द्या, दुपारी नाही.',
    ]},
    { when: (c, f) => (f || []).slice(0, 3).some(d => d.rain_probability >= 60), tip: [
      'Rain likely within 3 days — delay fertilizer/pesticide application so it is not washed away.',
      '3 दिन में बारिश संभव — खाद/दवा का छिड़काव टालें, बह जाएगा।',
      '3 दिवसांत पाऊस शक्य — खत/औषध फवारणी टाळा, वाहून जाईल.',
    ]},
  ];
  const tips = rules.filter(r => r.when(current, forecast)).map(r => r.tip[idx]);
  if (tips.length === 0) {
    return [[
      'Conditions are stable — a good window for field work and spraying.',
      'मौसम स्थिर है — खेत के काम और छिड़काव के लिए अच्छा समय।',
      'हवामान स्थिर आहे — शेतकाम व फवारणीसाठी चांगली वेळ.',
    ][idx]];
  }
  return tips;
}

export default WeatherAdvisory;
