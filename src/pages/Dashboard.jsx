import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/AuthContext';
import { useShopSocket } from '../lib/socket';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { Card, EmptyState } from '../components/ui';
import { StatCardSkeleton, TableRowSkeleton } from '../components/Skeleton';
import { Link } from 'react-router-dom';

const currency = (n) => `${Math.round(n).toLocaleString()} UZS`;

export default function Dashboard() {
  const { api, token, shop } = useAuth();
  const [stats, setStats] = useState(null);
  const [shopInfo, setShopInfo] = useState(shop);
  const [recent, setRecent] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadRecent = () => api.get('/admin/appointments?limit=6').then((res) => setRecent(res.appointments));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get('/admin/stats/overview'),
      api.get('/admin/shop'),
      api.get('/admin/appointments?limit=6'),
    ]).then(([statsRes, shopRes, appointmentsRes]) => {
      if (cancelled) return;
      setStats(statsRes);
      setShopInfo(shopRes);
      setRecent(appointmentsRes.appointments);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useShopSocket(token, () => {
    loadRecent();
    api.get('/admin/stats/overview').then(setStats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const pendingCount = useMemo(
    () => stats?.statusBreakdown?.find((s) => s.status === 'pending')?.count || 0,
    [stats]
  );

  const shopName = shopInfo?.name?.en || shopInfo?.name?.ru || 'Your shop';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-text">Good to see you 👋</h1>
        <p className="text-text-muted text-sm mt-1">Here's how <span className="text-text">{shopName}</span> is doing this month.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard index={0} label="Appointments (30d)" value={stats.totals.appointments} icon="📅" />
            <StatCard index={1} label="Pending" value={pendingCount} icon="⏳" accent={pendingCount > 0} />
            <StatCard index={2} label="Revenue (30d)" value={stats.totals.revenue} icon="💰" format={currency} />
            <StatCard index={3} label="Rating" value={shopInfo?.rating || 0} icon="⭐" format={(v) => v.toFixed(1)} />
          </>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft">
          <h2 className="font-medium text-text">Recent activity</h2>
          <Link to="/appointments" className="text-xs text-accent hover:text-accent-hover font-medium">View all →</Link>
        </div>

        {loading || recent === null ? (
          <div>{Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} />)}</div>
        ) : recent.length === 0 ? (
          <EmptyState icon="📭" title="No appointments yet" description="New bookings from Telegram will appear here in real time." />
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
                  <p className="text-sm font-medium text-text truncate">{appt.userName || 'Guest'}</p>
                  <p className="text-xs text-text-muted truncate">{appt.serviceName || 'Service'} {appt.staffName ? `· ${appt.staffName}` : ''}</p>
                </div>
                <div className="text-xs text-text-muted whitespace-nowrap hidden sm:block">
                  {new Date(appt.requestedTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
