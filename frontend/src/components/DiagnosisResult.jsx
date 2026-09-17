/**
 * DiagnosisResult — Displays the AI diagnosis results
 *
 * Shows (in English / Hindi / Marathi):
 * - Disease name with confidence badge
 * - Severity indicator + economic yield risk
 * - Description of what was detected
 * - Symptoms detected in the image
 * - Next steps: a numbered, chronological action plan for the farmer
 * - Treatment recommendations (chemical, organic, preventive)
 * - Extra practical tips
 * - Nearby agri-store locator
 *
 * Language fields come straight from the AI response (*_hi / *_mr),
 * falling back to English when a translation is missing.
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
    mild:     { emoji: '🟢', label: { en: 'Mild', hi: 'हल्का', mr: 'हलका' }[lang] || 'Mild' },
    moderate: { emoji: '🟡', label: { en: 'Moderate', hi: 'मध्यम', mr: 'मध्यम' }[lang] || 'Moderate' },
    severe:   { emoji: '🔴', label: { en: 'Severe', hi: 'गंभीर', mr: 'गंभीर' }[lang] || 'Severe' },
  };
  return map[severity] || { emoji: '⚪', label: severity || 'Unknown' };
}

function DiagnosisResult({ diagnosis, lang = 'en' }) {
  if (!diagnosis) return null;

  const {
    disease_name, disease_name_hi, disease_name_mr,
    confidence, severity,
    description, description_hi, description_mr,
    symptoms,
    next_steps, next_steps_hi, next_steps_mr,
    extra_tips, extra_tips_hi, extra_tips_mr,
    treatment, crop_type,
  } = diagnosis;

  const confClass = getConfidenceClass(confidence);
  const sevInfo = getSeverityInfo(severity, lang);
  const confPercent = Math.round((confidence || 0) * 100);
  const isHealthy = disease_name?.toLowerCase() === 'healthy';

  // Language labels for section headings and UI strings
  const L = {
    analysis: { en: '📋 Analysis', hi: '📋 विश्लेषण', mr: '📋 विश्लेषण' },
    symptoms: { en: '🔍 Symptoms Detected', hi: '🔍 लक्षण', mr: '🔍 लक्षणे' },
    nextSteps: { en: '✅ What to do — step by step', hi: '✅ क्या करें — क्रम से', mr: '✅ काय करावे — क्रमाने' },
    treatment: { en: '💊 Treatment', hi: '💊 उपचार', mr: '💊 उपचार' },
    chemical: { en: '🧪 Chemical', hi: '🧪 रासायनिक', mr: '🧪 रासायनिक' },
    organic: { en: '🌱 Organic', hi: '🌱 जैविक', mr: '🌱 सेंद्रिय' },
    prevention: { en: '🛡️ Prevention', hi: '🛡️ रोकथाम', mr: '🛡️ प्रतिबंध' },
    tips: { en: '💡 Extra Tips', hi: '💡 अतिरिक्त सुझाव', mr: '💡 अतिरिक्त टिप्स' },
    lowConf: {
      en: '⚠️ Low confidence — please consult a local agricultural expert for accurate diagnosis.',
      hi: '⚠️ कम विश्वास — कृपया सटीक निदान के लिए स्थानीय कृषि विशेषज्ञ से परामर्श करें।',
      mr: '⚠️ कमी विश्वास — अचूक निदानासाठी कृपया स्थानिक कृषी तज्ज्ञांचा सल्ला घ्या.',
    },
    healthy: {
      en: '🎉 Great news! Your crop looks healthy. Keep up the good farming practices!',
      hi: '🎉 बढ़िया खबर! आपकी फसल स्वस्थ दिख रही है। अच्छी खेती की आदतें जारी रखें!',
      mr: '🎉 आनंदाची बातमी! तुमचे पीक निरोगी दिसते आहे. चांगल्या शेती पद्धती सुरू ठेवा!',
    },
  }[lang] || {};

  // Pick the field for the active language with graceful fallbacks
  const pick = (en, hi, mr) =>
    lang === 'hi' ? (hi ?? en) : lang === 'mr' ? (mr ?? hi ?? en) : en;

  const displayName = pick(disease_name, disease_name_hi, disease_name_mr);
  const displayDesc = pick(description, description_hi, description_mr);
  // H7: the LLM sometimes returns a single string where the prompt asks for
  // an array (or vice versa). Normalise so `.map` can never crash the view.
  const toArray = (v) => {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === 'string' && v.trim()) return [v.trim()];
    return [];
  };
  const steps = toArray(pick(next_steps, next_steps_hi, next_steps_mr));
  const tips = toArray(pick(extra_tips, extra_tips_hi, extra_tips_mr));
  const symptomsList = toArray(symptoms);

  const chemText = treatment ? pick(treatment.chemical, treatment.chemical_hi, treatment.chemical_mr) : null;
  const orgText = treatment ? pick(treatment.organic, treatment.organic_hi, treatment.organic_mr) : null;
  const prevText = treatment ? pick(treatment.preventive, treatment.preventive_hi, treatment.preventive_mr) : null;
  const yieldText = pick(diagnosis.yield_risk, diagnosis.yield_risk_hi, diagnosis.yield_risk_mr);

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
        <div className="low-confidence-warning">{L.lowConf}</div>
      )}

      {/* Severity */}
      {!isHealthy && severity && (
        <div className="info-row severity-row">
          <span className="info-label">{lang === 'hi' ? 'गंभीरता' : lang === 'mr' ? 'गंभीरता' : 'Severity'}</span>
          <span className="severity-badge">
            {sevInfo.emoji} {sevInfo.label}
          </span>
        </div>
      )}

      {/* Yield Risk */}
      {!isHealthy && yieldText && (
        <div className="info-row yield-risk-row">
          <span className="info-label">{lang === 'hi' ? 'आर्थिक जोखिम' : lang === 'mr' ? 'आर्थिक धोका' : 'Economic Risk'}</span>
          <span className="yield-risk-badge">⚠️ {yieldText}</span>
        </div>
      )}

      {/* Description */}
      {displayDesc && (
        <div className="diagnosis-section">
          <h4>{L.analysis}</h4>
          <p>{displayDesc}</p>
        </div>
      )}

      {/* Symptoms */}
      {symptomsList.length > 0 && (
        <div className="diagnosis-section">
          <h4>{L.symptoms}</h4>
          <ul className="symptoms-list">
            {symptomsList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps — numbered chronological action plan */}
      {steps.length > 0 && (
        <div className="diagnosis-section next-steps-section">
          <h4>{L.nextSteps}</h4>
          <ol className="next-steps-list">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Treatment recommendations */}
      {treatment && !isHealthy && (
        <div className="diagnosis-section treatment-section">
          <h4>{L.treatment}</h4>

          {chemText && (
            <div className="treatment-card chemical">
              <span className="treatment-type">{L.chemical}</span>
              <p>{chemText}</p>
            </div>
          )}

          {orgText && (
            <div className="treatment-card organic">
              <span className="treatment-type">{L.organic}</span>
              <p>{orgText}</p>
            </div>
          )}

          {prevText && (
            <div className="treatment-card preventive">
              <span className="treatment-type">{L.prevention}</span>
              <p>{prevText}</p>
            </div>
          )}

          <AgriStoreLocator lang={lang} />
        </div>
      )}

      {/* Extra practical tips */}
      {tips.length > 0 && !isHealthy && (
        <div className="diagnosis-section tips-section">
          <h4>{L.tips}</h4>
          <ul className="tips-list">
            {tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Healthy plant message */}
      {isHealthy && (
        <div className="healthy-message">{L.healthy}</div>
      )}

      {/* Action Bar: WhatsApp and Print */}
      <div className="diagnosis-actions no-print">
        <button
          className="action-btn whatsapp-btn"
          onClick={() => {
            const text = `🌾 Kisan Mitra Report\nCrop: ${crop_type || 'Unknown'}\nDiagnosis: ${displayName}\nConfidence: ${confPercent}%\n${!isHealthy && severity ? `Severity: ${sevInfo.label}\n` : ''}\nAdvice:\n${displayDesc || ''}\n\nSteps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${chemText ? `\n\nChemical treatment: ${chemText}` : ''}${orgText ? `\nOrganic treatment: ${orgText}` : ''}${prevText ? `\nPrevention: ${prevText}` : ''}\n\n— shared via Kisan Mitra app`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }}
        >
          {lang === 'hi' ? '💬 WhatsApp पर शेयर करें' : lang === 'mr' ? '💬 व्हाट्सअॅवर शेयर करा' : '💬 Share on WhatsApp'}
        </button>
        <button
          className="action-btn print-btn"
          onClick={() => window.print()}
        >
          {lang === 'hi' ? '🖨️ रिपोर्ट डाउनलोड/प्रिंट करें' : lang === 'mr' ? '🖨️ अहवाल डाउनलोड/प्रिंट करा' : '🖨️ Download/Print Report'}
        </button>
      </div>
    </div>
  );
}

export default DiagnosisResult;
