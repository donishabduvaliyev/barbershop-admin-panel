import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  QueueListIcon,
  BanknotesIcon,
  UserGroupIcon,
  UsersIcon,
  ScissorsIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

export default function CommandPalette({ open, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const actions = useMemo(() => [
    {
      id: 'new-booking',
      label: t('appointments.manual.newBooking', 'New Booking'),
      group: t('cmd.quickActions', 'Quick Actions'),
      icon: PlusIcon,
      run: () => {
        navigate('/');
        setTimeout(() => window.__openManualBooking?.(), 80);
      },
    },
    {
      id: 'new-walkin',
      label: t('queue.addWalkInBtn', 'Add Walk-In Client'),
      group: t('cmd.quickActions', 'Quick Actions'),
      icon: QueueListIcon,
      run: () => navigate('/queue?new=1'),
    },
    {
      id: 'open-register',
      label: t('nav.register', 'Cashier & Z-Report'),
      group: t('cmd.navigate', 'Navigate'),
      icon: BanknotesIcon,
      run: () => navigate('/register'),
    },
    {
      id: 'open-queue',
      label: t('nav.queue', 'Live Walk-In Queue'),
      group: t('cmd.navigate', 'Navigate'),
      icon: QueueListIcon,
      run: () => navigate('/queue'),
    },
    {
      id: 'open-appointments',
      label: t('nav.bookings', 'Bookings'),
      group: t('cmd.navigate', 'Navigate'),
      icon: CalendarDaysIcon,
      run: () => navigate('/appointments'),
    },
    {
      id: 'open-shifts',
      label: t('staff.tabShifts', 'Staff Shifts & Attendance'),
      group: t('cmd.navigate', 'Navigate'),
      icon: UserGroupIcon,
      run: () => navigate('/staff?tab=shifts'),
    },
    {
      id: 'open-payroll',
      label: t('staff.tabPayroll', 'Commissions & Payroll'),
      group: t('cmd.navigate', 'Navigate'),
      icon: BanknotesIcon,
      run: () => navigate('/staff?tab=payroll'),
    },
    {
      id: 'open-customers',
      label: t('nav.clients', 'Clients & CRM'),
      group: t('cmd.navigate', 'Navigate'),
      icon: UsersIcon,
      run: () => navigate('/customers'),
    },
    {
      id: 'open-services',
      label: t('nav.services', 'Services'),
      group: t('cmd.navigate', 'Navigate'),
      icon: ScissorsIcon,
      run: () => navigate('/services'),
    },
    {
      id: 'open-stats',
      label: t('nav.statistics', 'Statistics'),
      group: t('cmd.navigate', 'Navigate'),
      icon: ChartBarIcon,
      run: () => navigate('/statistics'),
    },
    {
      id: 'open-settings',
      label: t('nav.settings', 'Settings'),
      group: t('cmd.navigate', 'Navigate'),
      icon: Cog6ToothIcon,
      run: () => navigate('/settings'),
    },
  ], [t, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q));
  }, [actions, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const execute = (item) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[14vh] px-4 bg-black/75 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-lg bg-surface-2 border border-border rounded-2xl shadow-2xl shadow-black/80 overflow-hidden"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-soft">
              <MagnifyingGlassIcon className="w-5 h-5 text-accent shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('cmd.placeholder', 'Type a command or jump to page...')}
                className="w-full bg-transparent text-sm text-text placeholder:text-text-faint outline-none"
              />
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-3 border border-border text-text-muted">
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <p className="text-center text-xs text-text-muted py-8">
                  {t('cmd.noResults', 'No matching commands')}
                </p>
              ) : (
                filtered.map((item, idx) => {
                  const Icon = item.icon;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => execute(item)}
                      className={clsx(
                        'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors cursor-pointer',
                        active ? 'bg-accent/15 text-accent' : 'text-text hover:bg-surface-3'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={clsx('w-4 h-4 shrink-0', active ? 'text-accent' : 'text-text-muted')} />
                        <span className="font-medium truncate">{item.label}</span>
                      </div>
                      <span className="text-[11px] text-text-faint shrink-0">{item.group}</span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
