/**
 * Weather-driven agronomic advice — single source of truth.
 *
 * Home shows one severity-coloured highlight line; WeatherAdvisory shows the
 * full list. Both read from here so the two views can never drift apart, and
 * every tip carries all three languages.
 */

/**
 * Rules in priority order. Each tip is [en, hi, mr] and each rule carries a
 * `tone` (healthy | moderate | severe) used to colour the UI with the
 * --color-status-* tokens.
 */
const RULES = [
  {
    tone: 'moderate',
    when: (c) => c.humidity > 80,
    tip: [
      'High humidity — watch for fungal outbreaks; consider a preventive fungicide spray.',
      'अधिक आर्द्रता — फंगल रोग का खतरा; बचाव के लिए फफूंदनाशक छिड़काव पर विचार करें।',
      'जास्त आर्द्रता — बुरशीचा धोका; प्रतिबंधात्मक बुरशीनाशक फवारणीचा विचार करा.',
    ],
  },
  {
    tone: 'moderate',
    when: (c) => c.wind_speed && c.wind_speed > 10,
    tip: [
      'Strong winds — avoid pesticide spraying today; drift will reduce effectiveness.',
      'तेज़ हवा — आज कीटकनाशक छिड़काव न करें; दवा बिखर जाएगी।',
      'मोठा वारा — आज कीटकनाशक फवारणी करू नका; औषध वाहून जाईल.',
    ],
  },
  {
    tone: 'severe',
    when: (c) => c.temp > 35,
    tip: [
      'Heat stress likely — irrigate in the early morning or evening, not midday.',
      'गर्मी का खतरा — पानी सुबह या शाम को दें, दोपहर में नहीं।',
      'उष्णतेचा ताण — पाणी सकाळी किंवा संध्याकाळी द्या, दुपारी नाही.',
    ],
  },
  {
    tone: 'severe',
    when: (c, f) => (f || []).slice(0, 3).some((d) => d.rain_probability >= 60),
    tip: [
      'Rain likely within 3 days — delay fertilizer/pesticide application so it is not washed away.',
      '3 दिन में बारिश संभव — खाद/दवा का छिड़काव टालें, बह जाएगा।',
      '3 दिवसांत पाऊस शक्य — खत/औषध फवारणी टाळा, वाहून जाईल.',
    ],
  },
];

/** Nothing unusual in the forecast — the good-news line. */
const STABLE = {
  tone: 'healthy',
  tip: [
    'Conditions are stable — a good window for field work and spraying.',
    'मौसम स्थिर है — खेत के काम और छिड़काव के लिए अच्छा समय।',
    'हवामान स्थिर आहे — शेतकाम व फवारणीसाठी चांगली वेळ.',
  ],
};

/** en → 0, hi → 1, mr → 2 */
const langIndex = (lang) => (lang === 'hi' ? 1 : lang === 'mr' ? 2 : 0);

/**
 * Rule-based tips for the current weather (trilingual).
 * Returns an array of strings in the requested language.
 */
export function getCropAdvice(current, forecast, lang = 'en') {
  const idx = langIndex(lang);
  const tips = RULES.filter((r) => r.when(current, forecast)).map((r) => r.tip[idx]);
  if (tips.length === 0) return [STABLE.tip[idx]];
  return tips;
}

/**
 * The single most important thing to say right now, plus the tone that
 * colours it — used by the Home banner. Returns null without weather data.
 */
export function getAdvisoryHighlight(current, forecast, lang = 'en') {
  if (!current) return null;
  const idx = langIndex(lang);
  const rule = RULES.find((r) => r.when(current, forecast));
  return rule
    ? { text: rule.tip[idx], tone: rule.tone }
    : { text: STABLE.tip[idx], tone: STABLE.tone };
}
