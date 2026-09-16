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

// --- App setup ---
const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---

// CORS: allow frontend origin (Vite dev server or production URL)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON bodies (for non-file requests)
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Routes ---
app.use('/api', healthRoutes);
app.use('/api', diagnoseRoutes);
const weatherRoutes = require('./routes/weather');
app.use('/api', weatherRoutes);

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
  
  // Log API key status (never log the actual keys)
  console.log(`   Gemini API Key: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   OpenWeather Key: ${process.env.OPENWEATHER_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Firebase Project: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}\n`);
});

module.exports = app;
