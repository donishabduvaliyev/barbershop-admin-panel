import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import {
  Squares2X2Icon, CalendarDaysIcon, UsersIcon, Bars3Icon,
} from '@heroicons/react/24/outline';
import {
  Squares2X2Icon as Squares2X2IconSolid, CalendarDaysIcon as CalendarDaysIconSolid,
  UsersIcon as UsersIconSolid, Bars3Icon as Bars3IconSolid,
} from '@heroicons/react/24/solid';

// Four tabs only — a bottom bar can't hold the full page list the old
// sidebar had, so Services/Staff/Statistics/Promotions/Settings all live
// behind the "Manage" tab's own hub screen (src/pages/Manage.jsx) instead.
const TABS = [
  { to: '/', key: 'today', icon: Squares2X2Icon, activeIcon: Squares2X2IconSolid, end: true },
  { to: '/appointments', key: 'bookings', icon: CalendarDaysIcon, activeIcon: CalendarDaysIconSolid },
  { to: '/customers', key: 'clients', icon: UsersIcon, activeIcon: UsersIconSolid },
  { to: '/manage', key: 'manage', icon: Bars3Icon, activeIcon: Bars3IconSolid },
];

function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border-soft pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto grid grid-cols-4">
        {TABS.map(({ to, key, icon: Icon, activeIcon: ActiveIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="relative flex flex-col items-center justify-center gap-1 py-2.5 text-text-faint"
          >
            {({ isActive }) => (
              <>
                {isActive ? <ActiveIcon className="w-6 h-6 text-accent" /> : <Icon className="w-6 h-6" />}
                <span className={clsx('text-[11px] font-medium', isActive ? 'text-accent' : 'text-text-faint')}>
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
      <main className="pb-20">
        <div className="max-w-lg mx-auto px-4 py-5">
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
