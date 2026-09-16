# 🌾 Kisan Mitra — AI Crop Health & Advisory App

> **Instant crop disease diagnosis and hyper-local weather advisory for Indian farmers, powered by Google Gemini's multimodal AI.**

## What It Does

A farmer photographs a crop leaf → the app identifies the disease in seconds, suggests treatment (chemical + organic + preventive), shows local weather with crop-specific guidance, and reads the advisory aloud in Hindi or English. No training pipeline, no model hosting — Gemini handles the vision + language in a single API call.

## Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| 📷 Leaf Disease Detection | ✅ Working | Upload/capture a leaf photo → AI diagnosis in <5 seconds |
| 💊 Treatment Recommendations | ✅ Working | Chemical, organic, and preventive options with dosages |
| 🌦️ Weather Advisory | ✅ Working | Current conditions + 5-day forecast, crop-specific guidance |
| 🗣️ Bilingual Output | ✅ Working | English + Hindi toggle for all diagnosis and treatment text |
| 🔊 Voice Read-Aloud | ✅ Working | Web Speech API TTS in Hindi or English |
| 📜 Scan History | ✅ Working | Past diagnoses saved to Firestore, viewable in-app |
| ⚠️ Confidence Warnings | ✅ Working | Low-confidence results flagged with "consult an expert" |
| 📱 Mobile-First PWA | ✅ Working | Installable, works on low-end Android devices |

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React + Vite (PWA) | Fast dev, small bundle, mobile-first |
| **Backend** | Node.js + Express | Quick to scaffold, async I/O |
| **AI Engine** | Google Gemini 2.5 Flash (multimodal) | No model hosting needed — one API call returns diagnosis + confidence + treatment + Hindi translation as structured JSON |
| **Weather** | OpenWeatherMap | Free tier, 5-day forecast, metric units |
| **Database** | Firebase / Firestore | Real-time, free tier, no server-side DB management |
| **Voice** | Web Speech API | Browser-native TTS, zero extra infra, Hindi support |

### Why Gemini Instead of a Custom Model

Traditional plant disease classifiers require training a CNN (e.g. MobileNetV2) on labeled datasets like PlantVillage, hosting the model, and maintaining a fixed set of disease classes. We chose a different approach:

- **Gemini's multimodal API** accepts a raw leaf image and returns a diagnosis directly — no training pipeline, no model weights to manage, no GPU hosting
- A single API call returns disease name, confidence, severity, symptoms, treatment options, and crop identification — all as structured JSON
- Hindi translations are generated in the same call, not through a separate translation layer
- The model generalises to crops and diseases beyond any fixed training set
- Trade-off: requires network connectivity and depends on Gemini's availability. For a hackathon prototype targeting connected users, this is the right call

## Quick Start

### Prerequisites
- Node.js 18+
- API keys: [Google Gemini](https://aistudio.google.com/apikey), [OpenWeatherMap](https://openweathermap.org/api) (free tier)
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

Create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id   # optional
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Project Structure

```
kisan-mitra/
├── backend/
│   ├── server.js                # Express entry point
│   ├── routes/
│   │   ├── health.js            # GET /api/health
│   │   ├── diagnose.js          # POST /api/diagnose (image upload → Gemini)
│   │   ├── weather.js           # GET /api/weather?lat=&lon=
│   │   └── history.js           # GET/POST /api/history
│   ├── services/
│   │   ├── gemini.js            # Gemini 2.5 Flash multimodal client
│   │   └── firebase.js          # Firestore initialisation
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main app — scan flow
│   │   ├── api.js               # Backend API client
│   │   ├── components/
│   │   │   ├── CameraCapture.jsx    # Photo capture / upload
│   │   │   ├── DiagnosisResult.jsx  # Disease card + treatment
│   │   │   ├── WeatherAdvisory.jsx  # Weather display + crop guidance
│   │   │   ├── ScanHistory.jsx      # Past diagnosis list
│   │   │   └── VoiceButton.jsx      # TTS read-aloud
│   │   ├── index.css            # Global styles
│   │   └── App.css              # Component styles
│   ├── public/
│   │   ├── manifest.json        # PWA manifest
│   │   └── favicon.svg
│   ├── vite.config.js           # Vite config with /api proxy
│   └── package.json
│
├── .gitignore
└── README.md
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server status + API key config check |
| `/api/diagnose` | POST | Upload image (multipart, field: `image`) → AI diagnosis JSON |
| `/api/weather?lat=&lon=` | GET | Current weather + 5-day forecast for coordinates |
| `/api/history` | GET | Retrieve past scan history |
| `/api/history` | POST | Save a diagnosis to Firestore |

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
    "crop_type": "Tomato"
  }
}
```

## Contributors

| Name | Role | GitHub |
|------|------|--------|
| **Raj Kapse** | Backend & API Development | [@raj-kapse](https://github.com/raj-kapse) |
| **Siyal Kambale** | Full-Stack Lead | [@Siyalkamble](https://github.com/Siyalkamble) |
| **Naveen Thakur** | Frontend & PWA | [@nav54877](https://github.com/nav54877) |

## License

MIT — see [LICENSE](LICENSE) for details.
