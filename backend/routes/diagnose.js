/**
 * Diagnosis Route — Kisan Mitra
 * 
 * Handles image uploads and triggers Gemini AI crop disease diagnosis.
 * Endpoint: POST /api/diagnose
 */

const express = require('express');
const multer = require('multer');
const { diagnoseCropDisease } = require('../services/gemini');
const { diagnoseRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Minimum acceptable image size in bytes. A valid compressed JPEG/PNG of
// a leaf is always larger than 1 KB; anything smaller is an empty file,
// a corrupt upload, or a 1x1 placeholder pixel.
const MIN_IMAGE_BYTES = 1024;

// Supported image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

/**
 * Identify an image from its magic bytes.
 *
 * The client-declared mimetype is only a claim: a text file or script can be
 * sent with `Content-Type: image/png` and would otherwise be forwarded to the
 * AI provider (and stored) as an image. Sniffing the real signature is the
 * only trustworthy check, and it lets us hand providers a verified type.
 *
 * @param {Buffer} buffer
 * @returns {'image/jpeg'|'image/png'|'image/webp'|null}
 */
function sniffImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

// Configure Multer to keep uploaded files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB maximum file size
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      const err = new Error(
        `Invalid file type '${file.mimetype}'. Supported formats: JPEG, JPG, PNG, WEBP.`
      );
      err.code = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

/**
 * POST /api/diagnose
 * Upload a crop/leaf image (field name 'image') and receive AI diagnosis
 */
router.post('/diagnose', diagnoseRateLimit, (req, res) => {
  // Wrap multer middleware to handle upload validation errors gracefully
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File too large. Maximum allowed size is 10MB.',
          });
        }
        return res.status(400).json({
          success: false,
          error: `Upload error: ${err.message}`,
        });
      }

      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      return res.status(400).json({
        success: false,
        error: err.message || 'File upload error.',
      });
    }

    try {
      // Validate that a file was attached
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image uploaded. Please provide an image file under form-data key "image".',
        });
      }

      // Reject empty or near-empty files before burning an AI API call
      if (req.file.size < MIN_IMAGE_BYTES) {
        return res.status(400).json({
          success: false,
          error: `Image too small (${req.file.size} bytes). Please upload a real crop/leaf photo (minimum ${MIN_IMAGE_BYTES} bytes).`,
        });
      }

      // Verify the bytes really are an image and use the sniffed type — never
      // the client's claim — when talking to the AI provider.
      const verifiedMime = sniffImageType(req.file.buffer);
      if (!verifiedMime) {
        return res.status(400).json({
          success: false,
          error: 'That file is not a valid JPEG, PNG or WEBP image. Please upload a crop/leaf photo.',
        });
      }

      console.log(
        `🌱 Processing diagnosis request for: ${req.file.originalname} (${verifiedMime}, ${(req.file.size / 1024).toFixed(1)} KB)`
      );

      // Invoke Gemini AI diagnosis service
      const diagnosis = await diagnoseCropDisease(req.file.buffer, verifiedMime);

      console.log(
        `✅ Diagnosis successful: [${diagnosis.crop_type || 'Unknown'}] ${diagnosis.disease_name || 'Unknown'} (Confidence: ${diagnosis.confidence})`
      );

      return res.json({
        success: true,
        diagnosis,
      });
    } catch (error) {
      console.error('❌ Error during crop diagnosis:', error.message || error);
      // 503 = provider outages/congestion (retryable), 500 = real bug.
      // Sending 503 lets the UI say "busy, retry" instead of "our fault".
      const isProviderIssue =
        error.code === 'PROVIDER_TIMEOUT' ||
        /timed out|429|50[23]|overload|busy|unavailable/i.test(error.message || '');
      return res.status(isProviderIssue ? 503 : 500).json({
        success: false,
        // Internal error text can carry provider/stack detail — only expose it
        // in development.
        error: isProviderIssue
          ? 'All AI providers are busy right now — please try again in a few seconds.'
          : (process.env.NODE_ENV === 'development'
            ? (error.message || 'Internal server error while diagnosing crop image.')
            : 'Could not analyze the image. Please try again.'),
      });
    }
  });
});

module.exports = router;

