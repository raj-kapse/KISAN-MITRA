import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Mic, Send, Square } from 'lucide-react';
import './Chatbot.css';
import { API_BASE, speakViaServer } from '../api';

/**
 * Transcribe a recorded audio Blob via /api/transcribe (Groq Whisper).
 * Returns { text } or throws with a user-safe message.
 */
async function transcribeAudio(blob) {
  const form = new FormData();
  form.append('audio', blob, `recording.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);

  const res = await fetch(`${API_BASE}/api/transcribe`, { method: 'POST', body: form, signal: AbortSignal.timeout(45000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Transcription failed (${res.status})`);
  }
  return data.text;
}

function Chatbot({ diagnosis, lang }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Voice input state: 'idle' | 'recording' | 'transcribing'
  const [voiceState, setVoiceState] = useState('idle');
  const [recordSeconds, setRecordSeconds] = useState(0);
  // One-time FAB pulse ring when a diagnosis arrives while the chat is closed
  const [pulseRing, setPulseRing] = useState(false);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordTimerRef = useRef(null);
  const voiceTurnRef = useRef(false); // whether the latest user turn came from voice
  const cancelRef = useRef(false);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Diagnose-arrival nudge: a single 8px pulse ring on the FAB
  useEffect(() => {
    if (diagnosis && !isOpen) {
      setPulseRing(true);
      const t = setTimeout(() => setPulseRing(false), 2200);
      return () => clearTimeout(t);
    }
  }, [diagnosis]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetings = {
        en: 'Hello! I am your Kisan Mitra AI assistant. You can ask me about your crop report or any farming related questions.',
        hi: 'नमस्ते! मैं आपका किसान मित्र AI सहायक हूँ। आप अपनी फसल की रिपोर्ट या किसी भी कृषि समस्या के बारे में मुझसे पूछ सकते हैं।',
        mr: 'नमस्कार! मी तुमचा शेतकरी मित्र AI सहाय्यक आहे. तुमच्या पिकाच्या रिपोर्टबद्दल किंवा कोणत्याही शेती समस्येबद्दल मला विचारू शकता.',
      };
      setMessages([{ role: 'model', content: greetings[lang] || greetings.en, isGreeting: true }]);
    }
  }, [isOpen, messages.length, lang]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  // Cleanup recorder stream on close/unmount
  useEffect(() => () => stopStream(), []);

  const toggleChat = () => {
    if (isOpen && voiceState === 'recording') cancelRecording();
    setIsOpen(!isOpen);
  };

  /** Speak a chatbot reply aloud (voice turns only). Uses the server TTS
   * fallback when the device has no speech voices (M5). */
  const speakReply = async (text) => {
    const clean = text.replace(/[*_#`]/g, '');
    const tag = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN';
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const base = tag.split('-')[0];
    const hasVoice = voices.some((v) => v.lang.toLowerCase().startsWith(base));

    if (window.speechSynthesis && hasVoice) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(clean);
      // Devanagari languages share hi-IN voices when mr-IN is unavailable
      utterance.lang = tag;
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
      return;
    }

    // Voice-less device: server Gemini TTS → WAV (same fallback as Read Aloud)
    try {
      const blob = await speakViaServer(clean.slice(0, 2000), lang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      /* speech is best-effort on voice turns — silent skip is fine */
    }
  };

  const sendMessage = async (textOverride = null) => {
    const content = (textOverride ?? input).trim();
    if (!content || loading) return;

    const usedVoice = voiceTurnRef.current;
    voiceTurnRef.current = false;

    const userMessage = { role: 'user', content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // C3: notes (mic-permission warnings) and the cosmetic greeting must
    // never go to the AI as conversation history; cap history so the
    // payload stays small on slow rural networks.
    const history = newMessages
      .filter((m) => !m.isNote && !m.isGreeting)
      .slice(-20)
      .map(({ role, content }) => ({ role, content }));

    try {
      // Build context from diagnosis if it exists
      const langLine = lang === 'hi'
        ? 'Reply in Hindi (Devanagari script).'
        : lang === 'mr'
          ? 'Reply in Marathi (Devanagari script).'
          : 'Reply in the language the farmer uses (English or Hindi).';
      let context = `You are Kisan Mitra, a helpful AI agricultural assistant for Indian farmers. ${langLine}`;
      if (diagnosis && diagnosis.disease_name?.toLowerCase() !== 'healthy' && diagnosis.disease_name !== 'Invalid Image') {
        context += ` The farmer recently scanned a crop diagnosed with ${diagnosis.disease_name}. Symptoms: ${diagnosis.symptoms?.join(', ')}. Chemical Treatment: ${diagnosis.treatment?.chemical}. Organic Treatment: ${diagnosis.treatment?.organic}.`;
      }

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          context: context
        }),
        signal: AbortSignal.timeout(30000),
      });

      // Surface server-provided messages (rate limit wait, provider busy)
      // instead of the generic "could not reach server"
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch chat');
      }

      if (data.success) {
        setMessages([...newMessages, { role: 'model', content: data.reply }]);
        if (usedVoice && data.reply) speakReply(data.reply);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: 'model', content: lang === 'hi' ? 'क्षमा करें, सर्वर से संपर्क नहीं हो पाया।' : 'Sorry, I could not reach the server.' }]);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Voice input ----------

  const pushSystemNote = (text) => {
    setMessages((prev) => [...prev, { role: 'model', content: text, isNote: true }]);
  };

  const startRecording = async () => {
    if (voiceState !== 'idle' || loading) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      pushSystemNote(lang === 'hi'
        ? '🎤 इस डिवाइस पर आवाज़ उपलब्ध नहीं है — कृपया टाइप करें।'
        : '🎤 Voice is not available on this device — please type instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelRef.current = false;

      // Safari lacks webm/opus; fall back to mp4/aac, then default
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopStream();
        if (cancelRef.current) {
          setVoiceState('idle');
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];

        if (blob.size < 2000) {
          // < ~2KB is silence/nothing captured
          setVoiceState('idle');
          pushSystemNote(lang === 'hi'
            ? '🎤 कुछ सुनाई नहीं दिया — दोबारा बोलें।'
            : '🎤 Nothing was captured — try again a bit louder.');
          return;
        }

        setVoiceState('transcribing');
        try {
          const text = await transcribeAudio(blob);
          if (!text) throw new Error(lang === 'hi' ? 'कुछ सुनाई नहीं दिया।' : 'Nothing was captured.');
          setVoiceState('idle');
          voiceTurnRef.current = true;
          await sendMessage(text); // transcript auto-sends
        } catch (err) {
          setVoiceState('idle');
          pushSystemNote(`🎤 ${err.message}`);
        }
      };

      recorder.start();
      setVoiceState('recording');
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      stopStream();
      setVoiceState('idle');
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      pushSystemNote(denied
        ? (lang === 'hi'
          ? '🎤 माइक की अनुमति बंद है — ब्राउज़र सेटिंग में अनुमति दें या टाइप करें।'
          : '🎤 Microphone permission is off — enable it in browser settings or type instead.')
        : (lang === 'hi'
          ? '🎤 माइक नहीं खुल पाया — कृपया टाइप करें।'
          : '🎤 Could not open the microphone — please type instead.'));
    }
  };

  const finishRecording = () => {
    if (voiceState !== 'recording') return;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop(); // onstop handles transcribe/send
    }
  };

  const cancelRecording = () => {
    cancelRef.current = true;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopStream();
    setVoiceState('idle');
  };

  const isHi = lang === 'hi';
  const chatText = {
    title: { en: 'AI Assistant', hi: 'AI सहायक', mr: 'AI सहाय्यक' },
    online: { en: 'Online', hi: 'ऑनलाइन', mr: 'ऑनलाइन' },
    close: { en: 'Close chat', hi: 'चैट बंद करें', mr: 'चॅट बंद करा' },
    mic: { en: 'Ask by voice', hi: 'बोलकर पूछें', mr: 'आवाजात विचारा' },
    send: { en: 'Send', hi: 'भेजें', mr: 'पाठवा' },
    sendAria: { en: 'Send message', hi: 'संदेश भेजें', mr: 'संदेश पाठवा' },
    stopRec: { en: 'Stop recording', hi: 'रिकॉर्डिंग रोकें', mr: 'रेकॉर्डिंग थांबवा' },
    cancelRec: { en: 'Cancel recording', hi: 'रिकॉर्डिंग रद्द करें', mr: 'रेकॉर्डिंग रद्द करा' },
    transcribing: { en: 'Transcribing your voice…', hi: 'आवाज़ पहचान रहे हैं…', mr: 'आवाज ओळखत आहोत…' },
    askPlaceholder: { en: 'Ask a question...', hi: 'कुछ पूछें...', mr: 'काही विचारा...' },
    voiceHint: {
      en: 'Tap the mic to ask by voice — the answer is read aloud.',
      hi: 'माइक दबाकर हिंदी में बोलें — जवाब सुनाई देगा।',
      mr: 'मायक दाबून विचारा — उत्तर ऐकायला मिळेल.',
    },
    openChat: { en: 'Open AI assistant', hi: 'AI सहायक खोलें', mr: 'AI सहाय्यक उघडा' },
  };
  const ct = (key) => chatText[key][lang] || chatText[key].en;

  return (
    <div className="chatbot-wrapper no-print">
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <span className="chatbot-header-bot" aria-hidden="true">
              <MessageCircle size={18} />
            </span>
            <div className="chatbot-header-meta">
              <h4>{ct('title')}</h4>
              <span className="chatbot-online"><span className="online-dot" aria-hidden="true" />{ct('online')}</span>
            </div>
            <button onClick={toggleChat} className="close-chat-btn" aria-label={ct('close')}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}${msg.isNote ? ' note' : ''}`}>
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble model loading">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            )}
            {voiceState === 'transcribing' && (
              <div className="chat-bubble user voice-pending">
                <span className="spinner" aria-hidden="true" /> {ct('transcribing')}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="chatbot-input-area"
          >
            {voiceState === 'recording' ? (
              <div className="voice-recording-bar">
                <span className="rec-dot" aria-hidden="true" />
                <span className="rec-timer">{String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}</span>
                <span className="waveform" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => <span key={i} className="wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />)}
                </span>
                <button type="button" className="mic-btn send-rec" onClick={finishRecording} title={ct('send')} aria-label={ct('stopRec')}>
                  <Send size={16} aria-hidden="true" />
                </button>
                <button type="button" className="mic-btn cancel-rec" onClick={cancelRecording} title={ct('cancelRec')} aria-label={ct('cancelRec')}>
                  <Square size={14} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={ct('askPlaceholder')}
                  disabled={loading || voiceState === 'transcribing'}
                />
                <button
                  type="button"
                  className={`mic-btn ${voiceState === 'transcribing' ? 'busy' : ''}`}
                  onClick={startRecording}
                  disabled={loading || voiceState === 'transcribing'}
                  title={ct('mic')}
                  aria-label={ct('mic')}
                >
                  <Mic size={18} aria-hidden="true" />
                </button>
                <button
                  type="submit"
                  className="send-btn"
                  disabled={!input.trim() || loading || voiceState !== 'idle'}
                  aria-label={ct('sendAria')}
                >
                  <Send size={16} aria-hidden="true" />
                </button>
              </>
            )}
          </form>
          {voiceState === 'idle' && isOpen && (
            <div className="voice-hint">
              {ct('voiceHint')}
            </div>
          )}
        </div>
      )}

      {!isOpen && (
        <button className={`chatbot-fab ${pulseRing ? 'pulse-ring' : ''}`} onClick={toggleChat} aria-label={ct('openChat')}>
          <MessageCircle size={24} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default Chatbot;
