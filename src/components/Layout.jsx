import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import {
  Squares2X2Icon, CalendarDaysIcon, ScissorsIcon, UserGroupIcon,
  ChartBarIcon, Cog6ToothIcon, ArrowLeftStartOnRectangleIcon, Bars3Icon, XMarkIcon,
  ChevronUpDownIcon, CheckIcon, UsersIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../lib/AuthContext';
import { createApiClient } from '../lib/api';
import Modal from './Modal';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Squares2X2Icon, end: true },
  { to: '/appointments', label: 'Appointments', icon: CalendarDaysIcon },
  { to: '/customers', label: 'Customers', icon: UsersIcon },
  { to: '/services', label: 'Services', icon: ScissorsIcon },
  { to: '/staff', label: 'Staff', icon: UserGroupIcon },
  { to: '/statistics', label: 'Statistics', icon: ChartBarIcon },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon },
];

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              isActive ? 'text-text' : 'text-text-muted hover:text-text hover:bg-surface-2'
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-surface-2 border border-border-soft rounded-xl"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={clsx('w-[18px] h-[18px] relative z-10 shrink-0', isActive && 'text-accent')} />
              <span className="relative z-10">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

// Shown only once we know the account actually owns more than one shop —
// lets them jump between shops without re-verifying via Telegram each time.
function ShopSwitcher({ shopName, shopInitial }) {
  const { token, shop, login } = useAuth();
  const [myShops, setMyShops] = useState(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!token) return;
    createApiClient(token).get('/admin/auth/my-shops')
      .then((res) => setMyShops(res.shops))
      .catch(() => setMyShops([]));
  }, [token]);

  const switchTo = async (shopId) => {
    setSwitching(true);
    try {
      const api = createApiClient(token);
      const { token: newToken, shop: newShop } = await api.post('/admin/auth/select-shop', { token, shopId });
      login(newToken, newShop);
      setOpen(false);
    } catch {
      // Silently keep the picker open — the user can just try again.
    } finally {
      setSwitching(false);
    }
  };

  const hasMultiple = (myShops?.length || 0) > 1;

  return (
    <>
      <button
        onClick={() => hasMultiple && setOpen(true)}
        className={clsx('flex items-center gap-3 min-w-0 flex-1 text-left', hasMultiple && 'cursor-pointer')}
      >
        <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-xs font-semibold text-text-muted shrink-0">
          {shopInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{shopName}</p>
        </div>
        {hasMultiple && <ChevronUpDownIcon className="w-4 h-4 text-text-faint shrink-0" />}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Switch shop">
        <div className="space-y-1.5">
          {(myShops || []).map((s) => (
            <button
              key={s.id}
              disabled={switching}
              onClick={() => switchTo(s.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-surface-3 hover:border-accent/60 transition-colors disabled:opacity-50"
            >
              <img src={s.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
              <span className="text-sm font-medium text-text truncate flex-1 text-left">{s.name?.en || s.name?.ru}</span>
              {s.id === shop?.id && <CheckIcon className="w-4 h-4 text-accent shrink-0" />}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

export default function Layout() {
  const { shop, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const shopName = shop?.name?.en || shop?.name?.ru || 'Your Shop';
  const shopInitial = shopName.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-bg text-text flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border-soft px-4 py-6">
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center font-display font-semibold text-sm">T</div>
          <span className="font-display text-lg font-semibold tracking-tight">Tezkor</span>
        </div>
        <NavItems />
        <div className="mt-auto pt-4 border-t border-border-soft flex items-center gap-3 px-2">
          <ShopSwitcher shopName={shopName} shopInitial={shopInitial} />
          <button onClick={logout} title="Log out" className="text-text-faint hover:text-danger transition-colors p-1.5 shrink-0">
            <ArrowLeftStartOnRectangleIcon className="w-[18px] h-[18px]" />
          </button>
        </div>
      </aside>

      {/* Mobile topbar + drawer */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-bg/80 backdrop-blur-xl border-b border-border-soft">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center font-display font-semibold text-xs">T</div>
          <span className="font-display font-semibold">Tezkor</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-1.5 text-text-muted">
          <Bars3Icon className="w-6 h-6" />
        </button>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="lg:hidden fixed inset-0 z-50 flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="relative w-72 bg-surface border-r border-border-soft h-full px-4 py-6 flex flex-col"
              initial={{ x: -288 }} animate={{ x: 0 }} exit={{ x: -288 }}
              transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            >
              <div className="flex items-center justify-between mb-8 px-2">
                <span className="font-display text-lg font-semibold">Tezkor</span>
                <button onClick={() => setMobileOpen(false)} className="text-text-muted"><XMarkIcon className="w-5 h-5" /></button>
              </div>
              <NavItems onNavigate={() => setMobileOpen(false)} />
              <div className="mt-auto pt-4 border-t border-border-soft flex items-center gap-3 px-2">
                <ShopSwitcher shopName={shopName} shopInitial={shopInitial} />
              </div>
              <button onClick={logout} className="flex items-center gap-2 text-sm text-text-faint hover:text-danger transition-colors px-2 py-2 mt-2">
                <ArrowLeftStartOnRectangleIcon className="w-[18px] h-[18px]" /> Log out
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
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
    </div>
  );
}
