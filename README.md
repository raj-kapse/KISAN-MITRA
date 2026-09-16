# 🌾 Kisan Mitra — AI Crop Health & Advisory App

> **Instant crop disease diagnosis and hyper-local weather advisory for Indian farmers — a multi-provider AI stack (Groq + Google Gemini) with automatic failover.**
>
> Built for the hackathon problem statements:
> - **AG-01** — Smart crop disease detection using image processing and machine learning
> - **AG-02** — Localized weather forecasts and crop recommendations for farmers

## What It Does

A farmer photographs a crop leaf → client-side image processing (downscale/compress) → the app identifies the disease in seconds, suggests treatment (chemical + organic + preventive), shows local weather with AI-combined crop guidance, and reads the advisory aloud in Hindi or English. No training pipeline, no model hosting — a Groq-hosted multimodal model (Qwen 3.8-27b) handles the vision + language in a single API call, with Google Gemini as automatic backup.

## Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| 📷 Leaf Disease Detection | ✅ Working | Upload/capture a leaf photo → AI diagnosis in seconds |
| 🖼️ Client-side Image Processing | ✅ Working | Canvas downscale to 1024px + JPEG compression before upload — faster on rural bandwidth |
| 💊 Treatment Recommendations | ✅ Working | Chemical, organic, and preventive options with dosages |
| ⚠️ Yield Risk Estimate | ✅ Working | Economic loss if the disease goes untreated |
| 🌦️ Weather Advisory | ✅ Working | Current conditions + 5-day forecast, with AI-combined disease + weather guidance |
| 🔄 Weather Provider Failover | ✅ Working | OpenWeatherMap primary → Open-Meteo keyless backup — weather never dies with a key or quota |
| 🏙️ Manual Location Fallback | ✅ Working | City-name search when geolocation is denied — the feature never dead-ends |
| 🗣️ Bilingual Output | ✅ Working | English + Hindi toggle for all diagnosis and treatment text |
| 🔊 Voice Read-Aloud | ✅ Working | Web Speech API TTS in Hindi or English |
| 🎙️ Hindi Voice Input | ✅ Working | Hold the mic, speak in Hindi/English → Groq Whisper transcribes → the answer is **spoken aloud** — a fully hands-free loop for farmers who can't type |
| 🤖 Context-aware Chatbot | ✅ Working | Floating assistant that knows your latest scan and answers follow-ups |
| 🏪 Nearby Agri-stores | ✅ Working | OpenStreetMap lookup of agrochemical/farm shops within 20 km |
| 📜 Scan History | ✅ Working | Past diagnoses saved to Firestore, **scoped per device** (privacy) |
| 💬 WhatsApp / PDF Export | ✅ Working | Share the report with an extension officer or print to PDF |
| 📱 Offline-capable PWA | ✅ Working | Installable, service worker precache, works on low-end Android |
| 🛡️ Quota Protection | ✅ Working | Rate limiting on AI/weather endpoints, coordinate validation on all geo routes |

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React + Vite (PWA) | Fast dev, small bundle, mobile-first |
| **Backend** | Node.js + Express | Quick to scaffold, async I/O |
| **AI Engine** | **Groq · Qwen 3.8-27b** (primary, multimodal) + **Google Gemini 3.x Flash** (failover chain) | Near-instant JSON diagnosis (~1-2s); every provider has its own free tier, so the app keeps working when any one is out of quota |
| **Weather** | OpenWeatherMap (primary) + Open-Meteo (keyless fallback) | Live forecast data with automatic provider failover — the app never depends on a single free key |
| **Database** | Firebase / Firestore | Real-time, free tier, per-device history scoping |
| **Voice** | Web Speech API | Browser-native TTS, zero extra infra, Hindi support |
| **Stores** | OpenStreetMap Overpass API | Free, no API key, farm-shop POIs |

### Why a Multi-Provider AI Stack Instead of a Custom Model

Traditional plant disease classifiers require training a CNN (e.g. MobileNetV2) on labeled datasets like PlantVillage, hosting the model, and maintaining a fixed set of disease classes. We chose a different approach:

- **Groq-hosted Qwen 3.8-27b is the primary engine** — a multimodal model that accepts a raw leaf image and returns the full diagnosis as strict JSON in ~1-2 seconds; Groq's free tier allows ~1,000 requests/day with no card required
- **Google Gemini (3.6 Flash → 3.5 Flash-Lite → 3.5 Flash) is the automatic failover** — each model has its own free-tier daily quota, and the backend walks the chain whenever the primary is out of quota or congested. One provider's bad day cannot take the demo down
- A single API call returns disease name, confidence, severity, symptoms, treatment options, yield risk, and crop identification — all as structured JSON
- Hindi translations are generated in the same call, not through a separate translation layer
- The model generalises to crops and diseases beyond any fixed training set
- Client-side canvas preprocessing (resize/compress) keeps uploads fast on rural networks
- Trade-off: requires network connectivity and depends on provider availability. For a hackathon prototype targeting connected users, this is the right call

#### Provider chain (all automatic, zero user-facing differences)

```
📷 Diagnosis   →  Groq/Qwen 3.8-27b → gemini-3.6-flash → gemini-3.5-flash-lite → gemini-3.5-flash
💬 Chatbot     →  Groq/Qwen 3.8-27b → Gemini
🌦️ Advisory    →  Groq/Qwen 3.8-27b → Gemini
🌤️ Weather data →  OpenWeatherMap → Open-Meteo (keyless, never out of quota)
📍 Geocoding   →  OpenWeatherMap → Open-Meteo (keyless)
```

## Quick Start

### Prerequisites
- Node.js 18+
- API keys (all free): [Groq](https://console.groq.com) (primary AI), [Google Gemini](https://aistudio.google.com/apikey) (backup AI), [OpenWeatherMap](https://openweathermap.org/api)
- Optional: [Firebase project](https://console.firebase.google.com/) for scan history

### Setup

```bash
# Clone
git clone https://github.com/raj-kapse/KISAN-MITRA.git
cd KISAN-MITRA

# Backend
cd backend
cp .env.example .env    # Fill in your API keys
npm install
npm run dev             # http://localhost:5000

# Frontend (new terminal)
cd frontend
npm install
npm run dev             # http://localhost:5173
```

### Environment Variables

Create `backend/.env` (see `backend/.env.example`):

```env
GROQ_API_KEY=your_groq_api_key          # primary AI (free, no card)
GROQ_MODEL=qwen/qwen3.8-27b
GEMINI_API_KEY=your_gemini_api_key      # automatic fallback
OPENWEATHER_API_KEY=your_openweather_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id   # optional
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json  # optional
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

See `backend/.env.example` for all options, including per-model Gemini failover overrides.

## Project Structure

```
kisan-mitra/
├── backend/
│   ├── server.js                # Express entry point + rate limiting
│   ├── middleware/
│   │   └── rateLimit.js         # In-memory per-IP rate limiter (no deps)
│   ├── routes/
│   │   ├── health.js            # GET  /api/health, /api/ping
│   │   ├── diagnose.js          # POST /api/diagnose (image upload → Groq/Gemini vision chain)
│   │   ├── weather.js           # GET  /api/weather?lat=&lon=
│   │   ├── weatherAdvisory.js   # POST /api/weather-advisory (diagnosis + weather → Groq/Gemini)
│   │   ├── geocode.js           # GET  /api/geocode?q=<city> (manual location fallback)
│   │   ├── history.js           # GET/POST /api/history (device-scoped)
│   │   ├── stores.js            # GET  /api/stores?lat=&lon= (Overpass)
│   │   ├── chat.js              # POST /api/chat (context-aware assistant)
│   │   └── transcribe.js        # POST /api/transcribe (voice → Groq Whisper, Hindi)
│   ├── services/
│   │   ├── gemini.js            # Vision provider chain: Groq Qwen primary → Gemini failover
│   │   ├── textProvider.js      # Text provider chain: Groq primary → Gemini fallback
│   │   ├── weatherService.js    # Weather/geocoding failover: OWM → Open-Meteo (keyless)
│   │   └── firebase.js          # Firestore init + per-device scan queries
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main app — scan flow, tabs, language toggle
│   │   ├── api.js               # Backend API client + device ID
│   │   ├── components/
│   │   │   ├── CameraCapture.jsx    # Camera/upload + client-side compression
│   │   │   ├── DiagnosisResult.jsx  # Disease card + treatment + share/export
│   │   │   ├── WeatherAdvisory.jsx  # Weather + AI advice + city fallback
│   │   │   ├── AgriStoreLocator.jsx # Nearby agri-stores
│   │   │   ├── ScanHistory.jsx      # Per-device history view
│   │   │   ├── Chatbot.jsx          # Floating assistant + voice input (mic → Whisper → spoken reply)
│   │   │   └── VoiceButton.jsx      # TTS read-aloud
│   │   ├── index.css            # Global styles
│   │   └── App.css              # Component styles
│   ├── public/
│   │   ├── manifest.json        # PWA manifest
│   │   ├── favicon.svg, icon-192.png, icon-512.png
│   │   └── samples/             # Demo sample leaf images
│   ├── vite.config.js           # Vite config with /api proxy + PWA plugin
│   └── package.json
│
├── LICENSE                       # MIT
└── README.md
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server status + API key config check |
| `/api/ping` | GET | Minimal latency check |
| `/api/diagnose` | POST | Upload image (multipart, field: `image`) → AI diagnosis JSON *(rate-limited)* |
| `/api/weather?lat=&lon=` | GET | Current weather + 5-day forecast *(rate-limited)* |
| `/api/weather-advisory` | POST | Diagnosis + weather → combined AI guidance *(rate-limited)* |
| `/api/geocode?q=` | GET | City name → coordinates (manual location fallback) |
| `/api/history` | GET | Recent scans (`?deviceId=` scopes to one device) |
| `/api/history` | POST | Save a diagnosis (`deviceId` in body) |
| `/api/stores?lat=&lon=` | GET | Nearby agricultural stores within 20 km |
| `/api/chat` | POST | Context-aware chatbot reply *(rate-limited)* |
| `/api/transcribe` | POST | Voice note (multipart, field: `audio`) → Hindi/English transcript via Groq Whisper *(rate-limited)* |

### Diagnosis Response Shape

```json
{
  "success": true,
  "diagnosis": {
    "disease_name": "Late Blight",
    "disease_name_hi": "पछेती झुलसा",
    "confidence": 0.92,
    "severity": "moderate",
    "description": "...",
    "description_hi": "...",
    "symptoms": ["dark spots on leaves", "white mold"],
    "treatment": {
      "chemical": "Apply Mancozeb 75% WP @ 2.5g/L ...",
      "chemical_hi": "...",
      "organic": "Neem oil spray @ 5ml/L ...",
      "organic_hi": "...",
      "preventive": "Ensure proper spacing ...",
      "preventive_hi": "..."
    },
    "crop_type": "Tomato",
    "yield_risk": "30-40% yield loss if untreated",
    "yield_risk_hi": "..."
  }
}
```

Non-plant images return `disease_name: "Invalid Image"` instead of an error, and low-confidence results (<50%) trigger a "consult a local expert" warning in the UI.

## Hackathon Topic Coverage

**AG-01 — Smart crop disease detection (image processing + ML):**
client-side canvas preprocessing (resize/compress) → Groq-hosted Qwen 3.8-27b multimodal classification (Gemini failover) → structured severity/confidence/treatment output with bilingual delivery and export.

**AG-02 — Localized weather forecasts + crop recommendations:**
geolocation (with city-name fallback) → OpenWeatherMap/Open-Meteo current + 5-day forecast (automatic provider failover) → prompt-chained AI advisory (Groq primary, Gemini fallback) that fuses the diagnosis with the forecast → rule-based tips when AI is unavailable.

## Contributors

|| Name | Role | GitHub ||
|------|------|--------|
| **Raj Kapse** | Backend & API Development | [@raj-kapse](https://github.com/raj-kapse) |
| **Siyal Kambale** | Full-Stack Lead | [@Siyalkamble](https://github.com/Siyalkamble) |
| **Naveen Thakur** | Frontend & PWA | [@nav548777](https://github.com/nav548777) |

## License

MIT — see [LICENSE](LICENSE) for details.
