/**
 * ConfirmDialog — trilingual confirmation for destructive-ish actions
 * (sign-out). Centered modal over an overlay; Cancel is the safe default.
 */

import { AlertTriangle } from 'lucide-react';
import './ConfirmDialog.css';

const T = {
  title: {
    en: 'Sign out of Kisan Mitra?',
    hi: 'किसान मित्र से साइन आउट करें?',
    mr: 'शेतकरी मित्रमधून साइन आउट करायचे?',
  },
  body: {
    en: 'Your history stays linked to this phone.',
    hi: 'आपका इतिहास इसी फ़ोन से जुड़ा रहेगा।',
    mr: 'तुमचा इतिहास याच फोनशी जोडलेला राहील.',
  },
  cancel: { en: 'Cancel', hi: 'रद्द करें', mr: 'रद्द करा' },
  confirm: { en: 'Sign out', hi: 'साइन आउट', mr: 'साइन आउट' },
};

function ConfirmDialog({ lang = 'en', onConfirm, onCancel }) {
  const t = (key) => T[key][lang] || T[key].en;

  return (
    <div
      className="confirm-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
    >
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <span className="confirm-icon" aria-hidden="true">
          <AlertTriangle size={22} />
        </span>
        <h3 className="confirm-title">{t('title')}</h3>
        <p className="confirm-body">{t('body')}</p>
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button type="button" className="confirm-accept" onClick={onConfirm}>
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
