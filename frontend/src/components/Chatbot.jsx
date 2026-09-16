import { useState, useRef, useEffect } from 'react';
import './Chatbot.css';
import { API_BASE } from '../api';

function Chatbot({ diagnosis, lang }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

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

  const toggleChat = () => setIsOpen(!isOpen);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Build context from diagnosis if it exists
      let context = 'You are Kisan Mitra, a helpful AI agricultural assistant for Indian farmers.';
      if (diagnosis && !diagnosis.isHealthy) {
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

  return (
    <div className="chatbot-wrapper no-print">
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <h4>🤖 AI Assistant</h4>
            <button onClick={toggleChat} className="close-chat-btn">✕</button>
          </div>
          
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
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
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="chatbot-input-area">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === 'hi' ? 'कुछ पूछें...' : 'Ask a question...'}
              disabled={loading}
            />
            <button type="submit" disabled={!input.trim() || loading}>
              ➤
            </button>
          </form>
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
