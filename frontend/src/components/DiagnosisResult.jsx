/**
 * DiagnosisResult — Displays the AI diagnosis results
 *
 * Shows:
 * - Disease name with confidence badge
 * - Severity indicator
 * - Description of what was detected
 * - Treatment recommendations (chemical, organic, preventive)
 * - Crop type identification
 *
 * Handles confidence-based styling (green for high, yellow for medium, red for low).
 */

import './DiagnosisResult.css';

/**
 * Returns a color class based on confidence level.
 */
function getConfidenceClass(confidence) {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Returns severity display info.
 */
function getSeverityInfo(severity) {
  const map = {
    mild: { emoji: '🟢', label: 'Mild' },
    moderate: { emoji: '🟡', label: 'Moderate' },
    severe: { emoji: '🔴', label: 'Severe' },
  };
  return map[severity] || { emoji: '⚪', label: severity || 'Unknown' };
}

function DiagnosisResult({ diagnosis }) {
  if (!diagnosis) return null;

  const {
    disease_name,
    confidence,
    severity,
    description,
    symptoms,
    treatment,
    crop_type,
  } = diagnosis;

  const confClass = getConfidenceClass(confidence);
  const sevInfo = getSeverityInfo(severity);
  const confPercent = Math.round((confidence || 0) * 100);
  const isHealthy = disease_name?.toLowerCase() === 'healthy';

  return (
    <div className="diagnosis-result">
      {/* Header — disease name + confidence */}
      <div className={`diagnosis-header ${isHealthy ? 'healthy' : 'diseased'}`}>
        <div className="diagnosis-title">
          <span className="diagnosis-emoji">{isHealthy ? '✅' : '🔬'}</span>
          <div>
            <h3 className="disease-name">{disease_name || 'Unknown'}</h3>
            {crop_type && (
              <span className="crop-badge">🌿 {crop_type}</span>
            )}
          </div>
        </div>
        <div className={`confidence-badge ${confClass}`}>
          {confPercent}%
        </div>
      </div>

      {/* Low-confidence warning */}
      {confidence < 0.5 && (
        <div className="low-confidence-warning">
          ⚠️ Low confidence — please consult a local agricultural expert for
          accurate diagnosis.
        </div>
      )}

      {/* Severity */}
      {!isHealthy && severity && (
        <div className="info-row severity-row">
          <span className="info-label">Severity</span>
          <span className="severity-badge">
            {sevInfo.emoji} {sevInfo.label}
          </span>
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="diagnosis-section">
          <h4>📋 Analysis</h4>
          <p>{description}</p>
        </div>
      )}

      {/* Symptoms */}
      {symptoms && symptoms.length > 0 && (
        <div className="diagnosis-section">
          <h4>🔍 Symptoms Detected</h4>
          <ul className="symptoms-list">
            {symptoms.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Treatment recommendations */}
      {treatment && !isHealthy && (
        <div className="diagnosis-section treatment-section">
          <h4>💊 Treatment</h4>

          {treatment.chemical && (
            <div className="treatment-card chemical">
              <span className="treatment-type">🧪 Chemical</span>
              <p>{treatment.chemical}</p>
            </div>
          )}

          {treatment.organic && (
            <div className="treatment-card organic">
              <span className="treatment-type">🌱 Organic</span>
              <p>{treatment.organic}</p>
            </div>
          )}

          {treatment.preventive && (
            <div className="treatment-card preventive">
              <span className="treatment-type">🛡️ Prevention</span>
              <p>{treatment.preventive}</p>
            </div>
          )}
        </div>
      )}

      {/* Healthy plant message */}
      {isHealthy && (
        <div className="healthy-message">
          🎉 Great news! Your crop looks healthy. Keep up the good farming
          practices!
        </div>
      )}
    </div>
  );
}

export default DiagnosisResult;
