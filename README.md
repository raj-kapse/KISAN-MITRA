# 🌾 Kisan Mitra — AI Crop Health & Advisory App

An AI-powered mobile-first web app that helps Indian farmers diagnose crop
diseases from leaf photos and get weather-based agricultural advisory.

## Tech Stack

| Layer     | Technology                       |
| --------- | -------------------------------- |
| Frontend  | React + Vite (PWA)               |
| Backend   | Node.js + Express                |
| AI Engine | Google Gemini (multimodal)       |
| Weather   | OpenWeatherMap API               |
| Database  | Firebase / Firestore             |
| Voice     | Web Speech API (browser TTS)     |

## Quick Start

### Prerequisites
- Node.js 18+
- API keys for: Gemini, OpenWeatherMap, Firebase

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd kisan-mitra

# 2. Backend setup
cd backend
cp .env.example .env    # Fill in your API keys
npm install
npm run dev

# 3. Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:5000`.

## Project Structure

```
kisan-mitra/
├── backend/
│   ├── server.js          # Express entry point
│   ├── routes/            # API route handlers
│   ├── .env.example       # Environment variable template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main app component
│   │   ├── api.js         # Backend API client
│   │   ├── index.css      # Global styles
│   │   └── App.css        # Component styles
│   ├── public/            # Static assets & PWA manifest
│   ├── vite.config.js     # Vite config with API proxy
│   └── package.json
├── .gitignore
└── README.md
```

## Build Phases

- [x] **Phase 1** — Skeleton & keys (frontend ↔ backend round-trip)
- [ ] **Phase 2** — Core features (photo capture, AI diagnosis, treatment, weather)
- [ ] **Phase 3** — Advanced features (bilingual, voice, history)
- [ ] **Phase 4** — Stretch goals (map, outbreaks, WhatsApp)
