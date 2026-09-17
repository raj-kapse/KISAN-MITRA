/**
 * ScanHistory — past diagnosis history view
 *
 * White cards with a severity-colored left border, Lucide icons,
 * a mini confidence ring, and localized relative timestamps
 * (Intl.RelativeTimeFormat). Retry uses a stable callback.
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Sprout, AlertTriangle, RefreshCw } from 'lucide-react';
import { getHistory } from '../api';
import './ScanHistory.css';

const T = {
  title: { en: 'Scan History', hi: 'स्कैन इतिहास', mr: 'स्कॅन इतिहास' },
  back: { en: 'Back', hi: 'वापस', mr: 'मागे' },
  retry: { en: 'Retry', hi: 'पुनः प्रयास करें', mr: 'पुन्हा प्रयत्न करा' },
  empty: {
    en: 'No scans yet. Scan your first crop!',
    hi: 'अभी तक कोई स्कैन नहीं। अपनी पहली फसल स्कैन करें!',
    mr: 'अजून स्कॅन नाही. तुमचे पहिले पीक स्कॅन करा!',
  },
  healthy: { en: 'Healthy', hi: 'स्वस्थ', mr: 'निरोगी' },
  unknown: { en: 'Unknown', hi: 'अज्ञात', mr: 'अज्ञात' },
  mine: { en: 'Mine', hi: 'मेरे', mr: 'माझे' },
  device: { en: 'This device', hi: 'यह डिवाइस', mr: 'हे डिव्हाइस' },
};

/** Localized relative time — "3 hr ago" / "3 घंटे पहले" / "3 तासांपूर्वी" */
function relativeTime(iso, locale) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((then - Date.now()) / 1000);

  const units = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diffSec) >= secs) {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
        .format(Math.round(diffSec / secs), unit);
    }
  }
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diffSec, 'second');
}

/** Mini SVG confidence ring (compact, no label). */
function MiniRing({ percent, tier }) {
  const RADIUS = 13;
  const CIRC = 2 * Math.PI * RADIUS;
  const offset = CIRC * (1 - Math.min(Math.max(percent, 0), 100) / 100);
  return (
    <span className={`mini-ring mini-ring-${tier}`} aria-label={`${percent}%`}>
      <svg viewBox="0 0 34 34" width="34" height="34">
        <circle className="mini-ring-track" cx="17" cy="17" r={RADIUS} fill="none" strokeWidth="3.5" />
        <circle
          className="mini-ring-fill"
          cx="17" cy="17" r={RADIUS} fill="none" strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          transform="rotate(-90 17 17)"
        />
        <text className="mini-ring-num" x="17" y="21" textAnchor="middle">{percent}</text>
      </svg>
    </span>
  );
}

function ScanHistory({ lang = 'en', onBack, profile = null, onOpenScan }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const t = (key) => T[key][lang] || T[key].en;
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getHistory(20, profile);
      if (result.success) {
        setScans(result.scans || []);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to load history');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load, retryCount]);

  return (
    <div className="history-view animate-slide-up">
      <div className="history-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" /> {t('back')}
        </button>
        <h2>{t('title')}</h2>
        {profile && (
          <span className="scope-chip" title={profile.name}>
            {t('mine')}
          </span>
        )}
      </div>

      {loading && (
        <ul className="history-list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="history-skel glass-panel">
              <div className="skeleton history-skel-icon" />
              <div className="history-skel-col">
                <div className="skeleton history-skel-line" />
                <div className="skeleton history-skel-line short" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="history-error glass-panel" role="alert">
          <p>{error}</p>
          <button className="retry-btn" onClick={() => setRetryCount((c) => c + 1)}>
            <RefreshCw size={15} aria-hidden="true" /> {t('retry')}
          </button>
        </div>
      )}

      {!loading && !error && scans.length === 0 && (
        <div className="history-empty glass-panel">
          <SproutSvgLarge />
          <p>{t('empty')}</p>
        </div>
      )}

      {!loading && scans.length > 0 && (
        <ul className="history-list">
          {scans.map((scan) => {
            const d = scan.diagnosis || {};
            const confPercent = Math.round((d.confidence || 0) * 100);
            const name = pickDiseaseName(d, lang);
            const isHealthy = d.disease_name?.toLowerCase() === 'healthy';
            const tier = confPercent >= 80 ? 'high' : confPercent >= 50 ? 'medium' : 'low';
            const when = relativeTime(scan.createdAt || scan.timestamp, locale);

            return (
              <li key={scan.id}>
                <button
                  type="button"
                  className={`history-item glass-panel ${isHealthy ? 'healthy' : 'diseased'}`}
                  onClick={() => onOpenScan?.(scan)}
                >
                  <span className={`history-item-icon ${isHealthy ? 'healthy' : 'diseased'}`} aria-hidden="true">
                    {isHealthy ? <Sprout size={20} /> : <AlertTriangle size={20} />}
                  </span>
                  <span className="history-item-text">
                    <span className="history-disease">{isHealthy ? t('healthy') : (name || t('unknown'))}</span>
                    <span className="history-crop">
                      {d.crop_type || ''}
                      {when ? ` · ${when}` : ''}
                    </span>
                  </span>
                  <MiniRing percent={confPercent} tier={tier} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// BUG 7: per-language name picker — Marathi falls back mr → hi → en,
// Hindi falls back hi → en, English uses the base name.
function pickDiseaseName(d, lang) {
  if (lang === 'hi') return d.disease_name_hi || d.disease_name;
  if (lang === 'mr') return d.disease_name_mr || d.disease_name_hi || d.disease_name;
  return d.disease_name;
}

function SproutSvgLarge() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <circle cx="32" cy="22" r="8" fill="#F2C14E" opacity="0.85" />
      <path d="M32 52 V28" stroke="#8FD19E" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 40 C 25 38 21 33 21 27 C 27 28 31 32 32 40 Z" fill="#8FD19E" />
      <path d="M32 36 C 39 34 43 29 43 24 C 37 25 32.5 29 32 36 Z" fill="#C8E6C9" />
    </svg>
  );
}

export default ScanHistory;
