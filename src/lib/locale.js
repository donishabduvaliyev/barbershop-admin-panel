// Maps the app's language codes (en/ru/uz — same set as i18next's resources)
// to real BCP-47 locale tags for toLocaleDateString/toLocaleString, so date
// formatting follows the selected UI language instead of the browser default.
export const LOCALE_MAP = { en: 'en-US', ru: 'ru-RU', uz: 'uz-UZ' };

export function localeFor(lang) {
  return LOCALE_MAP[lang] || 'en-US';
}
