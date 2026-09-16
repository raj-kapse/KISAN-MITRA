/**
 * WeatherAdvisory — Displays weather data + crop advisory
 *
 * Requests browser geolocation, calls /api/weather, shows:
 * - Current conditions (temp, humidity, wind, description)
 * - 5-day forecast cards
 * - Crop-specific guidance based on conditions
 */

import { useState, useEffect } from 'react';
import { getWeather, getAiWeatherAdvisory } from '../api';
import './WeatherAdvisory.css';

function WeatherAdvisory({ lang = 'en', diagnosis }) {
  const [weather, setWeather] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    fetchWeatherAndAdvice();
  }, [diagnosis]);

  const fetchWeatherAndAdvice = async () => {
    setLoading(true);
    setError(null);
    setAiAdvice(null);

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
          <button className="retry-btn" onClick={fetchWeatherAndAdvice}>Retry</button>
        )}
      </div>
    );
  }

  if (!weather) return null;

  const { current, forecast } = weather;
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

      {/* AI Combined Crop Advisory (Phase 3 Requirement) */}
      {aiAdvice ? (
        <div className="crop-advice ai-advice">
          <h4>{lang === 'hi' ? '🤖 AI फसल एवं मौसम सुझाव' : '🤖 AI Crop & Weather Advisory'}</h4>
          <p>{aiAdvice}</p>
        </div>
      ) : (
        <div className="crop-advice">
          <h4>{lang === 'hi' ? '🌾 सामान्य मौसम सुझाव' : '🌾 General Weather Advice'}</h4>
          <ul>
            {getCropAdvice(current, forecast).map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default WeatherAdvisory;
