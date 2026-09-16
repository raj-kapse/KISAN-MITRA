import { useState, useRef, useEffect } from 'react';
import './Chatbot.css';
import { API_BASE } from '../api';

/**
 * Transcribe a recorded audio Blob via /api/transcribe (Groq Whisper).
 * Returns { text } or throws with a user-safe message.
 */
async function transcribeAudio(blob) {
  const form = new FormData();
  form.append('audio', blob, `recording.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);

  const res = await fetch(`${API_BASE}/api/transcribe`, { method: 'POST', body: form });
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

  // Initial greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'model',
        content: lang === 'hi'
          ? 'नमस्ते! मैं आपका किसान मित्र AI सहायक हूँ। आप अपनी फसल की रिपोर्ट या किसी भी कृषि समस्या के बारे में मुझसे पूछ सकते हैं।'
          : 'Hello! I am your Kisan Mitra AI assistant. You can ask me about your crop report or any farming related questions.'
      }]);
    }
  }, [isOpen, messages.length, lang]);

  // Cleanup recorder stream on close/unmount
  useEffect(() => () => stopStream(), []);

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

  const toggleChat = () => {
    if (isOpen && voiceState === 'recording') cancelRecording();
    setIsOpen(!isOpen);
  };

  /** Speak a chatbot reply aloud (voice turns only). */
  const speakReply = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    // Strip markdown emphasis so it isn't read out
    const clean = text.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
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

    try {
      // Build context from diagnosis if it exists
      let context = 'You are Kisan Mitra, a helpful AI agricultural assistant for Indian farmers.';
      if (diagnosis && diagnosis.disease_name?.toLowerCase() !== 'healthy' && diagnosis.disease_name !== 'Invalid Image') {
        context += ` The farmer recently scanned a crop diagnosed with ${diagnosis.disease_name}. Symptoms: ${diagnosis.symptoms?.join(', ')}. Chemical Treatment: ${diagnosis.treatment?.chemical}. Organic Treatment: ${diagnosis.treatment?.organic}.`;
      }

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: context
        })
      });

      if (!response.ok) throw new Error('Failed to fetch chat');
      const data = await response.json();

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

  return (
    <div className="chatbot-wrapper no-print">
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <h4>🤖 {isHi ? 'AI सहायक' : 'AI Assistant'}</h4>
            <button onClick={toggleChat} className="close-chat-btn">✕</button>
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
                {isHi ? '🎤 आवाज़ पहचान रहे हैं…' : '🎤 Transcribing your voice…'}
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
                <span className="rec-dot" />
                <span className="rec-timer">{String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}</span>
                <button type="button" className="mic-btn send-rec" onClick={finishRecording} title={isHi ? 'भेजें' : 'Send'}>
                  ➤
                </button>
                <button type="button" className="mic-btn cancel-rec" onClick={cancelRecording} title={isHi ? 'रद्द करें' : 'Cancel'}>
                  ✕
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isHi ? 'कुछ पूछें...' : 'Ask a question...'}
                  disabled={loading || voiceState === 'transcribing'}
                />
                <button
                  type="button"
                  className={`mic-btn ${voiceState === 'transcribing' ? 'busy' : ''}`}
                  onClick={startRecording}
                  disabled={loading || voiceState === 'transcribing'}
                  title={isHi ? 'बोलकर पूछें' : 'Ask by voice'}
                >
                  🎤
                </button>
                <button type="submit" disabled={!input.trim() || loading || voiceState !== 'idle'}>
                  ➤
                </button>
              </>
            )}
          </form>
          {voiceState === 'idle' && isOpen && (
            <div className="voice-hint">
              {isHi ? 'माइक दबाकर हिंदी में बोलें — जवाब सुनाई देगा।' : 'Hold the mic to ask by voice — the answer is read aloud.'}
            </div>
          )}
        </div>
      )}

      {!isOpen && (
        <button className="chatbot-fab" onClick={toggleChat}>
          🤖
        </button>
      )}
    </div>
  );
}

export default Chatbot;
