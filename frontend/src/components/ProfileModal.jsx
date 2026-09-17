/**
 * ProfileModal — farmer sign-in by phone number
 *
 * Flow: farmer types their phone →
 *   • known phone  → signed in (name field hidden)
 *   • unknown phone→ the server answers 409 "name required" → the name
 *     field slides in and they register once
 *
 * The session persists in localStorage so farmers stay signed in.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { loginProfile } from '../api';
import './ProfileModal.css';

const T = {
  title: { en: 'Your profile', hi: 'आपकी प्रोफ़ाइल', mr: 'तुमचे प्रोफाइल' },
  phoneLabel: { en: 'Phone number', hi: 'मोबाइल नंबर', mr: 'मोबाईल क्रमांक' },
  phonePlaceholder: { en: '10-digit mobile number', hi: '10 अंकों का मोबाइल नंबर', mr: '१० अंकांचा मोबाईल क्रमांक' },
  nameLabel: { en: 'Your name', hi: 'आपका नाम', mr: 'तुमचे नाव' },
  namePlaceholder: { en: 'e.g. Ramesh', hi: 'जैसे: रमेश', mr: 'उदा. रमेश' },
  signIn: { en: 'Sign in', hi: 'साइन इन करें', mr: 'साइन इन करा' },
  creating: { en: 'Create profile', hi: 'प्रोफ़ाइल बनाएं', mr: 'प्रोफाइल तयार करा' },
  privacy: {
    en: 'Only your name and phone are saved — no password. History is linked to this number.',
    hi: 'केवल आपका नाम और नंबर सहेजा जाता है — कोई पासवर्ड नहीं। इतिहास इसी नंबर से जुड़ेगा।',
    mr: 'फक्त तुमचे नाव आणि क्रमांक जतन केला जातो — पासवर्ड नाही. इतिहास याच क्रमांकाशी जोडला जाईल.',
  },
  close: { en: 'Close', hi: 'बंद करें', mr: 'बंद करा' },
};

function ProfileModal({ lang, onClose, onSignedIn }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [nameRequired, setNameRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const t = (key) => T[key][lang] || T[key].en;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const profile = await loginProfile(phone.trim(), name.trim());
      onSignedIn(profile);
    } catch (err) {
      if (err.nameRequired) {
        setNameRequired(true);
        setError(err.message);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="profile-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-head">
          <h3>{t('title')}</h3>
          <button className="profile-close" onClick={onClose} aria-label={t('close')}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="profile-label" htmlFor="profile-phone">{t('phoneLabel')}</label>
          <div className="profile-phone-wrap">
            <span className="profile-phone-prefix" aria-hidden="true">+91</span>
            <input
              id="profile-phone"
              className="profile-input"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phonePlaceholder')}
              autoFocus
            />
          </div>

          {nameRequired && (
            <>
              <label className="profile-label" htmlFor="profile-name">{t('nameLabel')}</label>
              <input
                id="profile-name"
                className="profile-input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                autoFocus
              />
            </>
          )}

          {error && <p className="profile-error">{error}</p>}

          <button type="submit" className="profile-submit" disabled={phone.trim().length < 5 || loading}>
            {loading ? '…' : nameRequired ? t('creating') : t('signIn')}
          </button>

          <p className="profile-privacy">{t('privacy')}</p>
        </form>
      </div>
    </div>
  );
}

export default ProfileModal;
