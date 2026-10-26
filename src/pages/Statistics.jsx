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
  pending: '#f0b84c',
  confirmed: '#5b9df9',
  completed: '#3ddc97',
  rejected: '#f2685c',
  cancelled: '#64646d',
  'no-show': '#ff5c5c',
};

const SOURCE_COLORS = {
  bot: '#5b9df9',
  phone: '#d4af5a',
  'walk-in': '#3ddc97',
};

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-text-muted mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="text-text font-semibold">
          {p.name && `${p.name}: `}{formatter ? formatter(p.value) : p.value}
        </p>
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

  const statusLabelKey = {
    pending: 'pending',
    confirmed: 'confirmed',
    completed: 'completed',
    rejected: 'rejected',
    cancelled: 'cancelled',
    'no-show': 'no-show',
  };

  const statusData = useMemo(
    () => (stats?.statusBreakdown || []).map((s) => ({
      name: s.status,
      label: statusLabelKey[s.status] ? (t(`statusBadge.${statusLabelKey[s.status]}`, s.status)) : s.status,
      value: s.count,
      color: STATUS_COLORS[s.status] || '#666',
    })),
    [stats, t]
  );

  const revenueData = useMemo(
    () => (stats?.revenueOverTime || []).map((d) => ({ ...d, label: shortDateLabel(d.date, i18n.language) })),
    [stats, i18n.language]
  );

  // Peak hours data formatted nicely (08:00 to 22:00)
  const peakHoursData = useMemo(() => {
    if (!stats?.peakHours) return [];
    const map = new Map(stats.peakHours.map((h) => [h.hour, h.count]));
    const list = [];
    for (let h = 8; h <= 22; h++) {
      list.push({
        hour: `${String(h).padStart(2, '0')}:00`,
        count: map.get(h) || 0,
      });
    }
    return list;
  }, [stats]);

  // Source breakdown data with friendly labels
  const sourceData = useMemo(() => {
    if (!stats?.sourceBreakdown) return [];
    return stats.sourceBreakdown.map((s) => ({
      source: s.source,
      label: s.source === 'bot' ? '🤖 Telegram Bot' : s.source === 'phone' ? '📞 Telefon' : '🚶 Jonli (Walk-in)',
      count: s.count,
      revenue: s.revenue,
      color: SOURCE_COLORS[s.source] || '#d4af5a',
    }));
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Header with Range Picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">{t('statistics.title', 'Statistika va hisobotlar')}</h1>
          <p className="text-text-muted text-sm mt-1">{t('statistics.subtitle', 'Do\'koningizning barcha ko\'rsatkichlari va tahlili')}</p>
        </div>
        <div className="flex gap-1.5 bg-surface border border-border-soft rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeDays(r.key)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                rangeDays === r.key ? 'bg-accent text-black font-semibold' : 'text-text-muted hover:text-text'
              )}
            >
              {t(`statistics.${r.labelKey}`, `${r.key} kun`)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards: 6 Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {!stats ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard index={0} label={t('statistics.totalAppointments', 'Jami bandlovlar')} value={stats.totals.appointments} icon="📅" />
            <StatCard index={1} label={t('statistics.completedVisits', 'Bajarilgan tashriflar')} value={stats.totals.completed} icon="✅" />
            <StatCard index={2} label={t('statistics.revenue', 'Jami tushum')} value={stats.totals.revenue} icon="💰" format={(v) => `${Math.round(v).toLocaleString()}`} suffix=" UZS" />
            <StatCard index={3} label={t('statistics.avgTicket', 'O\'rtacha chek')} value={stats.totals.averageTicket || 0} icon="🧾" format={(v) => `${Math.round(v).toLocaleString()}`} suffix=" UZS" />
            <StatCard index={4} label={t('statistics.completionRate', 'Bajarilish ko\'rsatkichi')} value={stats.totals.completionRate || 0} icon="🎯" suffix="%" />
            <StatCard index={5} label={t('statistics.noShowRate', 'Kelmaslik darajasi')} value={stats.totals.noShowRate || 0} icon="🚫" suffix="%" accent={(stats.totals.noShowRate || 0) > 10} />
          </>
        )}
      </div>

      {/* View-to-Booking Conversion Funnel */}
      {stats?.conversionFunnel && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-text">{t('statistics.funnelTitle', 'Konversiya voronkasi (Ko\'rishdan Tashrifgacha)')}</h2>
              <p className="text-xs text-text-muted mt-0.5">{t('statistics.funnelDesc', 'Foydalanuvchilar qanday qilib haqiqiy mijozga aylanishi')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-surface-3 border border-border-soft rounded-xl p-4 text-center">
              <span className="text-2xl">👀</span>
              <p className="text-xl font-bold text-text mt-1">{stats.conversionFunnel.views}</p>
              <p className="text-xs text-text-muted">{t('statistics.shopViews', 'Do\'kon ko\'rishlar soni')}</p>
            </div>

            <div className="bg-surface-3 border border-border-soft rounded-xl p-4 text-center relative">
              <div className="hidden sm:block absolute -left-3.5 top-1/2 -translate-y-1/2 text-accent text-sm font-bold bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                {stats.conversionFunnel.viewToBookingRate}%
              </div>
              <span className="text-2xl">📝</span>
              <p className="text-xl font-bold text-text mt-1">{stats.conversionFunnel.bookings}</p>
              <p className="text-xs text-text-muted">{t('statistics.bookingsCreated', 'Bandlov yaratildi')}</p>
            </div>

            <div className="bg-surface-3 border border-border-soft rounded-xl p-4 text-center relative">
              <div className="hidden sm:block absolute -left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 text-sm font-bold bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                {stats.conversionFunnel.bookingToCompletedRate}%
              </div>
              <span className="text-2xl">🏆</span>
              <p className="text-xl font-bold text-emerald-400 mt-1">{stats.conversionFunnel.completed}</p>
              <p className="text-xs text-text-muted">{t('statistics.completedVisits', 'Muvaffaqiyatli tashriflar')}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Revenue Over Time Chart */}
      <Card className="p-6">
        <h2 className="font-semibold text-text mb-4">{t('statistics.revenueOverTime', 'Kunlik daromad dinamikasi')}</h2>
        {!stats ? (
          <Skeleton className="h-64 w-full" />
        ) : revenueData.length === 0 ? (
          <EmptyState icon="📈" title={t('statistics.noCompletedVisits', 'Muvaffaqiyatli tashriflar yo\'q')} description={t('statistics.noCompletedVisitsDesc', 'Ushbu muddat ichida daromad keltirgan bandlovlar mavjud emas')} />
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

      {/* Peak Hours & Day of Week Grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Peak Hours Traffic */}
        <Card className="p-6">
          <h2 className="font-semibold text-text mb-1">{t('statistics.peakHoursTitle', 'Eng gavjum soatlar (Peak Hours)')}</h2>
          <p className="text-xs text-text-muted mb-4">{t('statistics.peakHoursDesc', 'Kun davomida mijozlar qaysi soatlarda ko\'p kelishi')}</p>
          {!stats ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={peakHoursData} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272e" vertical={false} />
                <XAxis dataKey="hour" stroke="#64646d" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip formatter={(v) => `${v} ta bandlov`} />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="count" fill="#d4af5a" radius={[4, 4, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Day of Week Breakdown */}
        <Card className="p-6">
          <h2 className="font-semibold text-text mb-1">{t('statistics.dayOfWeekTitle', 'Hafta kunlari bo\'yicha faollik')}</h2>
          <p className="text-xs text-text-muted mb-4">{t('statistics.dayOfWeekDesc', 'Haftaning qaysi kunlarida ko\'proq buyurtmalar tushadi')}</p>
          {!stats ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.dayOfWeekBreakdown || []} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272e" vertical={false} />
                <XAxis dataKey="dayName" stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(d) => t(`common.daysShort.${d}`, d.slice(0, 3))} />
                <YAxis stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip formatter={(v) => `${v} ta bandlov`} />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="count" fill="#5b9df9" radius={[4, 4, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Status Breakdown & Booking Source Breakdown */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Status Breakdown */}
        <Card className="p-6">
          <h2 className="font-semibold text-text mb-4">{t('statistics.statusBreakdown', 'Bandlovlar holati taqsimoti')}</h2>
          {!stats ? (
            <Skeleton className="h-56 w-full" />
          ) : statusData.length === 0 ? (
            <EmptyState icon="🗂️" title={t('statistics.noAppointmentsInRange', 'Bandlovlar topilmadi')} />
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
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-text-muted">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      {s.label}
                    </span>
                    <span className="text-text font-semibold tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Booking Source Breakdown */}
        <Card className="p-6">
          <h2 className="font-semibold text-text mb-4">{t('statistics.sourceBreakdownTitle', 'Mijozlar manbasi (Bot / Telefon / Jonli)')}</h2>
          {!stats ? (
            <Skeleton className="h-56 w-full" />
          ) : sourceData.length === 0 ? (
            <EmptyState icon="📞" title={t('statistics.noSourceData', 'Manba ma\'lumoti mavjud emas')} />
          ) : (
            <div className="space-y-4">
              {sourceData.map((s) => {
                const total = stats.totals.appointments || 1;
                const pct = Math.round((s.count / total) * 100);
                return (
                  <div key={s.source} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-text">{s.label}</span>
                      <span className="text-text-muted tabular-nums">{s.count} ta ({pct}%) · {s.revenue.toLocaleString()} UZS</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Staff Performance Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border-soft">
          <h2 className="font-semibold text-text">{t('statistics.employeePerformance', 'Sartaroshlar ish samaradorligi')}</h2>
        </div>
        {!staffStats ? (
          <div className="p-6"><Skeleton className="h-40 w-full" /></div>
        ) : staffStats.length === 0 ? (
          <EmptyState icon="💇" title={t('statistics.noCompletedVisits', 'Muvaffaqiyatli tashriflar yo\'q')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-text-muted uppercase tracking-wide text-left">
                  <th className="px-6 py-3 font-medium">{t('statistics.colName', 'Ism')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('statistics.colAppointments', 'Qabullar')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('statistics.colRevenue', 'Tushum')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('statistics.colAvgTicket', 'O\'rtacha chek')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('statistics.colClients', 'Mijozlar')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('statistics.colRating', 'Reyting')}</th>
                  <th className="px-6 py-3 font-medium text-right">{t('statistics.colCommissionEarned', 'Hisoblangan ulush')}</th>
                </tr>
              </thead>
              <tbody>
                {staffStats.map((s) => (
                  <tr key={s.staffId} className="border-t border-border-soft hover:bg-surface-2/40 transition-colors">
                    <td className="px-6 py-3 text-text font-medium whitespace-nowrap">{s.name}</td>
                    <td className="px-4 py-3 text-text-muted text-right tabular-nums">{s.appointments}</td>
                    <td className="px-4 py-3 text-text text-right whitespace-nowrap tabular-nums">{s.revenue.toLocaleString()} UZS</td>
                    <td className="px-4 py-3 text-text-muted text-right whitespace-nowrap tabular-nums">{s.averageTicket.toLocaleString()} UZS</td>
                    <td className="px-4 py-3 text-text-muted text-right tabular-nums">{s.clients}</td>
                    <td className="px-4 py-3 text-text-muted text-right">{s.rating > 0 ? `⭐ ${s.rating.toFixed(1)}` : '—'}</td>
                    <td className="px-6 py-3 text-text text-right whitespace-nowrap tabular-nums">
                      {s.commissionEarned != null ? `${s.commissionEarned.toLocaleString()} UZS` : <span className="text-text-faint">{t('statistics.noCommissionSet', '—')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Most Used Services Chart */}
      <Card className="p-6">
        <h2 className="font-semibold text-text mb-4">{t('statistics.mostUsedServices', 'Eng ko\'p talab qilingan xizmatlar')}</h2>
        {!stats ? (
          <Skeleton className="h-56 w-full" />
        ) : stats.topServices.length === 0 ? (
          <EmptyState icon="✂️" title={t('statistics.noCompletedVisits', 'Muvaffaqiyatli tashriflar yo\'q')} />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.topServices} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272e" vertical={false} />
              <XAxis dataKey="serviceName" stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64646d" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip formatter={(v) => t('statistics.visit', { count: v })} />} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="count" fill="#5b9df9" radius={[6, 6, 0, 0]} animationDuration={800} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
