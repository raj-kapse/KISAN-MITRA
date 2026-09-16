/**
 * Kisan Mitra — Main App Component (Phase 1)
 *
 * Displays a connectivity dashboard that:
 * 1. Pings the backend /api/health endpoint
 * 2. Shows connection status with latency
 * 3. Reports which API keys are configured
 *
 * This validates the full frontend ↔ backend round-trip.
 */

import { useState } from 'react';
import { checkHealth } from './api';
import './App.css';

function App() {
  // Connection state
  const [status, setStatus] = useState('idle'); // idle | loading | connected | error
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);

  /**
   * Performs a health check against the backend.
   * Measures round-trip latency and displays service status.
   */
  const runHealthCheck = async () => {
    setStatus('loading');
    setError(null);
    const start = performance.now();

    try {
      const data = await checkHealth();
      const elapsed = Math.round(performance.now() - start);

      setHealthData(data);
      setLatency(elapsed);
      setStatus('connected');
    } catch (err) {
      setError(err.message);
      setStatus('error');
      setHealthData(null);
      setLatency(null);
    }
  };

  /**
   * Returns a human-readable label + CSS class for a service status.
   */
  const getServiceDisplay = (service) => {
    if (!service) return { label: '—', className: '' };
    return service.configured
      ? { label: '✅ Ready', className: 'ready' }
      : { label: '❌ Key missing', className: 'missing' };
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1>🌾 Kisan Mitra</h1>
        <p className="subtitle">AI Crop Health & Advisory</p>
      </header>

      {/* Main content */}
      <main className="app-main">
        <div className="status-card">
          <h2>System Status</h2>

          {/* Connection indicator */}
          <div className="status-indicator">
            <span
              className={`status-dot ${
                status === 'connected'
                  ? 'connected'
                  : status === 'loading'
                  ? 'loading'
                  : status === 'error'
                  ? 'disconnected'
                  : ''
              }`}
            />
            <span className="status-label">
              {status === 'idle' && 'Press button to check backend connection'}
              {status === 'loading' && 'Connecting to backend…'}
              {status === 'connected' && 'Backend connected'}
              {status === 'error' && 'Connection failed'}
            </span>
          </div>

          {/* Service details (shown after successful check) */}
          {healthData?.services && (
            <div className="status-details">
              {[
                { key: 'gemini', label: 'Gemini AI' },
                { key: 'openweather', label: 'OpenWeather' },
                { key: 'firebase', label: 'Firebase' },
              ].map(({ key, label }) => {
                const display = getServiceDisplay(healthData.services[key]);
                return (
                  <div className="service-row" key={key}>
                    <span className="service-name">{label}</span>
                    <span className={`service-status ${display.className}`}>
                      {display.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Latency */}
          {latency !== null && (
            <p className="latency">Round-trip: {latency}ms</p>
          )}

          {/* Error message */}
          {error && (
            <div className="error-msg">
              <strong>Error:</strong> {error}
              <br />
              <small>Make sure the backend is running on port 5000.</small>
            </div>
          )}

          {/* Action button */}
          <button
            className="check-btn"
            onClick={runHealthCheck}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Checking…' : 'Check Backend Connection'}
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        Kisan Mitra · Phase 1 · Skeleton & Connectivity
      </footer>
    </div>
  );
}

export default App;
