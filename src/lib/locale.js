// Maps the app's language codes (en/ru/uz — same set as i18next's resources)
// to real BCP-47 locale tags for toLocaleDateString/toLocaleString, so date
// formatting follows the selected UI language instead of the browser default.
export const LOCALE_MAP = { en: 'en-US', ru: 'ru-RU', uz: 'uz-UZ' };

export function localeFor(lang) {
  return LOCALE_MAP[lang] || 'en-US';
}

// Chromium's Intl data for 'uz-UZ' doesn't have real short month names (it
// falls back to "M08"-style tokens), so chart tick labels hand-roll instead
// of trusting toLocaleDateString for this one language.
const SHORT_MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
};

export function shortDateLabel(date, lang) {
  const d = new Date(date);
  const months = SHORT_MONTHS[lang] || SHORT_MONTHS.en;
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
