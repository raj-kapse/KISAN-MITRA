/**
 * OfflineBanner — fixed top strip shown while the device is offline.
 * Listens to window online/offline events; renders nothing when online.
 */

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import './OfflineBanner.css';

const T = {
  message: {
    en: 'You are offline — saved scans are available, scanning needs internet.',
    hi: 'आप ऑफ़लाइन हैं — सहेजे स्कैन उपलब्ध हैं, स्कैन के लिए इंटरनेट चाहिए।',
    mr: 'तुम्ही ऑफलाइन आहात — जतन केलेले स्कॅन उपलब्ध आहेत, स्कॅनसाठी इंटरनेट लागतो.',
  },
};

function OfflineBanner({ lang = 'en' }) {
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner no-print" role="alert">
      <WifiOff size={16} aria-hidden="true" />
      <span>{T.message[lang] || T.message.en}</span>
    </div>
  );
}

export default OfflineBanner;
