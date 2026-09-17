/**
 * VoiceButton — Text-to-Speech read-aloud
 *
 * Two-tier speech:
 *   1. Browser Web Speech API (instant, no server cost) — when the device
 *      actually has voices for the target language
 *   2. Backend Gemini TTS fallback (/api/tts → WAV) — used when the browser
 *      has no voices (common on Linux/Android Chrome) so "Read Aloud" never
 *      silently fails
 *
 * Reads the diagnosis and treatment text aloud. Respects the current
 * language toggle (English / Hindi / Marathi).
 */

import { useState, useRef, useEffect } from 'react';
import { speakViaServer } from '../api';
import './VoiceButton.css';

const LANG_TAGS = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

function VoiceButton({ diagnosis, lang = 'en' }) {
  const [speaking, setSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const cancelledRef = useRef(false);

  // Stop any playback and release the audio blob when the language changes
  // or the component unmounts.
  useEffect(() => () => {
    cancelledRef.current = true;
    window.speechSynthesis?.cancel();
    if (audioRef.current) audioRef.current.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, [lang]);

  // Render whenever there's a diagnosis (C5). The browser-speech capability
  // is checked inside the handler — hiding the button here would make the
  // server-TTS fallback unreachable on voice-less browsers.
  if (!diagnosis) return null;

  /** Does the browser have any voice for this language (or a close match)? */
  const hasVoicesFor = (tag) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return false;
    const base = tag.split('-')[0];
    return voices.some((v) => v.lang.toLowerCase().startsWith(base));
  };

  /**
   * Build the text to read based on language and diagnosis data.
   */
  const buildSpeechText = () => {
    const d = diagnosis;
    const labels = {
      en: { crop: 'Crop type', disease: 'Disease', conf: 'Confidence', chem: 'Chemical treatment', org: 'Organic treatment', prev: 'Prevention' },
      hi: { crop: 'फसल का नाम', disease: 'रोग', conf: 'विश्वास स्तर', chem: 'रासायनिक उपचार', org: 'जैविक उपचार', prev: 'रोकथाम' },
      mr: { crop: 'पीक', disease: 'रोग', conf: 'विश्वास', chem: 'रासायनिक उपचार', org: 'सेंद्रिय उपचार', prev: 'प्रतिबंध' },
    };
    const L = labels[lang] || labels.en;
    const pick = (en, hi, mr) => (lang === 'hi' ? (hi || en) : lang === 'mr' ? (mr || hi || en) : en);

    const parts = [];
    const name = pick(d.disease_name, d.disease_name_hi, d.disease_name_mr);
    parts.push(`${L.crop}: ${d.crop_type}`);
    parts.push(`${L.disease}: ${name}`);

    const confPercent = Math.round((d.confidence || 0) * 100);
    parts.push(`${L.conf}: ${confPercent} ${lang === 'en' ? 'percent' : 'प्रतिशत'}`);

    const desc = pick(d.description, d.description_hi, d.description_mr);
    if (desc) parts.push(desc);

    if (d.treatment && d.disease_name?.toLowerCase() !== 'healthy') {
      const t = d.treatment;
      const chem = pick(t.chemical, t.chemical_hi, t.chemical_mr);
      const org = pick(t.organic, t.organic_hi, t.organic_mr);
      const prev = pick(t.preventive, t.preventive_hi, t.preventive_mr);
      if (chem) parts.push(`${L.chem}: ${chem}`);
      if (org) parts.push(`${L.org}: ${org}`);
      if (prev) parts.push(`${L.prev}: ${prev}`);
    }

    return parts.join('. ');
  };

  const stopAll = () => {
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setSpeaking(false);
  };

  const handleSpeak = async () => {
    const synth = window.speechSynthesis;

    if (speaking) {
      stopAll();
      return;
    }

    setTtsError(null);
    const text = buildSpeechText();
    const tag = LANG_TAGS[lang] || 'en-IN';

    // Tier 1: browser voices (instant, free). The voices list can load
    // asynchronously in Chrome, so a zero-length list is treated as
    // "unavailable" and we fall back rather than queueing into silence.
    if (hasVoicesFor(tag)) {
      cancelledRef.current = false;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = tag;
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synth.speak(utterance);
      return;
    }

    // Tier 2: backend Gemini TTS → WAV blob
    setSpeaking(true);
    cancelledRef.current = false;
    try {
      const blob = await speakViaServer(text, lang);
      if (cancelledRef.current) return; // stopped while generating

      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        urlRef.current = null;
        setSpeaking(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        urlRef.current = null;
        setSpeaking(false);
        setTtsError(lang === 'en' ? 'Could not play the audio.' : 'आवाज़ चलाने में समस्या।');
      };
      await audio.play();
    } catch (err) {
      setSpeaking(false);
      setTtsError(err.message || 'Speech unavailable.');
    }
  };

  return (
    <div className="voice-btn-wrap">
      <button
        className={`voice-btn ${speaking ? 'speaking' : ''}`}
        onClick={handleSpeak}
        aria-label={speaking ? 'Stop reading' : 'Read aloud'}
      >
        {speaking ? '⏹️ Stop' : '🔊 Read Aloud'}
      </button>
      {ttsError && <small className="voice-error">{ttsError}</small>}
    </div>
  );
}

export default VoiceButton;
