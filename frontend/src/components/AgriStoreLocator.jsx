import { useState } from 'react';
import { getStores } from '../api';
import './AgriStoreLocator.css';

function AgriStoreLocator({ lang }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

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
      const result = await getStores(latitude, longitude);

      if (result.success) {
        setStores(result.stores || []);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err.message || 'Failed to locate stores');
    } finally {
      setLoading(false);
    }
  };

  const isHi = lang === 'hi';

  if (!searched) {
    return (
      <button className="store-locator-btn" onClick={findStores}>
        📍 {isHi ? 'आसपास के कृषि स्टोर खोजें' : 'Find nearby agri-stores'}
      </button>
    );
  }

  return (
    <div className="store-locator-results">
      <h5 className="store-locator-title">
        📍 {isHi ? 'नज़दीकी स्टोर' : 'Nearby Stores'}
      </h5>
      
      {loading && <div className="store-loading">{isHi ? 'खोज रहा है...' : 'Searching...'}</div>}
      
      {error && (
        <div className="store-error">
          <p>{error}</p>
          <button onClick={findStores} className="store-retry-btn">
            {isHi ? 'पुनः प्रयास करें' : 'Retry'}
          </button>
        </div>
      )}

      {!loading && !error && stores.length === 0 && (
        <div className="store-empty">
          {isHi ? 'आसपास कोई स्टोर नहीं मिला।' : 'No stores found nearby.'}
        </div>
      )}

      {!loading && !error && stores.length > 0 && (
        <ul className="store-list">
          {stores.slice(0, 3).map((store) => (
            <li key={store.id} className="store-item">
              <div className="store-name">{store.name}</div>
              <div className="store-distance">{store.distance} km {isHi ? 'दूर' : 'away'}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AgriStoreLocator;
