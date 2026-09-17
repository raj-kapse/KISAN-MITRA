// backend/routes/tts.js
// POST /api/tts — text → spoken audio (WAV) via Gemini TTS.
//
// Why this exists: the Web Speech API (browser TTS) has zero voices on
// some Linux/Android Chrome setups, so "Read Aloud" queued into silence.
// This route is the reliable fallback — the frontend tries browser speech
// first and calls here when it can't speak.
//
// Gemini TTS returns raw PCM (L16, 24 kHz, mono); we wrap it in a WAV
// header so every browser can play it with a plain <audio> element.

const express = require('express');
const { ttsRateLimit } = require('../middleware/rateLimit');
const router = express.Router();

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const MAX_TEXT_CHARS = 4000;

/** Wrap raw signed 16-bit little-endian PCM in a minimal WAV container. */
function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

router.post('/tts', ttsRateLimit, async (req, res) => {
  const { text, lang } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'Missing text to speak.' });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return res.status(400).json({
      success: false,
      error: `Text too long (${text.length} chars). Maximum is ${MAX_TEXT_CHARS}.`,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: 'Text-to-speech is not configured on the server.',
    });
  }

  const voice = lang === 'mr' ? 'Aoede' : lang === 'hi' ? 'Aoede' : 'Kore';

  try {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ role: 'user', parts: [{ text: text.slice(0, MAX_TEXT_CHARS) }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });

    // Audio arrives as inlineData (base64 PCM) in the candidates
    const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) {
      console.error('[tts] no audio in Gemini response');
      return res.status(502).json({ success: false, error: 'Speech generation failed.' });
    }

    const pcm = Buffer.from(part.inlineData.data, 'base64');
    const wav = pcmToWav(pcm, Number(part.inlineData.sampleRate) || 24000);

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': wav.length,
      'Cache-Control': 'no-store',
    });
    return res.send(wav);
  } catch (err) {
    console.error('[tts] error:', err.message);
    const status = /429|RESOURCE_EXHAUSTED|quota/i.test(err.message || '') ? 503 : 502;
    return res.status(status).json({
      success: false,
      error: 'Speech service is busy — please try again in a moment.',
    });
  }
});

module.exports = router;
