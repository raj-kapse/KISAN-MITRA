/**
 * Kisan Mitra — Main App Component (Phase 2)
 *
 * Core flow:
 * 1. User captures/uploads a crop leaf photo
 * 2. Photo is sent to backend → Gemini AI for diagnosis
 * 3. Results displayed: disease, confidence, treatment, symptoms
 * 4. User can scan again for another diagnosis
 */

import { useState } from 'react';
import CameraCapture from './components/CameraCapture';
import DiagnosisResult from './components/DiagnosisResult';
import { diagnoseCrop } from './api';
import './App.css';

function App() {
  // Image state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  // Diagnosis state
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Handle image selection from CameraCapture component.
   * Stores the File object and creates a preview URL.
   */
  const handleImageSelected = (file) => {
    if (file) {
      setSelectedImage(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      // Clear previous results when a new image is selected
      setDiagnosis(null);
      setError(null);
    } else {
      setSelectedImage(null);
      setImagePreviewUrl(null);
    }
  };

  /**
   * Submit the selected image for AI diagnosis.
   * Calls the backend /api/diagnose endpoint.
   */
  const handleDiagnose = async () => {
    if (!selectedImage) return;

    setLoading(true);
    setError(null);
    setDiagnosis(null);

    try {
      const result = await diagnoseCrop(selectedImage);
      if (result.success && result.diagnosis) {
        setDiagnosis(result.diagnosis);
      } else {
        throw new Error(result.error || 'Unexpected response from server');
      }
    } catch (err) {
      console.error('Diagnosis error:', err);
      setError(err.message || 'Failed to analyze image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset everything for a new scan.
   */
  const handleScanAgain = () => {
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setDiagnosis(null);
    setError(null);
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

        {/* Step 1: Capture / Upload */}
        {!diagnosis && (
          <>
            <CameraCapture
              onImageSelected={handleImageSelected}
              disabled={loading}
            />

            {/* Diagnose button — shown only when image is selected */}
            {selectedImage && (
              <button
                className="diagnose-btn"
                onClick={handleDiagnose}
                disabled={loading}
              >
                {loading ? (
                  <span className="loading-content">
                    <span className="spinner" />
                    Analyzing...
                  </span>
                ) : (
                  '🔬 Analyze Crop'
                )}
              </button>
            )}
          </>
        )}

        {/* Error display */}
        {error && (
          <div className="error-msg">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Step 2: Results */}
        {diagnosis && (
          <>
            {/* Show the scanned image at the top of results */}
            {imagePreviewUrl && (
              <div className="scanned-image-container">
                <img
                  src={imagePreviewUrl}
                  alt="Scanned crop"
                  className="scanned-image"
                />
              </div>
            )}

            <DiagnosisResult diagnosis={diagnosis} />

            {/* Scan again button */}
            <button className="scan-again-btn" onClick={handleScanAgain}>
              📸 Scan Another Crop
            </button>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        Kisan Mitra · AI-powered crop advisory for Indian farmers
      </footer>
    </div>
  );
}

export default App;
