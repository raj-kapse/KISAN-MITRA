/**
 * Weather Service — Kisan Mitra
 *
 * Provider failover for live weather data:
 *   1. OpenWeatherMap (primary, keyed) — richer current conditions
 *   2. Open-Meteo (fallback, KEYLESS) — free, no quota, real data
 *
 * Design note: an LLM (Qwen/Gemini) can never be a weather *data* backup —
 * it would confidently hallucinate temperatures. The AI layer (Qwen) is
 * only used for *advice about* the data, which is already failover-safe
 * via services/textProvider.js. This service guarantees the data itself.
 *
 * Both providers are normalised to the response contract the frontend
 * has always consumed:
 *   current:  { temp, feels_like, humidity, description, wind_speed(m/s), city }
 *   forecast: [{ date, temp_min, temp_max, humidity, description,
 *                rain_probability(0-100), wind_speed(m/s)|null }]
 */

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

/** WMO weather interpretation codes → human description (Open-Meteo). */
function wmoDescription(code) {
  const map = {
    0: 'clear sky',
    1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast clouds',
    45: 'fog', 48: 'depositing rime fog',
    51: 'light drizzle', 53: 'moderate drizzle', 55: 'dense drizzle',
    56: 'light freezing drizzle', 57: 'dense freezing drizzle',
    61: 'light rain', 63: 'moderate rain', 65: 'heavy rain',
    66: 'light freezing rain', 67: 'heavy freezing rain',
    71: 'light snow', 73: 'moderate snow', 75: 'heavy snow', 77: 'snow grains',
    80: 'light showers', 81: 'moderate showers', 82: 'violent showers',
    85: 'light snow showers', 86: 'heavy snow showers',
    95: 'thunderstorm', 96: 'thunderstorm with light hail', 99: 'thunderstorm with heavy hail',
  };
  return map[code] || 'mixed conditions';
}

/** Normalised success shape used by every provider. */
function normalise(current, forecast) {
  return { current, forecast };
}

/* ---------------- Provider 1: OpenWeatherMap (primary) ---------------- */

async function fetchFromOpenWeather(lat, lon, apiKey) {
  const query = `lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${OWM_BASE}/weather?${query}`),
    fetch(`${OWM_BASE}/forecast?${query}`),
  ]);

  if (currentRes.status === 401 || forecastRes.status === 401) {
    const err = new Error('OpenWeatherMap rejected the API key (401).');
    err.code = 'PROVIDER_AUTH';
    throw err;
  }
  if (!currentRes.ok || !forecastRes.ok) {
    const err = new Error(`OpenWeatherMap error: current=${currentRes.status} forecast=${forecastRes.status}`);
    err.code = 'PROVIDER_DOWN';
    throw err;
  }

  const current = await currentRes.json();
  const forecastRaw = await forecastRes.json();

  // Forecast returns 3-hour chunks. Aggregate ALL of a day's chunks:
  // a single chunk's temp_min/temp_max mirror that instant, so keeping
  // only the first chunk produced forecasts like "23–23°" for every day.
  const byDay = new Map();
  for (const item of forecastRaw.list || []) {
    const date = item.dt_txt.split(' ')[0];
    if (!byDay.has(date)) byDay.set(date, []);
    byDay.get(date).push(item);
  }

  const forecast = Array.from(byDay.entries())
    .slice(0, 5)
    .map(([date, items]) => {
      const midday =
        items.find((i) => i.dt_txt.includes('12:00:00')) ||
        items[Math.floor(items.length / 2)];
      const winds = items.map((i) => i.wind?.speed).filter((w) => w != null);
      return {
        date,
        temp_min: Math.round(Math.min(...items.map((i) => i.main.temp_min))),
        temp_max: Math.round(Math.max(...items.map((i) => i.main.temp_max))),
        humidity: Math.round(items.reduce((s, i) => s + i.main.humidity, 0) / items.length),
        description: midday?.weather?.[0]?.description || '',
        rain_probability: Math.max(...items.map((i) => Math.round((i.pop || 0) * 100))),
        wind_speed: winds.length ? Math.max(...winds) : null,
      };
    });

  return normalise(
    {
      temp: Math.round(current.main.temp),
      feels_like: Math.round(current.main.feels_like),
      humidity: current.main.humidity,
      description: current.weather?.[0]?.description || '',
      wind_speed: current.wind?.speed ?? null,
      city: current.name || null,
      provider: 'openweathermap',
    },
    forecast
  );
}

/* ---------------- Provider 2: Open-Meteo (keyless fallback) ---------------- */

async function fetchFromOpenMeteo(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max,relative_humidity_2m_mean',
    timezone: 'auto',
    forecast_days: '6',
  });

  const res = await fetch(`${OPEN_METEO_BASE}?${params}`);
  if (!res.ok) {
    const err = new Error(`Open-Meteo error: ${res.status}`);
    err.code = 'PROVIDER_DOWN';
    throw err;
  }

  const data = await res.json();
  const c = data.current || {};
  const d = data.daily || {};

  const forecast = (d.time || [])
    .slice(1, 6) // today often partial — next 5 full days
    .map((date, i) => ({
      date,
      temp_min: Math.round(d.temperature_2m_min?.[i + 1] ?? 0),
      temp_max: Math.round(d.temperature_2m_max?.[i + 1] ?? 0),
      humidity: d.relative_humidity_2m_mean?.[i + 1] != null
        ? Math.round(d.relative_humidity_2m_mean[i + 1])
        : null,
      description: wmoDescription(d.weather_code?.[i + 1]),
      rain_probability: d.precipitation_probability_max?.[i + 1] ?? 0,
      wind_speed: d.wind_speed_10m_max?.[i + 1] != null
        ? Math.round((d.wind_speed_10m_max[i + 1] / 3.6) * 10) / 10 // km/h → m/s
        : null,
    }));

  return normalise(
    {
      temp: Math.round(c.temperature_2m),
      feels_like: Math.round(c.apparent_temperature ?? c.temperature_2m),
      humidity: c.relative_humidity_2m != null ? Math.round(c.relative_humidity_2m) : null,
      description: wmoDescription(c.weather_code),
      wind_speed: c.wind_speed_10m != null
        ? Math.round((c.wind_speed_10m / 3.6) * 10) / 10 // km/h → m/s
        : null,
      city: null, // Open-Meteo is coordinate-only; geocoding supplies names
      provider: 'open-meteo',
    },
    forecast
  );
}

/* ---------------- Public API ---------------- */

/**
 * Fetch current + 5-day forecast with provider failover.
 * Tries OpenWeatherMap first (when a key exists), then Open-Meteo.
 * @returns {{current: Object, forecast: Array, provider: string}}
 */
async function getWeatherWithFallback(lat, lon) {
  const errors = [];

  if (process.env.OPENWEATHER_API_KEY) {
    try {
      const result = await fetchFromOpenWeather(lat, lon, process.env.OPENWEATHER_API_KEY);
      return { ...result, provider: 'openweathermap' };
    } catch (err) {
      console.warn(`⚠️ weather [openweathermap] failed: ${err.message} — falling back to Open-Meteo`);
      errors.push(err);
    }
  } else {
    errors.push(new Error('OPENWEATHER_API_KEY not set'));
  }

  try {
    const result = await fetchFromOpenMeteo(lat, lon);
    return { ...result, provider: 'open-meteo' };
  } catch (err) {
    console.error(`❌ weather [open-meteo] failed: ${err.message}`);
    errors.push(err);
  }

  throw errors[errors.length - 1];
}

/**
 * Resolve a city name to coordinates with failover:
 * OpenWeatherMap geocoding → Open-Meteo geocoding (keyless).
 * @returns {{name, state, country, lat, lon, provider}}
 */
async function geocodeWithFallback(query, apiKey) {
  if (apiKey) {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`
      );
      if (res.ok) {
        const results = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          const hit = results[0];
          return {
            name: hit.name,
            state: hit.state || null,
            country: hit.country || null,
            lat: hit.lat,
            lon: hit.lon,
            provider: 'openweathermap',
          };
        }
        const err = new Error('city not found in OpenWeatherMap geocoder');
        err.code = 'NOT_FOUND'; // M1: coded errors — message matching is brittle
        throw err;
      }
      console.warn(`⚠️ geocode [openweathermap] failed: ${res.status} — falling back to Open-Meteo`);
    } catch (err) {
      if (err.code !== 'NOT_FOUND') {
        console.warn(`⚠️ geocode [openweathermap] failed: ${err.message} — falling back to Open-Meteo`);
      }
    }
  }

  // Keyless fallback
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en`
  );
  if (!res.ok) throw new Error(`Open-Meteo geocoding error: ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data.results) || data.results.length === 0) {
    const err = new Error(`No location found for "${query}". Check the spelling or try a nearby larger town.`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  const hit = data.results[0];
  return {
    name: hit.name,
    state: hit.admin1 || null,
    country: hit.country_code || null,
    lat: hit.latitude,
    lon: hit.longitude,
    provider: 'open-meteo',
  };
}

module.exports = { getWeatherWithFallback, geocodeWithFallback };
