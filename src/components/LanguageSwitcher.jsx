import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

const LANGUAGES = [
  { code: 'uz', label: 'UZ' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
];

// Compact 3-way toggle, deliberately not a Modal picker like ShopSwitcher —
// three options fit inline without needing a dialog. i18next persists the
// choice to its own localStorage key (see src/i18n.js), independent of the
// auth session.
export default function LanguageSwitcher({ className }) {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <div className={clsx('flex items-center gap-0.5 bg-surface-3 border border-border rounded-lg p-0.5', className)}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          className={clsx(
            'px-1.5 py-1 rounded-md text-[11px] font-medium transition-colors',
            current === code ? 'bg-accent text-black' : 'text-text-faint hover:text-text'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
