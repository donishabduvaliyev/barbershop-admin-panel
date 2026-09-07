import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/AuthContext';
import StatCard from '../../components/StatCard';
import { Card, EmptyState } from '../../components/ui';
import { StatCardSkeleton, Skeleton } from '../../components/Skeleton';
import { shortDateLabel } from '../../lib/locale';

const currency = (n) => `${Math.round(n).toLocaleString()} UZS`;

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-text font-medium">{formatter ? formatter(p.value) : p.value}</p>
      ))}
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const [overview, setOverview] = useState(null);
  const [visits, setVisits] = useState(null);

  useEffect(() => {
    api.get('/superadmin/dashboard/overview').then(setOverview);
    api.get('/superadmin/dashboard/visits').then(setVisits);
  }, [api]);

  const revenueData = useMemo(
    () => (overview?.revenueOverTime || []).map((d) => ({ ...d, label: shortDateLabel(d.date, i18n.language) })),
    [overview, i18n.language]
  );

  const visitsData = useMemo(
    () => (visits?.visitsOverTime || []).map((d) => ({ ...d, label: shortDateLabel(d.date, i18n.language) })),
    [visits, i18n.language]
  );

  // Booking.shopName is a plain string snapshot taken at booking time (see
  // models/bookingHistory.js) — not the shop's localized {en,uz,ru} name.
  const topShopsData = useMemo(
    () => (overview?.topShops || []).map((s) => ({
      ...s,
      shopName: s.shopName || t('superadmin.dashboard.unnamedShop'),
    })),
    [overview, t]
  );

  const loading = !overview || !visits;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-text">{t('superadmin.dashboard.title')}</h1>
        <p className="text-text-muted text-sm mt-1">{t('superadmin.dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard index={0} label={t('superadmin.dashboard.totalShops')} value={overview.shops.total} icon="🏪" />
            <StatCard index={1} label={t('superadmin.dashboard.bookingsThisMonth')} value={overview.month.appointments} icon="📅" />
            <StatCard index={2} label={t('superadmin.dashboard.revenueThisMonth')} value={overview.month.revenue} icon="💰" format={currency} />
            <StatCard index={3} label={t('superadmin.dashboard.visitsToday')} value={visits.today} icon="👀" />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard index={0} label={t('superadmin.dashboard.activeShops')} value={overview.shops.active} icon="✅" />
            <StatCard index={1} label={t('superadmin.dashboard.suspendedShops')} value={overview.shops.suspended} icon="⏸️" accent={overview.shops.suspended > 0} />
            <StatCard index={2} label={t('superadmin.dashboard.unclaimedShops')} value={overview.shops.unclaimed} icon="🔓" accent={overview.shops.unclaimed > 0} />
            <StatCard index={3} label={t('superadmin.dashboard.avgRating')} value={overview.averageRating} icon="⭐" format={(v) => v.toFixed(1)} />
          </>
        )}
      </div>

      <Card className="p-6">
        <h2 className="font-medium text-text mb-4">{t('superadmin.dashboard.revenueOverTime')}</h2>
        {loading ? <Skeleton className="h-64 w-full" /> : revenueData.length === 0 ? (
          <EmptyState icon="📈" title={t('superadmin.dashboard.noRevenueTitle')} description={t('superadmin.dashboard.noRevenueDesc')} />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueData} margin={{ left: -20, right: 10 }}>
              <defs>
                <linearGradient id="platformRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4af5a" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#d4af5a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272e" vertical={false} />
              <XAxis dataKey="label" stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip formatter={(v) => `${v.toLocaleString()} UZS`} />} />
              <Area type="monotone" dataKey="revenue" stroke="#d4af5a" strokeWidth={2.5} fill="url(#platformRevenueFill)" animationDuration={900} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="font-medium text-text mb-4">{t('superadmin.dashboard.topShopsByRevenue')}</h2>
          {loading ? <Skeleton className="h-56 w-full" /> : topShopsData.length === 0 ? (
            <EmptyState icon="🏪" title={t('superadmin.dashboard.noRevenueTitle')} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topShopsData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272e" horizontal={false} />
                <XAxis type="number" stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="shopName" stroke="#9c9ca6" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip content={<ChartTooltip formatter={(v) => `${v.toLocaleString()} UZS`} />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="revenue" fill="#d4af5a" radius={[0, 6, 6, 0]} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-medium text-text mb-4">{t('superadmin.dashboard.visitsOverTime')}</h2>
          {loading ? <Skeleton className="h-56 w-full" /> : visitsData.length === 0 ? (
            <EmptyState icon="👀" title={t('superadmin.dashboard.noVisitsTitle')} description={t('superadmin.dashboard.noVisitsDesc')} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={visitsData} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272e" vertical={false} />
                <XAxis dataKey="label" stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip formatter={(v) => t('superadmin.dashboard.view', { count: v })} />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="visits" fill="#5b9df9" radius={[6, 6, 0, 0]} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border-soft">
          <h2 className="font-medium text-text">{t('superadmin.dashboard.topViewedShops')}</h2>
        </div>
        {loading ? (
          <div className="p-5"><Skeleton className="h-32 w-full" /></div>
        ) : (visits.topViewedShops || []).length === 0 ? (
          <EmptyState icon="👀" title={t('superadmin.dashboard.noVisitsTitle')} description={t('superadmin.dashboard.noVisitsDesc')} />
        ) : (
          <div>
            {visits.topViewedShops.map((s, i) => (
              <div key={s.shopId} className="flex items-center gap-4 px-5 py-3 border-b border-border-soft last:border-0">
                <span className="w-5 text-xs font-medium text-text-faint">{i + 1}</span>
                <span className="text-sm text-text flex-1 truncate">
                  {s.shopName?.[i18n.language] || s.shopName?.en || t('superadmin.dashboard.unnamedShop')}
                </span>
                <span className="text-xs text-text-muted whitespace-nowrap">{t('superadmin.dashboard.view', { count: s.views })}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
