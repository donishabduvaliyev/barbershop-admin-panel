import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useShopSocket } from '../lib/socket';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { Card, EmptyState } from '../components/ui';
import { StatCardSkeleton, TableRowSkeleton } from '../components/Skeleton';
import { Link } from 'react-router-dom';
import { localeFor } from '../lib/locale';

const currency = (n) => `${Math.round(n).toLocaleString()} UZS`;

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { api, token, shop } = useAuth();
  const [stats, setStats] = useState(null);
  const [today, setToday] = useState(null);
  const [month, setMonth] = useState(null);
  const [shopInfo, setShopInfo] = useState(shop);
  const [recent, setRecent] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadRecent = () => api.get('/admin/appointments?limit=6').then((res) => setRecent(res.appointments));
  const loadStats = () => Promise.all([
    api.get('/admin/stats/overview').then(setStats),
    api.get('/admin/stats/today').then(setToday),
    api.get('/admin/stats/month').then(setMonth),
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadStats(),
      api.get('/admin/shop').then(setShopInfo),
      loadRecent(),
    ]).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useShopSocket(token, () => {
    loadRecent();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const pendingCount = useMemo(
    () => stats?.statusBreakdown?.find((s) => s.status === 'pending')?.count || 0,
    [stats]
  );

  const revenueByService = useMemo(
    () => [...(stats?.topServices || [])].sort((a, b) => b.revenue - a.revenue),
    [stats]
  );

  const shopName = shopInfo?.name?.en || shopInfo?.name?.ru || t('common.yourShop');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-text">{t('dashboard.greeting')}</h1>
        <p className="text-text-muted text-sm mt-1">{t('dashboard.subtitlePrefix')} <span className="text-text">{shopName}</span> {t('dashboard.subtitleSuffix')}</p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-text-muted mb-3">{t('dashboard.today')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading || !today ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard index={0} label={t('dashboard.appointments')} value={today.appointments} icon="📅" />
              <StatCard index={1} label={t('dashboard.pending')} value={pendingCount} icon="⏳" accent={pendingCount > 0} />
              <StatCard index={2} label={t('dashboard.revenue')} value={today.revenue} icon="💰" format={currency} />
              <StatCard index={3} label={t('dashboard.noShows')} value={today.noShows} icon="🚫" accent={today.noShows > 0} />
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-text-muted mb-3">{t('dashboard.thisMonth')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading || !month ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard index={0} label={t('dashboard.revenue')} value={month.revenue} icon="💰" format={currency} />
              <StatCard index={1} label={t('dashboard.avgTicket')} value={month.averageTicket} icon="🧾" format={currency} />
              <StatCard index={2} label={t('dashboard.newCustomers')} value={month.newCustomers} icon="✨" />
              <StatCard index={3} label={t('dashboard.rating')} value={shopInfo?.rating || 0} icon="⭐" format={(v) => v.toFixed(1)} />
            </>
          )}
        </div>
      </div>

      {!loading && revenueByService.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border-soft">
            <h2 className="font-medium text-text">{t('dashboard.revenueByService')}</h2>
          </div>
          <div>
            {revenueByService.map((s, i) => (
              <div key={s.serviceId || s.serviceName} className="flex items-center gap-4 px-5 py-3 border-b border-border-soft last:border-0">
                <span className="w-5 text-xs font-medium text-text-faint">{i + 1}</span>
                <span className="text-sm text-text flex-1 truncate">{s.serviceName || t('common.service')}</span>
                <span className="text-xs text-text-muted">{t('dashboard.booking', { count: s.count })}</span>
                <span className="text-sm font-medium text-text whitespace-nowrap">{currency(s.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft">
          <h2 className="font-medium text-text">{t('dashboard.recentActivity')}</h2>
          <Link to="/appointments" className="text-xs text-accent hover:text-accent-hover font-medium">{t('dashboard.viewAll')}</Link>
        </div>

        {loading || recent === null ? (
          <div>{Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} />)}</div>
        ) : recent.length === 0 ? (
          <EmptyState icon="📭" title={t('dashboard.noAppointmentsTitle')} description={t('dashboard.noAppointmentsDesc')} />
        ) : (
          <div>
            {recent.map((appt, i) => (
              <motion.div
                key={appt._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-4 px-5 py-4 border-b border-border-soft last:border-0"
              >
                <div className="w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center text-sm font-medium text-text-muted shrink-0">
                  {(appt.userName || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">{appt.userName || t('common.guest')}</p>
                  <p className="text-xs text-text-muted truncate">{appt.serviceName || t('common.service')} {appt.staffName ? `· ${appt.staffName}` : ''}</p>
                </div>
                <div className="text-xs text-text-muted whitespace-nowrap hidden sm:block">
                  {new Date(appt.requestedTime).toLocaleString(localeFor(i18n.language), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <StatusBadge status={appt.status} />
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
