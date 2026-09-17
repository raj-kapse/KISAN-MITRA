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
const path = require('path');

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
const PORT = process.env.PORT || 5000;

// Trust one layer of reverse proxy (Render, Railway, Cloudflare, etc.)
// so req.ip is the real client IP, not the proxy — essential for
// per-client rate limiting to actually work in production.
app.set('trust proxy', 1);

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

// Parse JSON bodies (for non-file requests)
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// --- Error handling middleware ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error',
  });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`\n🌾 Kisan Mitra backend running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`   Trust Proxy: enabled (1 hop)`);
  
  // Log API key status (never log the actual keys)
  console.log(`   Groq API Key: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Gemini API Key: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   OpenWeather Key: ${process.env.OPENWEATHER_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Firebase Project: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}\n`);
});

module.exports = app;

