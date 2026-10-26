import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ListBulletIcon,
  Squares2X2Icon,
  ArrowRightIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useAuth } from '../lib/AuthContext';
import { useShopSocket } from '../lib/socket';
import { useToast } from '../components/ToastProvider';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { Card, Button, EmptyState, Input, Textarea } from '../components/ui';
import Modal from '../components/Modal';
import ManualBookingModal from '../components/ManualBookingModal';
import ScheduleCalendar from '../components/ScheduleCalendar';
import { StatCardSkeleton, TableRowSkeleton } from '../components/Skeleton';
import { localeFor } from '../lib/locale';

const currency = (n) => `${Math.round(n || 0).toLocaleString()} UZS`;
const SOURCE_ICON = { bot: '🤖', phone: '📞', 'walk-in': '🚶' };

function RescheduleModal({ booking, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const { showToast } = useToast();
  const [date, setDate] = useState(() => new Date());
  const [hour, setHour] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!booking) return;
    const requested = new Date(booking.requestedTime);
    setDate(requested);
    setHour(requested.getHours());
  }, [booking]);

  const dates = useMemo(() => [...Array(7)].map((_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d;
  }), []);

  const hours = useMemo(() => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const start = isToday ? now.getHours() + 1 : 8;
    const list = [];
    for (let h = Math.max(start, 8); h <= 22; h++) list.push(h);
    return list;
  }, [date]);

  const submit = async () => {
    setSaving(true);
    try {
      const requestedDate = new Date(date);
      requestedDate.setHours(hour, 0, 0, 0);
      const updated = await api.patch(`/admin/appointments/${booking._id}/reschedule`, { requestedTime: requestedDate.toISOString() });
      showToast(t('appointments.toastRescheduled', 'Vaqti o\'zgartirildi'));
      onSaved(updated);
    } catch (err) {
      showToast(err.message || t('appointments.toastError', 'Xatolik yuz berdi'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!booking}
      onClose={onClose}
      title={t('appointments.rescheduleTitle', 'Vaqtni o\'zgartirish')}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Bekor qilish')}</Button>
          <Button disabled={hour === null || saving} onClick={submit}>{saving ? t('common.saving', 'Saqlanmoqda...') : t('common.save', 'Saqlash')}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {dates.map((d) => (
            <button
              key={d.toISOString()}
              onClick={() => setDate(d)}
              className={clsx('press-spring px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap text-center min-w-[64px] cursor-pointer', d.toDateString() === date.toDateString() ? 'btn-gold-admin border-accent font-semibold' : 'bg-surface-3 text-text-muted border-border/80 hover:text-text hover:bg-surface-2')}
            >
              <div>{d.toLocaleDateString(i18n.language, { weekday: 'short' })}</div>
              <div className="tabular-nums">{d.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}</div>
            </button>
          ))}
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            {hours.map((h) => (
              <button
                key={h}
                onClick={() => setHour(h)}
                className={clsx('press-spring px-3 py-1.5 rounded-lg border text-sm tabular-nums cursor-pointer', hour === h ? 'btn-gold-admin border-accent font-semibold' : 'bg-surface-3 text-text-muted border-border/80 hover:text-text hover:bg-surface-2')}
              >
                {String(h).padStart(2, '0')}:00
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { api, token, shop } = useAuth();
  const { showToast } = useToast();

  const [today, setToday] = useState(null);
  const [shopInfo, setShopInfo] = useState(shop);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);

  // Schedule / Appointments View State
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [actioningId, setActioningId] = useState(null);

  // Modals
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    window.__openManualBooking = () => setManualOpen(true);
    const handleMsg = (e) => {
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d === 'OPEN_NEW_BOOKING' || d?.type === 'OPEN_NEW_BOOKING') {
          setManualOpen(true);
        }
      } catch {}
    };
    window.addEventListener('message', handleMsg);
    document.addEventListener('message', handleMsg);
    return () => {
      delete window.__openManualBooking;
      window.removeEventListener('message', handleMsg);
      document.removeEventListener('message', handleMsg);
    };
  }, []);

  const loadTodayStats = useCallback(() => {
    return api.get('/admin/stats/today').then(setToday).catch(() => {});
  }, [api]);

  const loadTodayAppointments = useCallback(() => {
    setScheduleLoading(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const query = new URLSearchParams({
      from: startOfDay.toISOString(),
      to: endOfDay.toISOString(),
      limit: 50,
    });

    return api.get(`/admin/appointments?${query}`)
      .then((res) => {
        // Sort by requestedTime ascending for chronological schedule
        const sorted = (res.appointments || []).sort(
          (a, b) => new Date(a.requestedTime).getTime() - new Date(b.requestedTime).getTime()
        );
        setAppointments(sorted);
      })
      .catch(() => setAppointments([]))
      .finally(() => setScheduleLoading(false));
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadTodayStats(),
      api.get('/admin/shop').then(setShopInfo).catch(() => {}),
      loadTodayAppointments(),
    ]).finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [loadTodayStats, loadTodayAppointments, api]);

  useShopSocket(token, () => {
    loadTodayAppointments();
    loadTodayStats();
  });

  const runAction = async (id, action, body) => {
    setActioningId(id);
    try {
      const updated = await api.patch(`/admin/appointments/${id}/${action}`, body);
      setAppointments((prev) => prev.map((a) => (a._id === id ? updated : a)));
      loadTodayStats();
      showToast(
        action === 'confirm' ? t('appointments.toastConfirmed', 'Tasdiqlandi')
          : action === 'reject' ? t('appointments.toastRejected', 'Rad etildi')
          : action === 'no-show' ? t('appointments.toastNoShow', 'Kelmadi deb belgilandi')
          : action === 'cancel' ? t('appointments.toastCancelled', 'Bekor qilindi')
          : t('appointments.toastCompleted', 'Bajarildi deb belgilandi')
      );
    } catch (err) {
      showToast(err.message || t('appointments.toastError', 'Xatolik yuz berdi'), 'error');
    } finally {
      setActioningId(null);
    }
  };

  const openReject = (appt) => { setRejectTarget(appt); setRejectReason(''); };
  const submitReject = async () => {
    if (!rejectReason.trim()) return;
    await runAction(rejectTarget._id, 'reject', { reason: rejectReason.trim() });
    setRejectTarget(null);
  };

  const submitCancel = async () => {
    await runAction(cancelTarget._id, 'cancel', {});
    setCancelTarget(null);
  };

  const openNote = (appt) => { setNoteTarget(appt); setNoteDraft(appt.adminNotes || ''); };
  const saveNote = async () => {
    try {
      const updated = await api.patch(`/admin/appointments/${noteTarget._id}/notes`, { note: noteDraft.trim() });
      setAppointments((prev) => prev.map((a) => (a._id === noteTarget._id ? updated : a)));
      showToast(t('appointments.toastNoteSaved', 'Izoh saqlandi'));
      setNoteTarget(null);
    } catch (err) {
      showToast(err.message || t('appointments.toastError', 'Xatolik yuz berdi'), 'error');
    }
  };

  const filteredAppointments = useMemo(() => {
    if (!search.trim()) return appointments;
    const q = search.trim().toLowerCase();
    return appointments.filter(
      (a) => (a.userName || '').toLowerCase().includes(q) || (a.userNumber || '').includes(q) || (a.serviceName || '').toLowerCase().includes(q)
    );
  }, [appointments, search]);

  const shopName = shopInfo?.name?.en || shopInfo?.name?.uz || shopInfo?.name?.ru || t('common.yourShop', 'Sizning do\'koningiz');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">
            {t('dashboard.greeting', 'Xush kelibsiz')}
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            {t('dashboard.subtitlePrefix', 'Boshqaruv:')} <span className="text-text font-medium">{shopName}</span>
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setManualOpen(true)}
          className="!px-4 !py-2.5 text-sm font-semibold flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4 stroke-[2.5]" />
          {t('appointments.manual.newBooking', 'Yangi bandlov')}
        </Button>
      </div>

      {/* Daily KPI Strip with Direct Link to Full Statistics */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
              {t('dashboard.today', 'Bugungi ko\'rsatkichlar')}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
              {new Date().toLocaleDateString(localeFor(i18n.language), { month: 'short', day: 'numeric' })}
            </span>
          </div>

          <Link
            to="/statistics"
            className="group flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover font-semibold px-3 py-1.5 rounded-lg bg-surface-2 border border-border-soft hover:border-accent/40 transition-all shadow-sm"
          >
            <ChartBarIcon className="w-3.5 h-3.5 text-accent" />
            <span>{t('dashboard.viewFullStats', 'To\'liq statistika')}</span>
            <ArrowRightIcon className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading || !today ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                index={0}
                label={t('dashboard.appointments', 'Bugungi bandlovlar')}
                value={today.appointments}
                icon="📅"
              />
              <StatCard
                index={1}
                label={t('dashboard.completed', 'Bajarilgan tashriflar')}
                value={today.completed}
                icon="✅"
              />
              <StatCard
                index={2}
                label={t('dashboard.revenue', 'Bugungi tushum')}
                value={today.revenue}
                icon="💰"
                format={currency}
              />
              <StatCard
                index={3}
                label={t('dashboard.pending', 'Kutilayotganlar')}
                value={today.appointments - today.completed - today.cancelled - today.noShows}
                icon="⏳"
                accent={(today.appointments - today.completed - today.cancelled - today.noShows) > 0}
              />
            </>
          )}
        </div>
      </div>

      {/* Interactive Appointments Schedule Section */}
      <Card className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-base text-text flex items-center gap-2">
              <CalendarDaysIcon className="w-5 h-5 text-accent" />
              {t('dashboard.todaySchedule', 'Bugungi qabullar jadvali')}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {t('dashboard.todayScheduleDesc', 'Kunlik navbatlar, mijozlar va xizmatlar holati')}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Table List vs Barber Grid */}
            <div className="flex items-center bg-surface-3 border border-border-soft rounded-lg p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer',
                  viewMode === 'table' ? 'bg-accent text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text'
                )}
              >
                <ListBulletIcon className="w-3.5 h-3.5" />
                <span>{t('dashboard.viewTable', 'Ro\'yxat')}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer',
                  viewMode === 'grid' ? 'bg-accent text-black font-semibold shadow-sm' : 'text-text-muted hover:text-text'
                )}
              >
                <Squares2X2Icon className="w-3.5 h-3.5" />
                <span>{t('dashboard.viewGrid', 'Sartaroshlar jadvali')}</span>
              </button>
            </div>

            {viewMode === 'table' && (
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('appointments.searchPlaceholder', 'Qidirish...')}
                className="!py-1.5 !text-xs max-w-[170px]"
              />
            )}
          </div>
        </div>

        {/* View Mode Content */}
        {viewMode === 'grid' ? (
          <div className="p-4">
            <ScheduleCalendar shop={shopInfo} />
          </div>
        ) : (
          <div>
            {scheduleLoading ? (
              <div className="p-2">
                {Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} />)}
              </div>
            ) : filteredAppointments.length === 0 ? (
              <EmptyState
                icon="📭"
                title={t('dashboard.noTodayAppointments', 'Bugun hech qanday bandlov yo\'q')}
                description={t('dashboard.noTodayAppointmentsDesc', 'Yangi mijoz qabul qilish uchun "+ Yangi bandlov" tugmasini bosing')}
              />
            ) : (
              <div className="divide-y divide-border-soft">
                {filteredAppointments.map((appt, i) => {
                  const timeStr = new Date(appt.requestedTime).toLocaleTimeString(localeFor(i18n.language), {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <motion.div
                      key={appt._id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="p-4 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-surface-2/60 transition-colors"
                    >
                      {/* Left: Time + Customer Info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="px-2.5 py-1.5 rounded-lg bg-surface-3 border border-border-soft text-center shrink-0">
                          <span className="text-xs font-bold text-accent tabular-nums">{timeStr}</span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-text truncate">
                              {appt.userName || t('common.guest', 'Mehmon')}
                            </span>
                            {appt.userNumber && (
                              <a
                                href={`tel:${appt.userNumber}`}
                                className="text-xs text-text-faint hover:text-accent flex items-center gap-1 font-mono"
                              >
                                <PhoneIcon className="w-3 h-3" />
                                {appt.userNumber}
                              </a>
                            )}
                            {appt.source && appt.source !== 'bot' && (
                              <span className="text-xs" title={appt.source}>
                                {SOURCE_ICON[appt.source]}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-text-muted flex-wrap">
                            <span className="text-text font-medium">✂️ {appt.serviceName || t('common.service', 'Xizmat')}</span>
                            <span>•</span>
                            <span>💈 {appt.staffName || t('appointments.anyBarber', 'Har qanday bo\'sh')}</span>
                            {appt.price ? (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-accent/90">{currency(appt.price)}</span>
                              </>
                            ) : null}
                          </div>

                          {appt.adminNotes && (
                            <p className="text-xs text-accent/80 mt-1 flex items-center gap-1">
                              <span>📝</span>
                              <span className="italic">{appt.adminNotes}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Status + Quick Actions */}
                      <div className="flex items-center gap-2 flex-wrap self-end md:self-center shrink-0">
                        <StatusBadge status={appt.status} />

                        {appt.status === 'pending' && (
                          <>
                            <Button
                              variant="primary"
                              className="!px-2.5 !py-1 text-xs"
                              disabled={actioningId === appt._id}
                              onClick={() => runAction(appt._id, 'confirm')}
                            >
                              {t('appointments.confirm', 'Tasdiqlash')}
                            </Button>
                            <Button
                              variant="danger"
                              className="!px-2.5 !py-1 text-xs"
                              disabled={actioningId === appt._id}
                              onClick={() => openReject(appt)}
                            >
                              {t('appointments.reject', 'Rad')}
                            </Button>
                          </>
                        )}

                        {appt.status === 'confirmed' && (
                          <>
                            <Button
                              variant="subtle"
                              className="!px-2.5 !py-1 text-xs"
                              disabled={actioningId === appt._id}
                              onClick={() => runAction(appt._id, 'complete')}
                            >
                              {t('appointments.markDone', 'Tugatildi')}
                            </Button>
                            <Button
                              variant="ghost"
                              className="!px-2.5 !py-1 text-xs"
                              disabled={actioningId === appt._id}
                              onClick={() => setCancelTarget(appt)}
                            >
                              {t('appointments.cancel', 'Bekor')}
                            </Button>
                          </>
                        )}

                        {(appt.status === 'pending' || appt.status === 'confirmed') && (
                          <Button
                            variant="ghost"
                            className="!px-2.5 !py-1 text-xs"
                            disabled={actioningId === appt._id}
                            onClick={() => setRescheduleTarget(appt)}
                          >
                            {t('appointments.reschedule', 'Ko\'chirish')}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          className="!px-2 !py-1 text-xs"
                          onClick={() => openNote(appt)}
                          title={t('appointments.addNote', 'Izoh qoldirish')}
                        >
                          📝
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Manual Booking Modal */}
      <ManualBookingModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          loadTodayAppointments();
          loadTodayStats();
        }}
        shop={shopInfo}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        booking={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSaved={(updated) => {
          setAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)));
          setRescheduleTarget(null);
          loadTodayStats();
        }}
      />

      {/* Reject Modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={t('appointments.rejectTitle', 'Bandlovni rad etish')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>{t('common.cancel', 'Bekor qilish')}</Button>
            <Button variant="danger" disabled={!rejectReason.trim()} onClick={submitReject}>{t('appointments.reject', 'Rad etish')}</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-muted">{t('appointments.rejectPrompt', 'Iltimos, rad etish sababini kiriting:')}</p>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('appointments.rejectPlaceholder', 'Sabab...')}
            autoFocus
          />
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={t('appointments.cancelTitle', 'Bandlovni bekor qilish')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>{t('common.cancel', 'Ortga')}</Button>
            <Button variant="danger" onClick={submitCancel}>{t('appointments.confirmCancel', 'Ha, bekor qilinsin')}</Button>
          </>
        )}
      >
        <p className="text-sm text-text-muted">{t('appointments.cancelPrompt', 'Ushbu bandlovni bekor qilishni xohlaysizmi?')}</p>
      </Modal>

      {/* Note Modal */}
      <Modal
        open={!!noteTarget}
        onClose={() => setNoteTarget(null)}
        title={t('appointments.noteTitle', 'Bandlov izohi')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setNoteTarget(null)}>{t('common.cancel', 'Bekor qilish')}</Button>
            <Button onClick={saveNote}>{t('common.save', 'Saqlash')}</Button>
          </>
        )}
      >
        <Textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder={t('appointments.notePlaceholder', 'Mijoz yoki xizmat haqida maxsus eslatma...')}
          autoFocus
        />
      </Modal>
    </div>
  );
}
