/**
 * DiagnosisResult — Displays the AI diagnosis results with bilingual toggle
 *
 * Shows:
 * - Disease name with confidence badge
 * - Severity indicator
 * - Description of what was detected
 * - Treatment recommendations (chemical, organic, preventive)
 * - Crop type identification
 * - Language toggle (English / Hindi) — uses *_hi fields from API response
 *
 * Handles confidence-based styling (green for high, yellow for medium, red for low).
 */

import AgriStoreLocator from './AgriStoreLocator';
import './DiagnosisResult.css';

function getConfidenceClass(confidence) {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function getSeverityInfo(severity, lang) {
  const map = {
    mild:     { emoji: '🟢', label: lang === 'hi' ? 'हल्का' : 'Mild' },
    moderate: { emoji: '🟡', label: lang === 'hi' ? 'मध्यम' : 'Moderate' },
    severe:   { emoji: '🔴', label: lang === 'hi' ? 'गंभीर' : 'Severe' },
  };
  return map[severity] || { emoji: '⚪', label: severity || 'Unknown' };
}

function DiagnosisResult({ diagnosis, lang = 'en' }) {
  if (!diagnosis) return null;

  const isHi = lang === 'hi';
  const {
    disease_name, disease_name_hi,
    confidence, severity,
    description, description_hi,
    symptoms, treatment, crop_type,
  } = diagnosis;

  const confClass = getConfidenceClass(confidence);
  const sevInfo = getSeverityInfo(severity, lang);
  const confPercent = Math.round((confidence || 0) * 100);
  const isHealthy = disease_name?.toLowerCase() === 'healthy';

  // Pick the right language field, falling back to English
  const displayName = isHi ? (disease_name_hi || disease_name) : disease_name;
  const displayDesc = isHi ? (description_hi || description) : description;

  return (
    <div className="diagnosis-result glass-panel animate-slide-up">
      {/* Header — disease name + confidence */}
      <div className={`diagnosis-header ${isHealthy ? 'healthy' : 'diseased'}`}>
        <div className="diagnosis-title">
          <span className="crop-badge">{isHealthy ? '✅' : '🔬'} {crop_type || 'Crop'}</span>
          <h3 className="disease-name">{displayName || 'Unknown'}</h3>
        </div>
        <div className={`confidence-badge ${confClass}`}>
          {confPercent}%
        </div>
      </div>

      {/* Low-confidence warning */}
      {confidence < 0.5 && (
        <div className="low-confidence-warning">
          {isHi
            ? '⚠️ कम विश्वास — कृपया सटीक निदान के लिए स्थानीय कृषि विशेषज्ञ से परामर्श करें।'
            : '⚠️ Low confidence — please consult a local agricultural expert for accurate diagnosis.'
          }
        </div>
      )}

      {/* Severity */}
      {!isHealthy && severity && (
        <div className="info-row severity-row">
          <span className="info-label">{isHi ? 'गंभीरता' : 'Severity'}</span>
          <span className="severity-badge">
            {sevInfo.emoji} {sevInfo.label}
          </span>
        </div>
      )}

      {/* Yield Risk */}
      {!isHealthy && diagnosis.yield_risk && (
        <div className="info-row yield-risk-row">
          <span className="info-label">{isHi ? 'आर्थिक जोखिम' : 'Economic Risk'}</span>
          <span className="yield-risk-badge">
            ⚠️ {isHi ? (diagnosis.yield_risk_hi || diagnosis.yield_risk) : diagnosis.yield_risk}
          </span>
        </div>
      )}

      {/* Description */}
      {displayDesc && (
        <div className="diagnosis-section">
          <h4>{isHi ? '📋 विश्लेषण' : '📋 Analysis'}</h4>
          <p>{displayDesc}</p>
        </div>
      )}

      {/* Symptoms */}
      {symptoms && symptoms.length > 0 && (
        <div className="diagnosis-section">
          <h4>{isHi ? '🔍 लक्षण' : '🔍 Symptoms Detected'}</h4>
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
          <h4>{isHi ? '💊 उपचार' : '💊 Treatment'}</h4>

          {(isHi ? treatment.chemical_hi : treatment.chemical) && (
            <div className="treatment-card chemical">
              <span className="treatment-type">{isHi ? '🧪 रासायनिक' : '🧪 Chemical'}</span>
              <p>{isHi ? (treatment.chemical_hi || treatment.chemical) : treatment.chemical}</p>
            </div>
          )}

          {(isHi ? treatment.organic_hi : treatment.organic) && (
            <div className="treatment-card organic">
              <span className="treatment-type">{isHi ? '🌱 जैविक' : '🌱 Organic'}</span>
              <p>{isHi ? (treatment.organic_hi || treatment.organic) : treatment.organic}</p>
            </div>
          )}

          {(isHi ? treatment.preventive_hi : treatment.preventive) && (
            <div className="treatment-card preventive">
              <span className="treatment-type">{isHi ? '🛡️ रोकथाम' : '🛡️ Prevention'}</span>
              <p>{isHi ? (treatment.preventive_hi || treatment.preventive) : treatment.preventive}</p>
            </div>
          )}

          <AgriStoreLocator lang={lang} />
        </div>
      )}

      {/* Healthy plant message */}
      {isHealthy && (
        <div className="healthy-message">
          {isHi
            ? '🎉 बढ़िया खबर! आपकी फसल स्वस्थ दिख रही है। अच्छी खेती की आदतें जारी रखें!'
            : '🎉 Great news! Your crop looks healthy. Keep up the good farming practices!'
          }
        </div>
      )}

      {/* Action Bar: WhatsApp and Print */}
      <div className="diagnosis-actions no-print">
        <button 
          className="action-btn whatsapp-btn" 
          onClick={() => {
            const text = `🌾 Kisan Mitra Report\nCrop: ${crop_type || 'Unknown'}\nDiagnosis: ${displayName}\nConfidence: ${confPercent}%\n\nAdvice:\n${displayDesc}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }}
        >
          {isHi ? '💬 WhatsApp पर शेयर करें' : '💬 Share on WhatsApp'}
        </button>
        <button 
          className="action-btn print-btn" 
          onClick={() => window.print()}
        >
          {isHi ? '🖨️ रिपोर्ट डाउनलोड/प्रिंट करें' : '🖨️ Download/Print Report'}
        </button>
      </div>
    </div>
  );
}

export default DiagnosisResult;
