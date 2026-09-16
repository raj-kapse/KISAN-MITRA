/**
 * VoiceButton — Text-to-Speech read-aloud using Web Speech API
 *
 * Reads the diagnosis and treatment text aloud.
 * Respects the current language toggle (English / Hindi).
 */

import { useState, useRef } from 'react';
import './VoiceButton.css';

function VoiceButton({ diagnosis, lang = 'en' }) {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef(null);

  if (!diagnosis || !window.speechSynthesis) return null;

  /**
   * Build the text to read based on language and diagnosis data.
   */
  const buildSpeechText = () => {
    const d = diagnosis;
    const isHi = lang === 'hi';
    const parts = [];

    // Disease name
    const name = isHi ? (d.disease_name_hi || d.disease_name) : d.disease_name;
    parts.push(isHi ? `फसल का नाम: ${d.crop_type}` : `Crop type: ${d.crop_type}`);
    parts.push(isHi ? `रोग: ${name}` : `Disease: ${name}`);

    // Confidence
    const confPercent = Math.round((d.confidence || 0) * 100);
    parts.push(isHi ? `विश्वास स्तर: ${confPercent} प्रतिशत` : `Confidence: ${confPercent} percent`);

    // Description
    const desc = isHi ? (d.description_hi || d.description) : d.description;
    if (desc) parts.push(desc);

    // Treatment
    if (d.treatment && d.disease_name?.toLowerCase() !== 'healthy') {
      const t = d.treatment;
      const chem = isHi ? (t.chemical_hi || t.chemical) : t.chemical;
      const org = isHi ? (t.organic_hi || t.organic) : t.organic;
      const prev = isHi ? (t.preventive_hi || t.preventive) : t.preventive;

      if (chem) parts.push(isHi ? `रासायनिक उपचार: ${chem}` : `Chemical treatment: ${chem}`);
      if (org) parts.push(isHi ? `जैविक उपचार: ${org}` : `Organic treatment: ${org}`);
      if (prev) parts.push(isHi ? `रोकथाम: ${prev}` : `Prevention: ${prev}`);
    }

    return parts.join('. ');
  };

  const handleSpeak = () => {
    const synth = window.speechSynthesis;

    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    const text = buildSpeechText();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    utteranceRef.current = utterance;
    setSpeaking(true);
    synth.speak(utterance);
  };

  return (
    <button
      className={`voice-btn ${speaking ? 'speaking' : ''}`}
      onClick={handleSpeak}
      aria-label={speaking ? 'Stop reading' : 'Read aloud'}
    >
      {speaking ? '⏹️ Stop' : '🔊 Read Aloud'}
    </button>
  );
}

export default VoiceButton;
