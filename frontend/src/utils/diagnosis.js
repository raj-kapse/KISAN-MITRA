/**
 * Shared diagnosis formatting helpers.
 *
 * Home, ScanHistory and the result view all need the same answers to "which
 * language's disease name?", "how long ago?", "which confidence tier?" and
 * "what severity colour?" — so the logic lives here once.
 */

/**
 * Per-language disease name: Marathi falls back mr → hi → en, Hindi hi → en,
 * English uses the base name.
 */
export function pickDiseaseName(d = {}, lang = 'en') {
  if (lang === 'hi') return d.disease_name_hi || d.disease_name;
  if (lang === 'mr') return d.disease_name_mr || d.disease_name_hi || d.disease_name;
  return d.disease_name;
}

/** Localized relative time — "3 hr ago" / "3 घंटे पहले" / "3 तासांपूर्वी". */
export function relativeTime(iso, locale) {
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

/** Confidence tier → the stroke colour used by the mini rings. */
export function confidenceTier(percent) {
  return percent >= 80 ? 'high' : percent >= 50 ? 'medium' : 'low';
}

/** A healthy leaf is the only "good news" outcome. */
export function isHealthyScan(d = {}) {
  return (d.disease_name || '').toLowerCase() === 'healthy';
}

/**
 * Severity tone for status colours: healthy | moderate | severe.
 * An unrecognised severity is treated as moderate (never silently "healthy").
 */
export function severityTone(d = {}) {
  if (isHealthyScan(d)) return 'healthy';
  return (d.severity || '').toLowerCase() === 'severe' ? 'severe' : 'moderate';
}
