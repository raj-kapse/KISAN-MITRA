/**
 * ScanHistory — Past diagnosis history view
 *
 * Fetches scan history from /api/history and displays a list of past diagnoses.
 * Each entry shows: crop type, disease name, confidence, and timestamp.
 */

import { useState, useEffect } from 'react';
import { getHistory } from '../api';
import './ScanHistory.css';

function ScanHistory({ lang = 'en', onBack }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const result = await getHistory();
      if (result.success) {
        setScans(result.scans || []);
      } else {
        throw new Error(result.error || 'Failed to load history');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isHi = lang === 'hi';

  return (
    <div className="history-view">
      <div className="history-header">
        <button className="back-btn" onClick={onBack}>← {isHi ? 'वापस' : 'Back'}</button>
        <h2>{isHi ? '📜 स्कैन इतिहास' : '📜 Scan History'}</h2>
      </div>

      {loading && (
        <div className="history-loading">
          <span className="spinner" /> {isHi ? 'लोड हो रहा है...' : 'Loading...'}
        </div>
      )}

      {error && (
        <div className="history-error">
          <p>{error}</p>
          <button className="retry-btn" onClick={fetchHistory}>
            {isHi ? 'पुनः प्रयास करें' : 'Retry'}
          </button>
        </div>
      )}

      {!loading && !error && scans.length === 0 && (
        <div className="history-empty">
          <span className="empty-icon">📋</span>
          <p>{isHi ? 'अभी तक कोई स्कैन नहीं। अपनी पहली फसल स्कैन करें!' : 'No scans yet. Scan your first crop!'}</p>
        </div>
      )}

      {!loading && scans.length > 0 && (
        <ul className="history-list">
          {scans.map((scan) => {
            const d = scan.diagnosis || {};
            const confPercent = Math.round((d.confidence || 0) * 100);
            const name = isHi ? (d.disease_name_hi || d.disease_name) : d.disease_name;
            const isHealthy = d.disease_name?.toLowerCase() === 'healthy';
            const dateStr = scan.createdAt
              ? new Date(scan.createdAt).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
              : scan.timestamp
              ? new Date(scan.timestamp).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })
              : '';

            return (
              <li key={scan.id} className={`history-item ${isHealthy ? 'healthy' : 'diseased'}`}>
                <div className="history-item-main">
                  <span className="history-emoji">{isHealthy ? '✅' : '🔬'}</span>
                  <div className="history-item-text">
                    <span className="history-disease">{name || 'Unknown'}</span>
                    <span className="history-crop">{d.crop_type || 'Unknown crop'}</span>
                  </div>
                  <span className={`history-conf ${confPercent >= 80 ? 'high' : confPercent >= 50 ? 'medium' : 'low'}`}>
                    {confPercent}%
                  </span>
                </div>
                {dateStr && <span className="history-date">{dateStr}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ScanHistory;
