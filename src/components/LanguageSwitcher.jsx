import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ChevronDownIcon, CheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

const LANGUAGES = [
  { code: 'uz', label: 'UZ', name: "O'zbekcha" },
  { code: 'ru', label: 'RU', name: 'Русский' },
  { code: 'en', label: 'EN', name: 'English' },
];

// A collapsed, current-language pill that opens a small anchored dropdown —
// replaces the old always-expanded 3-way segmented toggle, which took up a
// full row for something used rarely. i18next persists the choice to its
// own localStorage key (see src/i18n.js), independent of the auth session.
export default function LanguageSwitcher({ className }) {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectLanguage = (code) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={clsx('relative inline-block', className)}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 bg-surface-3 border border-border rounded-lg text-xs font-medium text-text hover:border-accent/60 transition-colors"
      >
        <GlobeAltIcon className="w-3.5 h-3.5 text-text-faint" />
        {current.label}
        <ChevronDownIcon className={clsx('w-3 h-3 text-text-faint transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-36 bg-surface-2 border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-30 animate-scale-in origin-bottom-left">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => selectLanguage(lang.code)}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors',
                lang.code === current.code ? 'text-accent bg-accent/10 font-medium' : 'text-text hover:bg-surface-3'
              )}
            >
              {lang.name}
              {lang.code === current.code && <CheckIcon className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
