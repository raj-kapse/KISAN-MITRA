
# 🌾 Kisan Mitra — AI-Powered Crop Health & Advisory System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5+-purple.svg)](https://vitejs.dev/)

> **Empowering Indian farmers with instant crop disease diagnosis and hyper-local weather advisory — reducing preventable crop loss through AI.**

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Solution Overview](#-solution-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Build Phases](#-build-phases)
- [Dataset &amp; Model](#-dataset--model)
- [Contributors](#-contributors)
- [License](#-license)

---

## 🎯 Problem Statement

India's agricultural economy supports **over 60% of its population**, yet farmers continue to lose a significant share of their yield to plant diseases and poor crop-planning decisions:

- **Global Impact**: Up to **40% of crop production** is lost annually to pests and diseases — costing the world economy over **USD 220 billion** a year
- **Domestic Impact**: Indian government estimates put domestic losses at roughly **30%**
- **Root Causes**:
  - 🕐 **Delayed disease diagnosis** — by the time visual symptoms are identified, the disease has already spread
  - 🌦️ **Lack of localized guidance** — farmers rely on generic knowledge rather than real-time, hyper-local weather and crop recommendations
  - 📱 **Accessibility gap** — existing apps are too generic, expensive, or require internet-dependent expert consultation

**Target Users**: Smallholder and marginal farmers, agricultural extension workers, Krishi Vigyan Kendras (KVKs), and cooperative societies

---

## 💡 Solution Overview

**Kisan Mitra** is an accessible, AI-driven mobile-first platform that enables farmers to:

1. 📸 **Photograph a crop leaf** → receive instant disease diagnosis and treatment recommendation
2. 🌤️ **Access hyper-local weather data** → get crop and irrigation guidance tailored to their location
3. 🗣️ **Hear advice in regional languages** → voice output in Hindi and other Indian languages for accessibility

This fused approach (AG-01 + AG-02) reduces preventable crop loss and enables faster, more informed decision-making at the field level.

---

## ✨ Key Features

### Core Features (MVP)

- 📷 **Leaf Disease Detection** — Upload or capture a leaf photo → AI-powered diagnosis in seconds
- 🏥 **Treatment Recommendations** — Actionable, low-cost treatment advice for identified diseases
- 🌦️ **Hyper-local Weather Advisory** — Real-time weather data with crop-specific irrigation and sowing guidance
- 📱 **Mobile-First PWA** — Works on low-end devices, installable, offline-capable UI

### Advanced Features (Phase 3+)

- 🗣️ **Bilingual Voice Output** — Text-to-speech in Hindi and English for farmers with limited literacy
- 📜 **Diagnosis History** — Track past diagnoses and treatments for each plot
- 🗺️ **Outbreak Heatmap** — Village-level disease outbreak early-warning system (stretch goal)
- 🏪 **Nearest Agri-Store** — Link to purchase recommended treatments locally (stretch goal)

---

## 🛠️ Tech Stack

| Layer                 | Technology                           | Purpose                                           |
| :-------------------- | :----------------------------------- | :------------------------------------------------ |
| **Frontend**    | React 18 + Vite                      | Fast, modern UI with PWA support                  |
| **Backend**     | Node.js + Express                    | RESTful API server                                |
| **AI Engine**   | Google Gemini (Multimodal)           | Leaf disease classification and treatment advice  |
| **Weather API** | OpenWeatherMap                       | Hyper-local weather data and forecasts            |
| **Database**    | Firebase / Firestore                 | User history, diagnosis logs, and session storage |
| **Voice**       | Web Speech API                       | Browser-based TTS for Hindi/English output        |
| **Deployment**  | Render (Backend) + Vercel (Frontend) | Free-tier cloud hosting                           |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Farmer (Mobile Browser)                 │
│                    📸 Leaf Photo Upload                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│              📱 PWA • Camera • Voice • Map UI               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ (HTTP POST /api/diagnose)
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node.js + Express)               │
│         🔄 Orchestrates AI + Weather + Database Calls       │
└─────────────────────────────────────────────────────────────┘
           │                          │                    │
           ▼                          ▼                    ▼
┌──────────────────┐    ┌──────────────────┐   ┌──────────────────┐
│   Google Gemini  │    │  OpenWeatherMap  │   │   Firebase       │
│   (AI Inference) │    │   (Weather API)  │   │   (Firestore)    │
└──────────────────┘    └──────────────────┘   └──────────────────┘
```

**Data Flow**:

1. Farmer captures leaf photo → Frontend uploads to backend
2. Backend sends image to Gemini API → receives disease classification + treatment
3. Backend fetches weather data from OpenWeatherMap (using GPS or pincode)
4. Backend merges AI diagnosis + weather advisory → returns to frontend
5. Frontend displays diagnosis card + treatment + weather guidance + voice output

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- API keys for:
  - 🤖 [Google Gemini API](https://makersuite.google.com/)
  - 🌤️ [OpenWeatherMap API](https://openweathermap.org/api)
  - 🔥 [Firebase Project](https://console.firebase.google.com/)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/kisan-mitra.git
cd kisan-mitra

# 2. Backend setup
cd backend
cp .env.example .env    # Fill in your API keys
npm install
npm run dev             # Runs on http://localhost:5000

# 3. Frontend setup (new terminal)
cd frontend
npm install
npm run dev             # Runs on http://localhost:5173
```

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
GEMINI_API_KEY=your_gemini_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
PORT=5000
```

---

## 📁 Project Structure

```
kisan-mitra/
├── backend/
│   ├── server.js          # Express entry point
│   ├── routes/
│   │   ├── diagnose.js    # AI diagnosis endpoint
│   │   └── weather.js     # Weather advisory endpoint
│   ├── services/
│   │   ├── gemini.js      # Gemini API client
│   │   └── openweather.js # OpenWeatherMap client
│   ├── middleware/
│   │   └── auth.js        # Optional JWT auth
│   ├── .env.example       # Environment variable template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main app component
│   │   ├── components/
│   │   │   ├── Camera.jsx # Leaf photo capture
│   │   │   ├── DiagnosisCard.jsx # Results display
│   │   │   ├── WeatherWidget.jsx # Weather advisory
│   │   │   └── VoiceOutput.jsx # TTS player
│   │   ├── api.js         # Backend API client
│   │   ├── index.css      # Global styles
│   │   └── App.css        # Component styles
│   ├── public/
│   │   ├── manifest.json  # PWA manifest
│   │   └── icons/         # App icons
│   ├── vite.config.js     # Vite config with API proxy
│   └── package.json
│
├── docs/
│   ├── architecture.md    # Detailed system design
│   └── api.md             # API documentation
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## 📡 API Reference

### Diagnose Leaf Disease

**Endpoint**: `POST /api/diagnose`

**Request**:

```json
{
  "image": "base64_encoded_image_string",
  "crop_type": "tomato",
  "location": {
    "lat": 18.5204,
    "lon": 73.8567
  }
}
```

**Response**:

```json
{
  "disease": "Tomato Early Blight",
  "confidence": 0.94,
  "treatment": "Apply copper-based fungicide. Remove infected leaves. Improve air circulation.",
  "severity": "moderate",
  "weather_advisory": {
    "temperature": 28,
    "humidity": 65,
    "rainfall_probability": 20,
    "irrigation_recommendation": "Light irrigation in the morning. Avoid evening watering."
  }
}
```

### Get Weather Advisory

**Endpoint**: `GET /api/weather?lat=18.5204&lon=73.8567&crop=tomato`

**Response**:

```json
{
  "location": "Pune, Maharashtra",
  "current": {
    "temp": 28,
    "humidity": 65,
    "condition": "Partly Cloudy"
  },
  "forecast": [
    { "date": "2026-09-17", "temp_max": 30, "rain_prob": 10 },
    { "date": "2026-09-18", "temp_max": 29, "rain_prob": 30 }
  ],
  "crop_advisory": "Optimal conditions for tomato growth. Monitor for early blight symptoms due to moderate humidity."
}
```

---

## 📅 Build Phases

| Phase             | Status         | Deliverables                                                    |
| :---------------- | :------------- | :-------------------------------------------------------------- |
| **Phase 1** | ✅ Complete    | Skeleton, API keys, frontend ↔ backend round-trip              |
| **Phase 2** | 🚧 In Progress | Core features (photo capture, AI diagnosis, treatment, weather) |
| **Phase 3** | ⏳ Pending     | Advanced features (bilingual, voice, history)                   |
| **Phase 4** | ⏳ Pending     | Stretch goals (map, outbreaks, WhatsApp integration)            |

---

## 📊 Dataset & Model

### Dataset

- **Primary**: [PlantVillage Dataset](https://www.kaggle.com/datasets/emmarex/plantdisease) — 50,000+ labeled leaf images across 14 crop species and 38 disease classes
- **Supplementary**: Crop-specific Kaggle datasets (tomato, rice, wheat diseases)

### Model

- **Architecture**: Transfer learning on **MobileNetV2** (lightweight, mobile-friendly)
- **Training**: Fine-tuned on PlantVillage with Adam optimizer
- **Expected Accuracy**: ~94-98% validation accuracy (based on published benchmarks)
- **Inference**: Hosted via Google Gemini multimodal API for MVP; custom model deployment planned for Phase 4

---

## 👥 Contributors

| Name                    | Role                            | GitHub                                       |
| :---------------------- | :------------------------------ | :------------------------------------------- |
| **Siyal Kambale** | Full-Stack Lead, AI Integration | [@siyal](https://github.com/your-username)    |
| **Raj**           | Backend & API Development       | [@raj](https://github.com/raj-username)       |
| **Naveen**        | Frontend & PWA Development      | [@naveen](https://github.com/naveen-username) |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — feel free to use, modify, and distribute for educational and non-commercial purposes.

---

## 🙏 Acknowledgments

- 🌍 **FAO Plant Production and Protection** — Global crop loss statistics
- 🇮🇳 **Ministry of Agriculture, India** — Domestic agricultural loss estimates
- 📸 **PlantVillage Dataset** — Open-access leaf disease image repository
- 🌤️ **OpenWeatherMap** — Free-tier weather API for agricultural advisory

---

<div align="center">
