// backend/routes/transcribe.js
// POST /api/transcribe — multipart audio (field: "audio") → Groq Whisper
// transcript. Powers Hindi voice input in the chatbot: the farmer speaks,
// Whisper transcribes, the existing chat chain answers (and the UI speaks
// the reply aloud).
//
// Groq's audio API follows the OpenAI shape: multipart with the raw file
// plus form fields (model, language, response_format).

const express = require('express');
const multer = require('multer');
const { aiRateLimit } = require('../middleware/rateLimit');
const router = express.Router();

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB ≈ several minutes of opus audio

// Keep the recording in memory; it lives for the length of one request
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: (req, file, cb) => {
    const looksAudio =
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'video/webm' || // Safari MediaRecorder reports some webm oddly
      file.mimetype === 'application/octet-stream'; // generic binary (curl, some browsers)
    if (looksAudio) {
      cb(null, true);
    } else {
      const err = new Error(`Unsupported audio type '${file.mimetype}'.`);
      err.code = 'INVALID_AUDIO_TYPE';
      cb(err, false);
    }
  },
});

router.post('/transcribe', aiRateLimit, (req, res) => {
  upload.single('audio')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Recording too long. Please keep voice notes under a minute.',
        });
      }
      if (err.code === 'INVALID_AUDIO_TYPE') {
        return res.status(400).json({ success: false, error: err.message });
      }
      return res.status(400).json({ success: false, error: err.message || 'Upload error.' });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio uploaded. Provide the recording under form-data key "audio".',
      });
    }

    // Reject near-empty recordings before they burn a Groq Whisper call.
    // The frontend already filters recordings under 2 KB client-side, but
    // the server enforces it too for curl / other clients.
    const MIN_AUDIO_BYTES = 2048;
    if (req.file.size < MIN_AUDIO_BYTES) {
      return res.status(400).json({
        success: false,
        error: `Recording too short (${req.file.size} bytes). Please speak for at least a second.`,
      });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: 'Voice input is not configured (GROQ_API_KEY missing on server).',
      });
    }

    try {
      // Groq expects the raw bytes as a file part; use the client's mime type
      const ext = (req.file.originalname || '').split('.').pop();
      const filename = ext ? `recording.${ext}` : 'recording.webm';

      const form = new FormData();
      form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), filename);
      form.append('model', GROQ_MODEL);
      form.append('language', 'hi'); // bias to Hindi; English words still transcribe fine
      form.append('response_format', 'json');
      form.append('temperature', '0');

      const groqRes = await fetch(GROQ_TRANSCRIBE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!groqRes.ok) {
        const body = await groqRes.text().catch(() => '');
        console.error(`[transcribe] Groq ${groqRes.status}: ${body.slice(0, 200)}`);
        if (groqRes.status === 429) {
          return res.status(429).json({
            success: false,
            error: 'Voice service is busy — please try again in a few seconds.',
          });
        }
        return res.status(502).json({
          success: false,
          error: 'Voice transcription failed. Please type your question instead.',
        });
      }

      const data = await groqRes.json();
      const text = (data.text || '').trim();
      if (!text) {
        return res.status(200).json({
          success: false,
          error: "We couldn't hear anything — try speaking a bit louder.",
        });
      }

      return res.json({ success: true, text, model: GROQ_MODEL });
    } catch (error) {
      console.error('[transcribe] error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Voice transcription failed. Please type your question instead.',
      });
    }
  });
});

module.exports = router;
