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

import { useState, useEffect } from 'react';
import { getWeather, getAiWeatherAdvisory, geocodeCity } from '../api';
import './WeatherAdvisory.css';

function WeatherAdvisory({ lang = 'en', diagnosis }) {
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

  useEffect(() => {
    fetchWeatherAndAdvice();
  }, [diagnosis]);

  const fetchWeatherAndAdvice = async () => {
    setLoading(true);
    setError(null);
    setAiAdvice(null);

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

      // If we have a diagnosis, fetch combined AI advice!
      if (diagnosis && weatherResult.current) {
        const aiResult = await getAiWeatherAdvisory(diagnosis, weatherResult.current, lang);
        if (aiResult.success) {
          setAiAdvice(aiResult.advice);
        }
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /** Manual city fallback — resolve city name to coordinates, then fetch weather */
  const handleManualSearch = async (e) => {
    e.preventDefault();
    const q = cityQuery.trim();
    if (!q || manualLoading) return;

    setManualLoading(true);
    setManualError(null);
    try {
      const loc = await geocodeCity(q);
      setManualCity(loc); // remember so Retry/refresh reuses the city, not geolocation
      setCityQuery('');
      setShowManualInput(false);
      await fetchWeatherAndAdvice();
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualLoading(false);
    }
  };

  const isHi = lang === 'hi';

  if (loading) {
    return (
      <div className="weather-card loading-state">
        <span className="spinner" /> {isHi ? 'आपके स्थान के लिए मौसम लाया जा रहा है…' : 'Fetching weather for your location…'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="weather-card error-state">
        <p>🌦️ {error}</p>
        {locationDenied ? (
          <small>{isHi ? 'स्थान की अनुमति बंद है — नीचे अपने शहर का नाम डालें।' : 'Location permission is off — search your city by name below.'}</small>
        ) : (
          <button className="retry-btn" onClick={fetchWeatherAndAdvice}>
            {isHi ? 'पुनः प्रयास करें' : 'Retry'}
          </button>
        )}
        {!showManualInput && (
          <button className="retry-btn manual-toggle" onClick={() => { setShowManualInput(true); setManualError(null); }}>
            {isHi ? '🏙️ शहर खोजें' : '🏙️ Search by city'}
          </button>
        )}
        {showManualInput && (
          <form className="manual-city-form" onSubmit={handleManualSearch}>
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder={isHi ? 'जैसे: नाशिक या Nashik' : 'e.g. Nashik'}
              autoFocus
            />
            <button type="submit" disabled={manualLoading || !cityQuery.trim()}>
              {manualLoading ? '…' : (isHi ? 'खोजें' : 'Search')}
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

  return (
    <div className="weather-card">
      <h3 className="weather-title">🌦️ {isHi ? 'मौसम सलाह' : 'Weather Advisory'}</h3>

      {/* Current conditions */}
      {current && (
        <div className="current-weather">
          <div className="current-main">
            <span className="current-temp">{current.temp}°C</span>
            <div className="current-details">
              <span>{current.description}</span>
              {(current.city || manualCity?.name) && (
                <span className="city-name">📍 {current.city || `${manualCity.name}${manualCity.state ? ', ' + manualCity.state : ''}`}</span>
              )}
            </div>
          </div>
          <div className="current-stats">
            <span>💧 {current.humidity}%</span>
            <span>🌡️ {isHi ? 'महसूस' : 'Feels'} {current.feels_like}°C</span>
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

      {/* AI Combined Crop Advisory (Phase 3 Requirement) */}
      {aiAdvice ? (
        <div className="crop-advice ai-advice">
          <h4>{isHi ? '🤖 AI फसल एवं मौसम सुझाव' : '🤖 AI Crop & Weather Advisory'}</h4>
          <p>{aiAdvice}</p>
        </div>
      ) : (
        <div className="crop-advice">
          <h4>{isHi ? '🌾 सामान्य मौसम सुझाव' : '🌾 General Weather Advice'}</h4>
          <ul>
            {getCropAdvice(current, forecast).map((tip, i) => (
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
            placeholder={isHi ? 'जैसे: नाशिक या Nashik' : 'e.g. Nashik'}
            autoFocus
          />
          <button type="submit" disabled={manualLoading || !cityQuery.trim()}>
            {manualLoading ? '…' : (isHi ? 'खोजें' : 'Search')}
          </button>
        </form>
      )}
      {manualError && weather && <small className="manual-error">{manualError}</small>}
    </div>
  );
}

/** Rule-based tips when no AI advisory is available. */
function getCropAdvice(current, forecast) {
  const tips = [];
  if (!current) return tips;

  if (current.humidity > 80) {
    tips.push('High humidity — watch for fungal outbreaks; consider preventive fungicide spray.');
  }
  if (current.wind_speed && current.wind_speed > 10) {
    tips.push('Strong winds — avoid pesticide spraying today; drift will reduce effectiveness.');
  }
  if (current.temp > 35) {
    tips.push('Heat stress likely — irrigate in the early morning or evening, not midday.');
  }
  const rainSoon = (forecast || []).slice(0, 3).some(d => d.rain_probability >= 60);
  if (rainSoon) {
    tips.push('Rain likely within 3 days — delay fertilizer/pesticide application so it is not washed away.');
  }
  if (tips.length === 0) {
    tips.push('Conditions are stable — a good window for field work and spraying.');
  }
  return tips;
}

export default WeatherAdvisory;
