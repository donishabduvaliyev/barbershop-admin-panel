import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import {
  Squares2X2Icon, CalendarDaysIcon, UsersIcon, Bars3Icon, ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
  Squares2X2Icon as Squares2X2IconSolid, CalendarDaysIcon as CalendarDaysIconSolid,
  UsersIcon as UsersIconSolid, Bars3Icon as Bars3IconSolid, ChartBarIcon as ChartBarIconSolid,
} from '@heroicons/react/24/solid';
import { useAuth } from '../lib/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

const TABS = [
  { to: '/', key: 'today', icon: Squares2X2Icon, activeIcon: Squares2X2IconSolid, end: true },
  { to: '/appointments', key: 'bookings', icon: CalendarDaysIcon, activeIcon: CalendarDaysIconSolid },
  { to: '/customers', key: 'clients', icon: UsersIcon, activeIcon: UsersIconSolid },
  { to: '/statistics', key: 'statistics', icon: ChartBarIcon, activeIcon: ChartBarIconSolid },
  { to: '/manage', key: 'manage', icon: Bars3Icon, activeIcon: Bars3IconSolid },
];

function TopNavbar() {
  const { t } = useTranslation();
  const { shop } = useAuth();
  const shopName = shop?.name?.en || shop?.name?.uz || shop?.name?.ru || 'SmartChair';

  return (
    <header className="hidden md:block sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-border-soft">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center font-bold text-accent text-lg">
            ✂️
          </div>
          <div>
            <span className="font-display font-bold text-text text-base leading-tight block truncate max-w-[200px]">
              {shopName}
            </span>
            <span className="text-[11px] text-text-muted leading-none block">
              {t('nav.dashboard', 'Boshqaruv')}
            </span>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="flex items-center gap-1 bg-surface-2/60 border border-border-soft/80 rounded-xl p-1">
          {TABS.map(({ to, key, icon: Icon, activeIcon: ActiveIcon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  isActive
                    ? 'bg-accent text-black font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text hover:bg-surface-3'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? <ActiveIcon className="w-4 h-4 shrink-0 text-black" /> : <Icon className="w-4 h-4 shrink-0" />}
                  <span>{t(`nav.${key}`)}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right side: Language */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border-soft pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto grid grid-cols-5">
        {TABS.map(({ to, key, icon: Icon, activeIcon: ActiveIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="press-spring relative flex flex-col items-center justify-center gap-1 py-2.5 text-text-faint cursor-pointer"
          >
            {({ isActive }) => (
              <>
                {isActive ? <ActiveIcon className="w-6 h-6 text-accent" /> : <Icon className="w-6 h-6" />}
                <span className={clsx('text-[11px] font-medium transition-colors', isActive ? 'text-accent font-semibold' : 'text-text-faint')}>
                  {t(`nav.${key}`)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-bg text-text">
      <TopNavbar />
      <main className="pb-24 md:pb-12">
        <div className="max-w-lg md:max-w-4xl lg:max-w-6xl mx-auto px-4 py-5 md:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
