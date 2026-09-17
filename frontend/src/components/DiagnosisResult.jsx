/**
 * DiagnosisResult — displays the AI diagnosis results
 *
 * Confidence as an SVG progress ring, severity/economic-risk pill chips,
 * Lucide-icon section headers, treatment cards with colored left bars,
 * and a sticky action bar (WhatsApp share + print).
 *
 * Language fields come straight from the AI response (*_hi / *_mr),
 * falling back to English when a translation is missing. Array fields
 * are normalised so a drifting LLM shape can't crash the view.
 */

import {
  ClipboardList, Search, ListOrdered, FlaskConical, Sprout, Shield,
  Lightbulb, ShieldAlert, AlertTriangle, CheckCircle2, Share2, Printer,
} from 'lucide-react';
import AgriStoreLocator from './AgriStoreLocator';
import './DiagnosisResult.css';

function getConfidenceClass(confidence) {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function getSeverityInfo(severity, lang) {
  const map = {
    mild:     { emoji: null, label: { en: 'Mild', hi: 'हल्का', mr: 'हलका' }[lang] || 'Mild' },
    moderate: { emoji: null, label: { en: 'Moderate', hi: 'मध्यम', mr: 'मध्यम' }[lang] || 'Moderate' },
    severe:   { emoji: null, label: { en: 'Severe', hi: 'गंभीर', mr: 'गंभीर' }[lang] || 'Severe' },
  };
  return map[severity] || { emoji: null, label: severity || 'Unknown' };
}

/** Small SVG progress ring for confidence (stroke-dasharray). */
function ConfidenceRing({ percent, tier }) {
  const RADIUS = 22;
  const CIRC = 2 * Math.PI * RADIUS;
  const offset = CIRC * (1 - Math.min(Math.max(percent, 0), 100) / 100);
  return (
    <span className={`conf-ring conf-ring-${tier}`} aria-hidden="true">
      <svg viewBox="0 0 56 56" width="56" height="56">
        <circle className="conf-ring-track" cx="28" cy="28" r={RADIUS} fill="none" strokeWidth="5" />
        <circle
          className="conf-ring-fill"
          cx="28" cy="28" r={RADIUS} fill="none" strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          transform="rotate(-90 28 28)"
        />
        <text className="conf-ring-num" x="28" y="33" textAnchor="middle">
          {percent}%
        </text>
      </svg>
    </span>
  );
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
    analysis: { en: 'Analysis', hi: 'विश्लेषण', mr: 'विश्लेषण' },
    symptoms: { en: 'Symptoms detected', hi: 'लक्षण', mr: 'लक्षणे' },
    nextSteps: { en: 'What to do — step by step', hi: 'क्या करें — क्रम से', mr: 'काय करावे — क्रमाने' },
    treatment: { en: 'Treatment', hi: 'उपचार', mr: 'उपचार' },
    chemical: { en: 'Chemical', hi: 'रासायनिक', mr: 'रासायनिक' },
    organic: { en: 'Organic', hi: 'जैविक', mr: 'सेंद्रिय' },
    prevention: { en: 'Prevention', hi: 'रोकथाम', mr: 'प्रतिबंध' },
    tips: { en: 'Extra tips', hi: 'अतिरिक्त सुझाव', mr: 'अतिरिक्त टिप्स' },
    confidenceLabel: { en: 'Confidence', hi: 'विश्वास', mr: 'विश्वास' },
    severityLabel: { en: 'Severity', hi: 'गंभीरता', mr: 'गंभीरता' },
    riskLabel: { en: 'Economic risk', hi: 'आर्थिक जोखिम', mr: 'आर्थिक धोका' },
    share: { en: 'Share', hi: 'शेयर करें', mr: 'शेयर करा' },
    shareAria: { en: 'Share report on WhatsApp', hi: 'WhatsApp पर रिपोर्ट शेयर करें', mr: 'WhatsApp वर अहवाल शेयर करा' },
    print: { en: 'Print', hi: 'प्रिंट', mr: 'प्रिंट' },
    printAria: { en: 'Download / print report', hi: 'रिपोर्ट डाउनलोड/प्रिंट करें', mr: 'अहवाल डाउनलोड/प्रिंट करा' },
    lowConf: {
      en: 'Low confidence — please consult a local agricultural expert for accurate diagnosis.',
      hi: 'कम विश्वास — कृपया सटीक निदान के लिए स्थानीय कृषि विशेषज्ञ से परामर्श करें।',
      mr: 'कमी विश्वास — अचूक निदानासाठी कृपया स्थानिक कृषी तज्ज्ञांचा सल्ला घ्या.',
    },
    healthy: {
      en: 'Great news! Your crop looks healthy. Keep up the good farming practices!',
      hi: 'बढ़िया खबर! आपकी फसल स्वस्थ दिख रही है। अच्छी खेती की आदतें जारी रखें!',
      mr: 'आनंदाची बातमी! तुमचे पीक निरोगी दिसते आहे. चांगल्या शेती पद्धती सुरू ठेवा!',
    },
  }[lang] || {};

  // Pick the field for the active language with graceful fallbacks
  const pick = (en, hi, mr) =>
    lang === 'hi' ? (hi ?? en) : lang === 'mr' ? (mr ?? hi ?? en) : en;

  const displayName = pick(disease_name, disease_name_hi, disease_name_mr);
  const displayDesc = pick(description, description_hi, description_mr);

  // Normalise possibly-string LLM fields into arrays (H7)
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

  const shareText = `🌾 Kisan Mitra Report\nCrop: ${crop_type || 'Unknown'}\nDiagnosis: ${displayName}\nConfidence: ${confPercent}%\n${!isHealthy && severity ? `Severity: ${sevInfo.label}\n` : ''}\nAdvice:\n${displayDesc || ''}\n\nSteps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${chemText ? `\n\nChemical treatment: ${chemText}` : ''}${orgText ? `\nOrganic treatment: ${orgText}` : ''}${prevText ? `\nPrevention: ${prevText}` : ''}\n\n— shared via Kisan Mitra app`;

  return (
    <div className="diagnosis-result glass-panel animate-slide-up">
      {/* Header — disease name + confidence ring */}
      <div className={`diagnosis-header ${isHealthy ? 'healthy' : 'diseased'}`}>
        <div className="diagnosis-title">
          <span className="crop-badge"><Sprout size={15} aria-hidden="true" /> {crop_type || 'Crop'}</span>
          <h3 className="disease-name">{displayName || 'Unknown'}</h3>
        </div>
        <div className="confidence-block">
          <ConfidenceRing percent={confPercent} tier={confClass} />
          <span className="confidence-label">{L.confidenceLabel}</span>
        </div>
      </div>

      {/* Low-confidence warning */}
      {confidence < 0.5 && (
        <div className="low-confidence-warning">
          <AlertTriangle size={16} aria-hidden="true" /> {L.lowConf}
        </div>
      )}

      {/* Severity + yield risk chips */}
      {!isHealthy && (severity || yieldText) && (
        <div className="diagnosis-chips">
          {severity && (
            <span className={`pill-chip sev-${severity}`}>
              <ShieldAlert size={15} aria-hidden="true" /> {sevInfo.label}
            </span>
          )}
          {yieldText && (
            <span className="pill-chip risk-chip">
              <AlertTriangle size={15} aria-hidden="true" /> {yieldText}
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {displayDesc && (
        <div className="diagnosis-section">
          <h4><ClipboardList size={17} aria-hidden="true" /> {L.analysis}</h4>
          <p>{displayDesc}</p>
        </div>
      )}

      {/* Symptoms */}
      {symptomsList.length > 0 && (
        <div className="diagnosis-section">
          <h4><Search size={17} aria-hidden="true" /> {L.symptoms}</h4>
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
          <h4><ListOrdered size={17} aria-hidden="true" /> {L.nextSteps}</h4>
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
          <h4><FlaskConical size={17} aria-hidden="true" /> {L.treatment}</h4>

          {chemText && (
            <div className="treatment-card chemical">
              <span className="treatment-type"><Shield size={14} aria-hidden="true" /> {L.chemical}</span>
              <p>{chemText}</p>
            </div>
          )}

          {orgText && (
            <div className="treatment-card organic">
              <span className="treatment-type"><Sprout size={14} aria-hidden="true" /> {L.organic}</span>
              <p>{orgText}</p>
            </div>
          )}

          {prevText && (
            <div className="treatment-card preventive">
              <span className="treatment-type"><ShieldAlert size={14} aria-hidden="true" /> {L.prevention}</span>
              <p>{prevText}</p>
            </div>
          )}

          <AgriStoreLocator lang={lang} />
        </div>
      )}

      {/* Extra practical tips */}
      {tips.length > 0 && !isHealthy && (
        <div className="diagnosis-section tips-section">
          <h4><Lightbulb size={17} aria-hidden="true" /> {L.tips}</h4>
          <ul className="tips-list">
            {tips.map((tp, i) => (
              <li key={i}>{tp}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Healthy plant message */}
      {isHealthy && (
        <div className="healthy-message">
          <CheckCircle2 size={18} aria-hidden="true" /> {L.healthy}
        </div>
      )}

      {/* Sticky action bar: WhatsApp + Print */}
      <div className="diagnosis-actions no-print">
        <button
          className="action-btn whatsapp-btn"
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')}
        >
          <Share2 size={18} aria-hidden="true" /> {L.share}
        </button>
        <button
          className="action-btn print-btn"
          onClick={() => window.print()}
        >
          <Printer size={18} aria-hidden="true" /> {L.print}
        </button>
      </div>
    </div>
  );
}

export default DiagnosisResult;
