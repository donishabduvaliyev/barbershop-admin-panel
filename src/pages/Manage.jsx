import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  ScissorsIcon, UserGroupIcon, ChartBarIcon, MegaphoneIcon, Cog6ToothIcon,
  ChevronRightIcon, ChevronUpDownIcon, CheckIcon, ArrowLeftStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../lib/AuthContext';
import { createApiClient } from '../lib/api';
import { Card } from '../components/ui';
import Modal from '../components/Modal';
import LanguageSwitcher from '../components/LanguageSwitcher';

const MENU_ITEMS = [
  { to: '/services', key: 'services', icon: ScissorsIcon },
  { to: '/staff', key: 'staff', icon: UserGroupIcon },
  { to: '/statistics', key: 'statistics', icon: ChartBarIcon },
  { to: '/promotions', key: 'promotions', icon: MegaphoneIcon },
  { to: '/settings', key: 'settings', icon: Cog6ToothIcon },
];

// Shown only once we know the account actually owns more than one shop —
// lets them jump between shops without re-verifying via Telegram each time.
function ShopSwitcher({ shopName, shopInitial }) {
  const { t, i18n } = useTranslation();
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
        <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-sm font-semibold text-text-muted shrink-0">
          {shopInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{shopName}</p>
          {hasMultiple && <p className="text-xs text-text-faint">{t('common.switchShop')}</p>}
        </div>
        {hasMultiple && <ChevronUpDownIcon className="w-4 h-4 text-text-faint shrink-0" />}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t('common.switchShop')}>
        <div className="space-y-1.5">
          {(myShops || []).map((s) => (
            <button
              key={s.id}
              disabled={switching}
              onClick={() => switchTo(s.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-surface-3 hover:border-accent/60 transition-colors disabled:opacity-50"
            >
              <img src={s.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
              <span className="text-sm font-medium text-text truncate flex-1 text-left">{s.name?.[i18n.language] || s.name?.en || s.name?.ru}</span>
              {s.id === shop?.id && <CheckIcon className="w-4 h-4 text-accent shrink-0" />}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

export default function Manage() {
  const { t } = useTranslation();
  const { shop, logout } = useAuth();
  const shopName = shop?.name?.en || shop?.name?.ru || t('common.yourShop');
  const shopInitial = shopName.slice(0, 1).toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-text">{t('nav.manage')}</h1>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <ShopSwitcher shopName={shopName} shopInitial={shopInitial} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {MENU_ITEMS.map(({ to, key, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 px-4 py-3.5 border-b border-border-soft last:border-0 hover:bg-surface-2 transition-colors"
          >
            <Icon className="w-5 h-5 text-text-muted shrink-0" />
            <span className="text-sm font-medium text-text flex-1">{t(`nav.${key}`)}</span>
            <ChevronRightIcon className="w-4 h-4 text-text-faint shrink-0" />
          </Link>
        ))}
      </Card>

      <Card className="p-4">
        <LanguageSwitcher className="mb-3" />
        <button onClick={logout} className="flex items-center gap-2 text-sm text-danger hover:text-danger/80 transition-colors">
          <ArrowLeftStartOnRectangleIcon className="w-[18px] h-[18px]" /> {t('common.logOut')}
        </button>
      </Card>
    </div>
  );
}
