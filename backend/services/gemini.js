/**
 * Gemini AI Service — Kisan Mitra
 * 
 * Multimodal crop disease detection service using Google Gen AI SDK (@google/genai)
 * and the Gemini 3.6 Flash model.
 */

const { GoogleGenAI } = require('@google/genai');

/** provider name → epoch-ms until which it is skipped (circuit breaker). */
const providerCooldowns = new Map();

/**
 * System and task prompt instructing Gemini to act as an agricultural expert
 * and return a strictly structured JSON response for crop disease diagnosis.
 */
const CROP_DIAGNOSIS_PROMPT = `You are an expert plant pathologist and agronomist AI assistant for Indian agriculture (Kisan Mitra).
Analyze this crop or leaf image and detect any disease, pest infestation, nutrient deficiency, or health status.

You MUST respond ONLY with a valid JSON object matching the exact structure below. Do NOT wrap in markdown code blocks (\`\`\`json ... \`\`\`), do NOT include any preamble or extra text outside the JSON object.

Exact JSON Structure:
{
  "disease_name": "string — name of the disease, pest infestation, or 'Healthy' if no disease is found",
  "disease_name_hi": "string — Hindi translation of the disease name in Devanagari script (e.g. 'अगेती झुलसा' or 'स्वस्थ')",
  "confidence": 0.85,
  "severity": "mild|moderate|severe",
  "description": "string — 2-3 sentence clear explanation of what was detected in the crop image",
  "description_hi": "string — Hindi translation of the description in Devanagari script",
  "symptoms": ["list", "of", "visible", "symptoms", "observed"],
  "treatment": {
    "chemical": "string — recommended chemical pesticide/fungicide/fertilizer with dosage and application instructions (or 'None required' if healthy)",
    "chemical_hi": "string — Hindi translation of chemical treatment recommendations",
    "organic": "string — organic or biological remedy suitable for Indian farmers (e.g. neem oil, jeevamrut, trichoderma)",
    "organic_hi": "string — Hindi translation of organic remedy recommendations",
    "preventive": "string — preventive measures and agronomic practices to prevent recurrence",
    "preventive_hi": "string — Hindi translation of preventive measures"
  },
  "crop_type": "string — identified crop (e.g. tomato, wheat, rice, potato, cotton, mustard)",
  "yield_risk": "string — economic/yield loss if untreated (e.g. '30-40% yield loss')",
  "yield_risk_hi": "string — Hindi translation of yield_risk"
}

Guidelines:
1. Accuracy: Be agronomically precise. If the image is unclear or you are not completely certain, reflect this in the confidence score (0.0 to 1.0) and mention your uncertainty in the description.
2. Non-plant images: If the uploaded image is not a plant or crop, set "disease_name" to "Invalid Image", "crop_type" to "Unknown", "severity" to "mild", and explain in "description" that the image does not contain a recognizable crop.
3. Language: Provide accurate and natural Hindi translations (Devanagari script) to assist rural farmers in India.
4. Treatments: Provide practical dosages and remedies relevant to Indian farming conditions.
5. Format: Output pure valid JSON only.`;

/**
 * Diagnose crop disease from an image buffer using Gemini 2.5 Flash.
 *
 * @param {Buffer} imageBuffer - Raw image buffer from multer memory storage
 * @param {string} mimeType - MIME type of the uploaded image (e.g. 'image/jpeg', 'image/png')
 * @returns {Promise<Object>} Parsed diagnosis JSON object
 */
async function diagnoseCropDisease(imageBuffer, mimeType) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('Invalid image buffer provided for diagnosis.');
  }

  // Convert buffer to base64 string for Gemini inlineData
  const base64Image = imageBuffer.toString('base64');

  console.log(`🤖 Diagnosis request (${mimeType}, base64 length: ${base64Image.length})...`);

  // Provider chain for vision diagnosis. GEMINI goes FIRST (best
  // agronomic precision on subtle leaf symptoms); the chain then fails
  // over to Groq's Qwen 3.8-27b (multimodal, ~1k req/day free, fast
  // strict-JSON) and further Gemini models, each with its own daily
  // quota. Order is controlled by DIAGNOSIS_PROVIDER_ORDER if needed.
  const geminiFirst = (process.env.DIAGNOSIS_PROVIDER_ORDER || 'gemini,groq')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim());

  const geminiAttempt = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('⚠️ GEMINI_API_KEY not set — skipping Gemini vision providers');
      return;
    }
    const ai = new GoogleGenAI({ apiKey });
    const visionModels = [
      process.env.GEMINI_VISION_MODEL_1 || 'gemini-3.6-flash',
      process.env.GEMINI_VISION_MODEL_2 || 'gemini-3.5-flash-lite',
      process.env.GEMINI_VISION_MODEL_3 || 'gemini-3.5-flash',
    ];
    for (const model of visionModels) {
      attempts.push({
        provider: model,
        run: () => geminiVisionCall(ai, model, base64Image, mimeType),
      });
    }
  };

  const groqAttempt = () => {
    if (process.env.GROQ_API_KEY) {
      attempts.push({
        provider: `groq:${process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b'}`,
        run: () => groqVisionDiagnose(base64Image, mimeType),
      });
    }
  };

  const attempts = [];
  for (const p of geminiFirst) {
    if (p === 'gemini') geminiAttempt();
    else if (p === 'groq') groqAttempt();
  }

  if (attempts.length === 0) {
    throw new Error('No AI provider configured. Set GROQ_API_KEY and/or GEMINI_API_KEY in backend/.env');
  }

  let responseText = null;
  let lastError = null;
  let servedBy = null;

  // Circuit breaker: a provider that just timed out is likely still
  // congested — skip it for a few minutes so scans don't repeatedly pay
  // the timeout cost. It rejoins the chain automatically when the window
  // expires (or immediately on process restart).
  const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS) || 10000;
  const COOLDOWN_MS = Number(process.env.PROVIDER_COOLDOWN_MS) || 5 * 60 * 1000;

  for (const attempt of attempts) {
    const coolingUntil = providerCooldowns.get(attempt.provider);
    if (coolingUntil && Date.now() < coolingUntil) {
      console.log(`⏭️ [${attempt.provider}] cooling down after a recent timeout — skipping`);
      continue;
    }
    try {
      responseText = await withTimeout(attempt.run(), PROVIDER_TIMEOUT_MS, attempt.provider);
      servedBy = attempt.provider;
      providerCooldowns.delete(attempt.provider);
      console.log(`✅ Diagnosis served by ${servedBy}`);
      break;
    } catch (err) {
      // Trip the breaker on timeouts AND congestion errors (503 high-demand,
      // 429 quota) — both mean the provider is unhealthy right now. Auth/config
      // errors (401/400) don't trip it: skipping wouldn't help, and the fast
      // failure cost is negligible.
      const isTimeout = err.code === 'PROVIDER_TIMEOUT';
      const isCongestion = err.status === 429 || err.status >= 500 ||
        /high demand|ResourceExhausted|overload/i.test(err.message || '');
      if (isTimeout || isCongestion) {
        providerCooldowns.set(attempt.provider, Date.now() + COOLDOWN_MS);
      }
      console.warn(`↪️ [${attempt.provider}] failed: ${err.message} — trying next provider...`);
      lastError = err;
    }
  }

  if (!responseText) {
    throw lastError ? friendlyGeminiError(lastError) : new Error('All diagnosis providers failed.');
  }

  // Clean and parse JSON response
  let cleanedText = responseText.trim();

  // Strip markdown code fences if model enclosed JSON in ```json ... ```
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }
  cleanedText = cleanedText.trim();

  try {
    const parsedData = JSON.parse(cleanedText);
    return parsedData;
  } catch (parseError) {
    console.error('Failed to parse Gemini response as JSON. Raw response:', responseText);
    throw new Error(`Invalid JSON returned by Gemini: ${parseError.message}`);
  }
}

/**
 * Reject if a provider attempt exceeds `ms` — keeps worst-case scan latency
 * bounded (attempts × timeout) instead of unbounded when a model stalls.
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error(`${label} timed out after ${Math.round(ms / 1000)}s`);
        err.code = 'PROVIDER_TIMEOUT';
        reject(err);
      }, ms);
    }),
  ]);
}

/**
 * Groq vision diagnosis — OpenAI-compatible chat-completions with a
 * base64 data-URL image. Qwen 3.8-27b returns the same strict JSON the
 * Gemini prompt demands (response_format: json_object).
 */
async function groqVisionDiagnose(base64Image, mimeType) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');
  const model = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          { type: 'text', text: CROP_DIAGNOSIS_PROMPT },
        ],
      }],
      response_format: { type: 'json_object' },
      max_tokens: 1200,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${body.slice(0, 150)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Groq vision');
  return content;
}

/** One Gemini vision call with the JSON prompt. Transient errors propagate to the chain. */
async function geminiVisionCall(ai, model, base64Image, mimeType) {
  // No in-model retries: the provider chain below already retries across
  // models/providers. Re-trying the same congested model only adds latency.
  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: CROP_DIAGNOSIS_PROMPT },
      ],
    }],
    config: { responseMimeType: 'application/json' },
  });
  if (!response.text) throw new Error(`Empty response from ${model}`);
  return response.text;
}

/**
 * Map raw googleapis errors to farmer/judge-friendly messages.
 * The raw JSON blobs are useless in a demo.
 */
function friendlyGeminiError(apiError) {
  const msg = apiError.message || '';
  if (
    apiError.status === 400 ||
    apiError.status === 401 ||
    apiError.status === 403 ||
    /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)
  ) {
    return new Error(
      'Gemini API key is invalid or missing. Set a valid GEMINI_API_KEY in backend/.env'
    );
  }
  if (
    apiError.status === 503 ||
    apiError.status === 429 ||
    /overload|high demand|ResourceExhausted|unavailable/i.test(msg)
  ) {
    return new Error(
      'All Gemini vision models are busy or out of daily quota right now. Please try again in a little while.'
    );
  }
  return apiError;
}

module.exports = {
  diagnoseCropDisease
};
