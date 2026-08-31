import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './languages/en.json';
import ru from './languages/ru.json';
import uz from './languages/uz.json';

// Persists to its own localStorage key, deliberately separate from
// AuthContext's 'tezkor_admin_session' — logging out should never reset
// the chosen UI language.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'uz',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'tezkor_admin_language',
      convertDetectedLanguage: (lng) => lng.split('-')[0],
    },
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      uz: { translation: uz },
    },
    interpolation: {
      escapeValue: false,
    },
    defaultNS: 'translation',
  });

export default i18n;
