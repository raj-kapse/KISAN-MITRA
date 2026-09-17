/**
 * Kisan Mitra — Backend Entry Point
 * 
 * Express server that handles:
 * - Image upload & AI diagnosis (Gemini multimodal)
 * - Weather advisory (OpenWeatherMap)
 * - Scan history (Firebase/Firestore)
 * - Health check endpoint for connectivity testing
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables before anything else
dotenv.config();

// --- Route imports ---
const healthRoutes = require('./routes/health');
const diagnoseRoutes = require('./routes/diagnose');
const weatherRoutes = require('./routes/weather');
const weatherAdvisoryRoutes = require('./routes/weatherAdvisory');
const geocodeRoutes = require('./routes/geocode');
const historyRoutes = require('./routes/history');
const storesRoutes = require('./routes/stores');
const chatRoutes = require('./routes/chat');
const transcribeRoutes = require('./routes/transcribe');
const ttsRoutes = require('./routes/tts');
const profileRoutes = require('./routes/profile');

// --- App setup ---
const app = express();

// Validate PORT rather than trusting it. Some environments export PORT=0 or a
// non-numeric value; `process.env.PORT || 5000` would then bind an arbitrary
// ephemeral port and the app would look broken ("running on http://localhost:0").
const parsedPort = Number.parseInt(process.env.PORT ?? '', 10);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
  ? parsedPort
  : 5000;
if (process.env.PORT !== undefined && String(PORT) !== process.env.PORT) {
  console.warn(`⚠️  Ignoring invalid PORT="${process.env.PORT}" — using ${PORT} instead.`);
}

// Trust one layer of reverse proxy (Render, Railway, Cloudflare, etc.)
// so req.ip is the real client IP, not the proxy — essential for
// per-client rate limiting to actually work in production.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// --- Middleware ---

// CORS: allow frontend origin (Vite dev server or production URL).
// In development, also accept localhost variants.
const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:5173'];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
}
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Baseline security headers, dependency-free. This is a JSON API, so the
// useful ones are: don't let browsers sniff a response into a different type,
// don't allow the API to be framed, and don't leak the caller's URL onward.
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Cross-Origin-Resource-Policy', 'same-site');
  next();
});

// Parse JSON bodies (for non-file requests). 1 MB is generous for every JSON
// route here (the largest is a 20-turn chat at ~40 KB); file uploads are
// limited separately by multer. A 10 MB JSON ceiling just invited abuse.
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- Routes ---
// Rate limiters are applied INSIDE each router on the specific route
// handler, NOT here at the mount level. Mounting them on app.use('/api',
// limiter, router) caused every /api/* request to share one bucket —
// hitting /api/stores would consume /api/diagnose's quota.
app.use('/api', healthRoutes);
app.use('/api', diagnoseRoutes);
app.use('/api', weatherRoutes);
app.use('/api', weatherAdvisoryRoutes);
app.use('/api', geocodeRoutes);
app.use('/api', historyRoutes);
app.use('/api', storesRoutes);
app.use('/api', chatRoutes);
app.use('/api', transcribeRoutes);
app.use('/api', ttsRoutes);
app.use('/api', profileRoutes);

// M7: JSON 404 for unknown API routes — Express's default HTML 404 broke
// the frontend's `res.json().catch()` error contract.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Unknown API endpoint: ${req.method} ${req.originalUrl}` });
});

// --- Error handling middleware ---
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  // Body-parser rejections (oversized/invalid JSON) are client errors, not 500s
  const status = err.type === 'entity.too.large' ? 413
    : err.type === 'entity.parse.failed' ? 400
    : 500;
  res.status(status).json({
    success: false,
    error: status === 413 ? 'Request body too large.'
      : status === 400 ? 'Malformed JSON body.'
      : process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`\n🌾 Kisan Mitra backend running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`   Trust Proxy: ${process.env.TRUST_PROXY ? process.env.TRUST_PROXY + ' (from env)' : '⚠️ NOT SET — rate limits will apply per-proxy-IP in production'}`);
  
  // Log API key status (never log the actual keys)
  console.log(`   Groq API Key: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Gemini API Key: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   OpenWeather Key: ${process.env.OPENWEATHER_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Firebase Project: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}\n`);
});

module.exports = app;
