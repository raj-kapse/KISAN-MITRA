import { useState } from 'react';
import { getStores, geocodeCity } from '../api';
import './AgriStoreLocator.css';

/**
 * AgriStoreLocator — finds nearby agricultural supply stores.
 *
 * Two ways to locate the farmer:
 *   1. Browser geolocation (preferred, most accurate)
 *   2. City-name search via /api/geocode — used when geolocation is denied
 *      or unavailable (previously the panel dead-ended with an error)
 */
function AgriStoreLocator({ lang }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityLoading, setCityLoading] = useState(false);
  const [showCityInput, setShowCityInput] = useState(false);

  const L = {
    find: { en: 'Find nearby agri-stores', hi: 'आसपास के कृषि स्टोर खोजें', mr: 'जवळील कृषी दुकाने शोधा' },
    title: { en: 'Nearby Stores', hi: 'नज़दीकी स्टोर', mr: 'जवळील दुकाने' },
    searching: { en: 'Searching...', hi: 'खोज रहा है...', mr: 'शोधत आहे...' },
    retry: { en: 'Retry', hi: 'पुनः प्रयास करें', mr: 'पुन्हा प्रयत्न करा' },
    citySearch: { en: '🏙️ Search by city', hi: '🏙️ शहर खोजें', mr: '🏙️ शहर शोधा' },
    cityPlaceholder: { en: 'e.g. Nashik', hi: 'जैसे: नाशिक', mr: 'उदा. नाशिक' },
    search: { en: 'Search', hi: 'खोजें', mr: 'शोधा' },
    none: { en: 'No stores found nearby.', hi: 'आसपास कोई स्टोर नहीं मिला।', mr: 'जवळ एकही दुकान सापडली नाही.' },
    away: { en: 'away', hi: 'दूर', mr: 'अंतरावर' },
  }[lang] || {};

  const fetchStores = async (lat, lon) => {
    const result = await getStores(lat, lon);
    if (result.success) {
      setStores(result.stores || []);
    } else {
      throw new Error(result.error);
    }
  };

  const findStores = async () => {
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });

      const { latitude, longitude } = position.coords;
      await fetchStores(latitude, longitude);
    } catch (err) {
      // Geolocation failed — offer the city search instead of a dead end
      setError(err.message || 'Failed to locate stores');
      setShowCityInput(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCitySearch = async (e) => {
    e.preventDefault();
    const q = cityQuery.trim();
    if (!q || cityLoading) return;

    setCityLoading(true);
    setError(null);
    setSearched(true);
    try {
      const loc = await geocodeCity(q);
      await fetchStores(loc.lat, loc.lon);
      setShowCityInput(false);
      setCityQuery('');
    } catch (err) {
      setError(err.message || 'Could not find stores for that city');
    } finally {
      setCityLoading(false);
    }
  };

  if (!searched) {
    return (
      <div className="store-locator-start">
        <button className="store-locator-btn" onClick={findStores}>
          📍 {L.find}
        </button>
      </div>
    );
  }

  const busy = loading || cityLoading;

  return (
    <div className="store-locator-results">
      <h5 className="store-locator-title">
        📍 {L.title}
      </h5>

      {busy && <div className="store-loading">{L.searching}</div>}

      {error && !busy && (
        <div className="store-error">
          <p>{error}</p>
          <button onClick={findStores} className="store-retry-btn">
            {L.retry}
          </button>
        </div>
      )}

      {!busy && !error && stores.length === 0 && (
        <div className="store-empty">{L.none}</div>
      )}

      {!busy && stores.length > 0 && (
        <ul className="store-list">
          {stores.slice(0, 3).map((store) => (
            <li key={store.id} className="store-item">
              <div className="store-name">{store.name}</div>
              <div className="store-distance">{Number(store.distance).toFixed(1)} km {L.away}</div>
            </li>
          ))}
        </ul>
      )}

      {!busy && (
        showCityInput ? (
          <form className="store-city-form" onSubmit={handleCitySearch}>
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder={L.cityPlaceholder}
            />
            <button type="submit" disabled={!cityQuery.trim()}>
              {L.search}
            </button>
          </form>
        ) : (
          <button
            className="store-retry-btn store-city-toggle"
            onClick={() => setShowCityInput(true)}
          >
            {L.citySearch}
          </button>
        )
      )}
    </div>
  );
}

export default AgriStoreLocator;
