/**
 * Gemini AI Service — Kisan Mitra
 * 
 * Multimodal crop disease detection service using Google Gen AI SDK (@google/genai)
 * and the Gemini 2.5 Flash model.
 */

const { GoogleGenAI } = require('@google/genai');

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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }

  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('Invalid image buffer provided for diagnosis.');
  }

  // Convert buffer to base64 string for Gemini inlineData
  const base64Image = imageBuffer.toString('base64');

  console.log(`🤖 Initializing Gemini 2.5 Flash diagnosis (${mimeType}, base64 length: ${base64Image.length})...`);

  const ai = new GoogleGenAI({ apiKey });

  // Retry logic for transient spikes (503 high demand / 429 rate limits)
  const maxRetries = 3;
  let response;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: CROP_DIAGNOSIS_PROMPT }
          ]
        }],
        config: {
          responseMimeType: 'application/json'
        }
      });
      break; // Success, proceed with response
    } catch (apiError) {
      const isTransient =
        apiError.status === 503 ||
        apiError.status === 429 ||
        (apiError.message &&
          (apiError.message.includes('503') ||
            apiError.message.includes('high demand') ||
            apiError.message.includes('ResourceExhausted')));

      if (isTransient && attempt < maxRetries) {
        const backoffMs = attempt * 1500;
        console.warn(
          `⚠️ Gemini API temporary demand spike (attempt ${attempt}/${maxRetries}). Retrying in ${backoffMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      } else {
        throw apiError;
      }
    }
  }

  const responseText = response?.text;
  if (!responseText) {
    throw new Error('Empty response received from Gemini model.');
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
 * Generate a highly contextual piece of advice based on BOTH the disease and the weather.
 */
async function generateWeatherAdvisory(diagnosis, weather, lang) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    let promptText = `You are an expert agricultural advisor. 
The farmer's crop has been diagnosed with: ${diagnosis.disease_name}.
The current weather forecast is: ${weather.temp}°C, ${weather.description}, Humidity: ${weather.humidity}%.

Provide exactly 2-3 sentences of critical farming advice combining these two factors. 
Do not hallucinate. Be direct and actionable.`;

    if (lang === 'hi') {
      promptText += `\n\nProvide the response strictly in Hindi (Devanagari script).`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText
    });

    return response.text.trim();
  } catch (error) {
    console.error('Gemini Weather Advisory Error:', error);
    throw new Error('Failed to generate weather advisory');
  }
}

/**
 * Chatbot interface for Kisan Mitra
 */
async function chatWithGemini(messages, systemContext) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Convert history to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Inject system context into the first message
    if (contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `SYSTEM CONTEXT (Do not acknowledge this, just use it to help the user):\n${systemContext}\n\nUSER MESSAGE:\n${contents[0].parts[0].text}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents
    });

    return response.text.trim();
  } catch (error) {
    console.error('Gemini Chat Error:', error);
    throw new Error('Failed to respond to chat');
  }
}

module.exports = {
  diagnoseCropDisease,
  generateWeatherAdvisory,
  chatWithGemini
};
