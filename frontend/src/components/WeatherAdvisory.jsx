/**
 * WeatherAdvisory — Displays weather data + crop advisory
 *
 * Requests browser geolocation, calls /api/weather, shows:
 * - Current conditions (temp, humidity, wind, description)
 * - 5-day forecast cards
 * - Crop-specific guidance based on conditions
 */

import { useState, useEffect } from 'react';
import { getWeather } from '../api';
import './WeatherAdvisory.css';

/** Simple crop guidance based on weather conditions */
function getCropAdvice(current, forecast) {
  const tips = [];
  if (!current) return tips;

  if (current.humidity > 80) {
    tips.push('🍄 High humidity — monitor for fungal diseases (blight, mildew). Avoid evening irrigation.');
  }
  if (current.humidity < 40) {
    tips.push('💧 Low humidity — increase watering frequency. Mulch around plant bases to retain soil moisture.');
  }
  if (current.temp > 38) {
    tips.push('🌡️ Extreme heat — provide shade for seedlings. Water early morning or late evening.');
  }
  if (current.temp < 10) {
    tips.push('❄️ Cold conditions — cover frost-sensitive crops. Delay transplanting.');
  }

  // Check forecast for rain
  const rainyDays = (forecast || []).filter(d => d.rain_probability > 60);
  if (rainyDays.length >= 2) {
    tips.push('🌧️ Rain expected this week — delay spraying pesticides. Ensure drainage channels are clear.');
  } else if (rainyDays.length === 0 && forecast?.length > 0) {
    tips.push('☀️ No rain forecasted — plan irrigation schedule. Consider drip irrigation for water efficiency.');
  }

  if (tips.length === 0) {
    tips.push('✅ Weather looks favourable for farming. Continue routine crop maintenance.');
  }

  return tips;
}

function WeatherAdvisory({ lang = 'en' }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);

    try {
      // Request browser geolocation
      const position = await new Promise((resolve, reject) => {
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
      const result = await getWeather(latitude, longitude);

      if (result.success) {
        setWeather({ current: result.current, forecast: result.forecast });
      } else {
        throw new Error(result.error || 'Failed to fetch weather data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="weather-card loading-state">
        <span className="spinner" /> Fetching weather for your location…
      </div>
    );
  }

  if (error) {
    return (
      <div className="weather-card error-state">
        <p>🌦️ {error}</p>
        {locationDenied ? (
          <small>Enable location in your browser settings and reload.</small>
        ) : (
          <button className="retry-btn" onClick={fetchWeather}>Retry</button>
        )}
      </div>
    );
  }

  if (!weather) return null;

  const { current, forecast } = weather;
  const advice = getCropAdvice(current, forecast);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="weather-card">
      <h3 className="weather-title">🌦️ {lang === 'hi' ? 'मौसम सलाह' : 'Weather Advisory'}</h3>

      {/* Current conditions */}
      {current && (
        <div className="current-weather">
          <div className="current-main">
            <span className="current-temp">{current.temp}°C</span>
            <div className="current-details">
              <span>{current.description}</span>
              {current.city && <span className="city-name">📍 {current.city}</span>}
            </div>
          </div>
          <div className="current-stats">
            <span>💧 {current.humidity}%</span>
            <span>🌡️ Feels {current.feels_like}°C</span>
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

      {/* Crop advisory */}
      <div className="crop-advice">
        <h4>{lang === 'hi' ? '🌾 फसल सुझाव' : '🌾 Crop Advice'}</h4>
        <ul>
          {advice.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default WeatherAdvisory;
