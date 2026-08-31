import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { Card, Button, EmptyState } from '../components/ui';
import { Skeleton } from '../components/Skeleton';
import StatCard from '../components/StatCard';
import { shortDateLabel } from '../lib/locale';

const RANGES = [
  { key: 7, labelKey: 'range7d' },
  { key: 30, labelKey: 'range30d' },
  { key: 90, labelKey: 'range90d' },
];

const STATUS_COLORS = {
  pending: '#f0b84c', confirmed: '#5b9df9', completed: '#3ddc97', rejected: '#f2685c', cancelled: '#64646d',
};

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

export default function Statistics() {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const [rangeDays, setRangeDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [staffStats, setStaffStats] = useState(null);

  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - rangeDays);
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    setStats(null);
    setStaffStats(null);
    api.get(`/admin/stats/overview?${query}`).then(setStats);
    api.get(`/admin/stats/staff?${query}`).then((res) => setStaffStats(res.staff));
  }, [api, rangeDays]);

  const statusLabelKey = { pending: 'pending', confirmed: 'confirmed', completed: 'completed', rejected: 'rejected', cancelled: 'cancelled' };

  const statusData = useMemo(
    () => (stats?.statusBreakdown || []).map((s) => ({
      name: s.status,
      label: statusLabelKey[s.status] ? t(`statusBadge.${statusLabelKey[s.status]}`) : s.status,
      value: s.count,
      color: STATUS_COLORS[s.status] || '#666',
    })),
    [stats, t]
  );

  const revenueData = useMemo(
    () => (stats?.revenueOverTime || []).map((d) => ({ ...d, label: shortDateLabel(d.date, i18n.language) })),
    [stats, i18n.language]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">{t('statistics.title')}</h1>
          <p className="text-text-muted text-sm mt-1">{t('statistics.subtitle')}</p>
        </div>
        <div className="flex gap-1.5 bg-surface border border-border-soft rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeDays(r.key)}
              className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', rangeDays === r.key ? 'bg-accent text-black' : 'text-text-muted hover:text-text')}
            >
              {t(`statistics.${r.labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {!stats ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
          <>
            <StatCard index={0} label={t('statistics.totalAppointments')} value={stats.totals.appointments} icon="📅" />
            <StatCard index={1} label={t('statistics.completedVisits')} value={stats.totals.completed} icon="✅" />
            <StatCard index={2} label={t('statistics.revenue')} value={stats.totals.revenue} icon="💰" format={(v) => `${Math.round(v).toLocaleString()}`} suffix=" UZS" />
          </>
        )}
      </div>

      <Card className="p-6">
        <h2 className="font-medium text-text mb-4">{t('statistics.revenueOverTime')}</h2>
        {!stats ? <Skeleton className="h-64 w-full" /> : revenueData.length === 0 ? (
          <EmptyState icon="📈" title={t('statistics.noCompletedVisits')} description={t('statistics.noCompletedVisitsDesc')} />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueData} margin={{ left: -20, right: 10 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4af5a" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#d4af5a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272e" vertical={false} />
              <XAxis dataKey="label" stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip formatter={(v) => `${v.toLocaleString()} UZS`} />} />
              <Area type="monotone" dataKey="revenue" stroke="#d4af5a" strokeWidth={2.5} fill="url(#revenueFill)" animationDuration={900} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="font-medium text-text mb-4">{t('statistics.statusBreakdown')}</h2>
          {!stats ? <Skeleton className="h-56 w-full" /> : statusData.length === 0 ? (
            <EmptyState icon="🗂️" title={t('statistics.noAppointmentsInRange')} />
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="label" innerRadius={55} outerRadius={80} paddingAngle={3} animationDuration={800} animationEasing="ease-out">
                    {statusData.map((entry) => <Cell key={entry.name} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-text-muted"><span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                    <span className="text-text font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-medium text-text mb-4">{t('statistics.mostPopularStaff')}</h2>
          {!stats ? <Skeleton className="h-56 w-full" /> : stats.topStaff.length === 0 ? (
            <EmptyState icon="💇" title={t('statistics.noCompletedVisits')} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.topStaff} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272e" horizontal={false} />
                <XAxis type="number" stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="staffName" stroke="#9c9ca6" fontSize={12} tickLine={false} axisLine={false} width={90} />
                <Tooltip content={<ChartTooltip formatter={(v) => t('statistics.visit', { count: v })} />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="count" fill="#d4af5a" radius={[0, 6, 6, 0]} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border-soft">
          <h2 className="font-medium text-text">{t('statistics.employeePerformance')}</h2>
        </div>
        {!staffStats ? (
          <div className="p-6"><Skeleton className="h-40 w-full" /></div>
        ) : staffStats.length === 0 ? (
          <EmptyState icon="💇" title={t('statistics.noCompletedVisits')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-text-muted uppercase tracking-wide text-left">
                  <th className="px-6 py-3 font-medium">{t('statistics.colName')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('statistics.colAppointments')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('statistics.colRevenue')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('statistics.colAvgTicket')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('statistics.colClients')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('statistics.colRating')}</th>
                  <th className="px-6 py-3 font-medium text-right">{t('statistics.colCommissionEarned')}</th>
                </tr>
              </thead>
              <tbody>
                {staffStats.map((s) => (
                  <tr key={s.staffId} className="border-t border-border-soft">
                    <td className="px-6 py-3 text-text font-medium whitespace-nowrap">{s.name}</td>
                    <td className="px-4 py-3 text-text-muted text-right">{s.appointments}</td>
                    <td className="px-4 py-3 text-text text-right whitespace-nowrap">{s.revenue.toLocaleString()} UZS</td>
                    <td className="px-4 py-3 text-text-muted text-right whitespace-nowrap">{s.averageTicket.toLocaleString()} UZS</td>
                    <td className="px-4 py-3 text-text-muted text-right">{s.clients}</td>
                    <td className="px-4 py-3 text-text-muted text-right">{s.rating > 0 ? `⭐ ${s.rating.toFixed(1)}` : '—'}</td>
                    <td className="px-6 py-3 text-text text-right whitespace-nowrap">
                      {s.commissionEarned != null ? `${s.commissionEarned.toLocaleString()} UZS` : <span className="text-text-faint">{t('statistics.noCommissionSet')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-medium text-text mb-4">{t('statistics.mostUsedServices')}</h2>
        {!stats ? <Skeleton className="h-56 w-full" /> : stats.topServices.length === 0 ? (
          <EmptyState icon="✂️" title={t('statistics.noCompletedVisits')} />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.topServices} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272e" vertical={false} />
              <XAxis dataKey="serviceName" stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip formatter={(v) => t('statistics.booking', { count: v })} />} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="count" fill="#5b9df9" radius={[6, 6, 0, 0]} animationDuration={800} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
