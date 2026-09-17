import { useState } from 'react';
import { MapPin, Building2 } from 'lucide-react';
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

  const RAW_L = {
    find: { en: 'Find nearby agri-stores', hi: 'आसपास के कृषि स्टोर खोजें', mr: 'जवळील कृषी दुकाने शोधा' },
    title: { en: 'Nearby Stores', hi: 'नज़दीकी स्टोर', mr: 'जवळील दुकाने' },
    searching: { en: 'Searching...', hi: 'खोज रहा है...', mr: 'शोधत आहे...' },
    retry: { en: 'Retry', hi: 'पुनः प्रयास करें', mr: 'पुन्हा प्रयत्न करा' },
    citySearch: { en: 'Search by city', hi: 'शहर खोजें', mr: 'शहर शोधा' },
    cityPlaceholder: { en: 'e.g. Nashik', hi: 'जैसे: नाशिक', mr: 'उदा. नाशिक' },
    search: { en: 'Search', hi: 'खोजें', mr: 'शोधा' },
    none: { en: 'No stores found nearby.', hi: 'आसपास कोई स्टोर नहीं मिला।', mr: 'जवळ एकही दुकान सापडली नाही.' },
    away: { en: 'away', hi: 'दूर', mr: 'अंतरावर' },
    geoUnsupported: { en: 'Location not supported — search your city below.', hi: 'लोकेशन समर्थित नहीं — नीचे अपना शहर खोजें।', mr: 'स्थान समर्थित नाही — खाली तुमचे शहर शोधा.' },
    geoDenied: { en: 'Location permission is off — search your city below.', hi: 'लोकेशन की अनुमति बंद है — नीचे अपना शहर खोजें।', mr: 'स्थानाची परवानगी बंद आहे — खाली तुमचे शहर शोधा.' },
    geoFailed: { en: 'Could not get your location — search your city below.', hi: 'आपकी लोकेशन नहीं मिली — नीचे अपना शहर खोजें।', mr: 'तुमचे स्थान मिळाले नाही — खाली तुमचे शहर शोधा.' },
    cityFailed: { en: 'Could not find stores for that city — try a larger nearby town.', hi: 'इस शहर के लिए स्टोर नहीं मिले — पास के बड़े शहर को आज़माएँ।', mr: 'या शहरासाठी दुकाने सापडली नाहीत — जवळचे मोठे शहर वापरा.' },
    genericFailed: { en: 'Failed to locate stores — try again.', hi: 'स्टोर खोजने में समस्या — फिर से कोशिश करें।', mr: 'दुकाने शोधण्यात समस्या — पुन्हा प्रयत्न करा.' },
  };
  const L = {};
  for (const k in RAW_L) L[k] = RAW_L[k][lang] || RAW_L[k].en;

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
          const err = new Error('geoUnsupported');
          err.code = 'GEO_UNSUPPORTED';
          reject(err);
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, (geoErr) => {
          const err = new Error(
            geoErr.code === 1 ? 'geoDenied' : 'geoFailed'
          );
          err.code = geoErr.code === 1 ? 'GEO_DENIED' : 'GEO_FAILED';
          reject(err);
        }, { timeout: 10000 });
      });

      const { latitude, longitude } = position.coords;
      await fetchStores(latitude, longitude);
    } catch (err) {
      // Geolocation failed — offer the city search instead of a dead end.
      // Show the trilingual message for the failure reason (BUG 5).
      const key = ['GEO_UNSUPPORTED', 'GEO_DENIED', 'GEO_FAILED'].includes(err.code)
        ? err.code === 'GEO_UNSUPPORTED' ? 'geoUnsupported'
        : err.code === 'GEO_DENIED' ? 'geoDenied'
        : 'geoFailed'
        : 'genericFailed';
      setError(L[key] || L.genericFailed);
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
    } catch {
      setError(L.cityFailed); // trilingual generic, not the raw English provider error
    } finally {
      setCityLoading(false);
    }
  };

  if (!searched) {
    return (
      <div className="store-locator-start">
        <button className="store-locator-btn" onClick={findStores}>
          <MapPin size={15} aria-hidden="true" /> {L.find}
        </button>
      </div>
    );
  }

  const busy = loading || cityLoading;

  return (
    <div className="store-locator-results">
      <h5 className="store-locator-title">
        <MapPin size={14} aria-hidden="true" /> {L.title}
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
            <Building2 size={14} aria-hidden="true" /> {L.citySearch}
          </button>
        )
      )}
    </div>
  );
}

export default AgriStoreLocator;
