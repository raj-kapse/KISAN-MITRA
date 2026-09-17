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

      console.log(
        `🌱 Processing diagnosis request for: ${req.file.originalname} (${req.file.mimetype}, ${(req.file.size / 1024).toFixed(1)} KB)`
      );

      // Invoke Gemini AI diagnosis service
      const diagnosis = await diagnoseCropDisease(req.file.buffer, req.file.mimetype);

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
        error: isProviderIssue
          ? 'All AI providers are busy right now — please try again in a few seconds.'
          : (error.message || 'Internal server error while diagnosing crop image.'),
      });
    }
  });
});

module.exports = router;

