/**
 * Text Provider — Kisan Mitra
 *
 * Text-only AI completions (chatbot, weather advisory) with provider
 * failover. Groq goes first: near-instant, free ~1k req/day, and it does
 * NOT consume the Gemini quota that vision diagnosis depends on.
 * Gemini is the fallback (and the only provider used for vision).
 *
 * The image-diagnosis path (services/gemini.js) deliberately stays on
 * Gemini — the free Groq tier exposed to this account has no vision models.
 */

const { GoogleGenAI } = require('@google/genai');

const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
const GEMINI_TEXT_MODEL = 'gemini-3.6-flash';
const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS) || 15000;

/**
 * Reject if a provider call exceeds PROVIDER_TIMEOUT_MS — chat/advisory
 * must not hang. (L8: same shape as gemini.js's withTimeout, which takes an
 * explicit `ms` — these live in different modules on purpose: textProvider
 * uses one shared env-tunable, while the vision chain tunes per provider.)
 */
function withTimeout(promise, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`${label} timed out after ${Math.round(PROVIDER_TIMEOUT_MS / 1000)}s`);
      err.code = 'PROVIDER_TIMEOUT';
      reject(err);
    }, PROVIDER_TIMEOUT_MS);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/** Groq via the OpenAI-compatible chat-completions endpoint. */
async function groqChat(messages, systemContext) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemContext },
        ...messages.map((m) => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.content,
        })),
      ],
      // 500 tokens truncated longer Marathi/Hindi advisories mid-sentence.
      // 1200 keeps full answers within the free-tier speed envelope.
      max_tokens: 1200,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${body.slice(0, 150)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Groq');
  return content.trim();
}

/** Gemini text-only chat (fallback provider). */
async function geminiChat(messages, systemContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });
  const contents = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  // Gemini API requires the first message to have role 'user'
  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  // Inject context into the first USER turn (chats open with a model greeting)
  const firstUser = contents.find((m) => m.role === 'user');
  if (firstUser) {
    firstUser.parts[0].text =
      `SYSTEM CONTEXT (Do not acknowledge this, just use it to help the user):\n${systemContext}\n\nUSER MESSAGE:\n${firstUser.parts[0].text}`;
  }

  const response = await ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents,
  });
  if (!response.text) throw new Error('Empty response from Gemini');
  return response.text.trim();
}

/**
 * Run a text-only chat completion with provider failover.
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} systemContext — system-style instructions
 * @returns {Promise<{text: string, provider: string}>}
 */
async function chatComplete(messages, systemContext) {
  const providers = [];
  if (process.env.GROQ_API_KEY) providers.push({ name: 'groq', fn: groqChat });
  if (process.env.GEMINI_API_KEY) providers.push({ name: 'gemini', fn: geminiChat });

  if (providers.length === 0) {
    throw new Error('No AI provider configured (GROQ_API_KEY / GEMINI_API_KEY missing)');
  }

  let lastErr;
  for (const p of providers) {
    try {
      const text = await withTimeout(p.fn(messages, systemContext), p.name);
      return { text, provider: p.name };
    } catch (err) {
      console.warn(`⚠️ textProvider [${p.name}] failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr;
}

module.exports = { chatComplete };
