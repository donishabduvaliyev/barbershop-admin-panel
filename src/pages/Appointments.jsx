import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { CalendarDaysIcon, ListBulletIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../lib/AuthContext';
import { useShopSocket } from '../lib/socket';
import { useToast } from '../components/ToastProvider';
import StatusBadge from '../components/StatusBadge';
import { Card, Button, EmptyState, Textarea, Input } from '../components/ui';
import Modal from '../components/Modal';
import ManualBookingModal from '../components/ManualBookingModal';
import ScheduleCalendar from '../components/ScheduleCalendar';
import { TableRowSkeleton } from '../components/Skeleton';
import { localeFor } from '../lib/locale';

const TAB_KEYS = [
  { key: '', label: 'tabAll' },
  { key: 'pending', label: 'tabPending' },
  { key: 'confirmed', label: 'tabConfirmed' },
  { key: 'completed', label: 'tabCompleted' },
  { key: 'rejected', label: 'tabRejected' },
  { key: 'cancelled', label: 'tabCancelled' },
  { key: 'no-show', label: 'tabNoShow' },
];

const pad = (n) => String(n).padStart(2, '0');
const SOURCE_ICON = { bot: '🤖', phone: '📞', 'walk-in': '🚶' };

function RescheduleModal({ booking, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const { showToast } = useToast();
  const [date, setDate] = useState(() => new Date());
  const [hour, setHour] = useState(null);
  const [saving, setSaving] = useState(false);

  // This component stays mounted across opens (it's always in the JSX
  // tree, gated only by Modal's `open` prop) — a useState initializer only
  // runs once on first mount, so it can't pick up a *later* booking. Reset
  // explicitly whenever a new booking is targeted.
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
      showToast(t('appointments.toastRescheduled'));
      onSaved(updated);
    } catch (err) {
      showToast(err.message || t('appointments.toastError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!booking}
      onClose={onClose}
      title={t('appointments.rescheduleTitle')}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={hour === null || saving} onClick={submit}>{saving ? t('common.saving') : t('common.save')}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {dates.map((d) => (
            <button
              key={d.toISOString()}
              onClick={() => setDate(d)}
              className={clsx('px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap text-center min-w-[64px]', d.toDateString() === date.toDateString() ? 'bg-accent text-black border-accent' : 'bg-surface-3 text-text-muted border-border')}
            >
              <div>{d.toLocaleDateString(i18n.language, { weekday: 'short' })}</div>
              <div>{d.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {hours.map((h) => (
            <button
              key={h}
              onClick={() => setHour(h)}
              className={clsx('px-3 py-1.5 rounded-lg border text-sm transition-all', hour === h ? 'bg-accent text-black border-accent font-semibold' : 'bg-surface-3 text-text-muted border-border')}
            >
              {pad(h)}:00
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function Appointments() {
  const { t, i18n } = useTranslation();
  const { api, token } = useAuth();
  const { showToast } = useToast();

  const formatDateTime = (iso) => new Date(iso).toLocaleString(localeFor(i18n.language), {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const [status, setStatus] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => { api.get('/admin/shop').then(setShop); }, [api]);

  const load = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams({ page, limit: 12, ...(status ? { status } : {}), ...(staffFilter ? { staffId: staffFilter } : {}) });
    return api.get(`/admin/appointments?${query}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [api, page, status, staffFilter]);

  useEffect(() => { load(); }, [load]);

  const filteredAppointments = useMemo(() => {
    if (!data?.appointments) return [];
    if (!search.trim()) return data.appointments;
    const q = search.trim().toLowerCase();
    return data.appointments.filter((a) => (a.userName || '').toLowerCase().includes(q) || (a.userNumber || '').includes(q));
  }, [data, search]);

  // A booking already in view gets its row updated in place (status change
  // animates via layout); anything else just triggers a quiet refetch so
  // pagination counts stay correct without a jarring full-page reload.
  useShopSocket(token, (updated) => {
    setData((prev) => {
      if (!prev) return prev;
      const exists = prev.appointments.some((a) => a._id === updated._id);
      if (exists) {
        return { ...prev, appointments: prev.appointments.map((a) => (a._id === updated._id ? updated : a)) };
      }
      if (page === 1 && (!status || status === updated.status)) {
        return { ...prev, appointments: [updated, ...prev.appointments].slice(0, 12) };
      }
      return prev;
    });
  });

  const runAction = async (id, action, body) => {
    setActioningId(id);
    try {
      const updated = await api.patch(`/admin/appointments/${id}/${action}`, body);
      setData((prev) => ({ ...prev, appointments: prev.appointments.map((a) => (a._id === id ? updated : a)) }));
      showToast(
        action === 'confirm' ? t('appointments.toastConfirmed')
          : action === 'reject' ? t('appointments.toastRejected')
          : action === 'no-show' ? t('appointments.toastNoShow')
          : action === 'cancel' ? t('appointments.toastCancelled')
          : t('appointments.toastCompleted')
      );
    } catch (err) {
      showToast(err.message || t('appointments.toastError'), 'error');
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
      setData((prev) => ({ ...prev, appointments: prev.appointments.map((a) => (a._id === updated._id ? updated : a)) }));
      setNoteTarget(null);
    } catch (err) {
      showToast(err.message || t('appointments.toastError'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-text">{t('appointments.title')}</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface border border-border-soft rounded-lg p-1">
            <button onClick={() => setView('list')} className={clsx('p-1.5 rounded-md', view === 'list' ? 'bg-accent text-black' : 'text-text-muted')}><ListBulletIcon className="w-4 h-4" /></button>
            <button onClick={() => setView('calendar')} className={clsx('p-1.5 rounded-md', view === 'calendar' ? 'bg-accent text-black' : 'text-text-muted')}><CalendarDaysIcon className="w-4 h-4" /></button>
          </div>
          <Button onClick={() => setManualOpen(true)} className="!px-3 !py-2 text-sm"><PlusIcon className="w-4 h-4" /> {t('appointments.manual.newBooking')}</Button>
        </div>
      </div>

      {view === 'calendar' ? (
        <ScheduleCalendar shop={shop} />
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {TAB_KEYS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setStatus(tab.key); setPage(1); }}
                className={clsx(
                  'px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                  status === tab.key ? 'bg-accent text-black' : 'bg-surface text-text-muted hover:text-text border border-border-soft'
                )}
              >
                {t(`appointments.${tab.label}`)}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('appointments.searchPlaceholder')} className="max-w-[220px]" />
            {shop?.staff?.length > 0 && (
              <select
                value={staffFilter}
                onChange={(e) => { setStaffFilter(e.target.value); setPage(1); }}
                className="bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              >
                <option value="">{t('appointments.allStaff')}</option>
                {shop.staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            )}
          </div>

          <Card className="overflow-hidden">
            {loading && !data ? (
              <div>{Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} />)}</div>
            ) : filteredAppointments.length === 0 ? (
              <EmptyState icon="📭" title={t('appointments.noAppointmentsTitle')} description={t('appointments.noAppointmentsDesc')} />
            ) : (
              <div>
                <AnimatePresence initial={false}>
                  {filteredAppointments.map((appt) => (
                    <motion.div
                      key={appt._id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 border-b border-border-soft last:border-0"
                    >
                      <div className="w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center text-sm font-medium text-text-muted shrink-0">
                        {(appt.userName || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text truncate">
                          {appt.userName || t('common.guest')} <span className="text-text-faint font-normal">· {appt.userNumber}</span>
                          {appt.source && appt.source !== 'bot' && <span className="ml-1.5 text-xs" title={t(`appointments.source.${appt.source === 'walk-in' ? 'walkIn' : appt.source}`)}>{SOURCE_ICON[appt.source]}</span>}
                        </p>
                        <p className="text-xs text-text-muted truncate">{appt.serviceName || t('common.service')}{appt.staffName ? ` · ${appt.staffName}` : ''}{appt.price ? ` · ${appt.price.toLocaleString()} UZS` : ''}</p>
                        {appt.adminNotes && <p className="text-xs text-accent/80 truncate mt-0.5">📝 {appt.adminNotes}</p>}
                      </div>
                      <div className="text-xs text-text-muted whitespace-nowrap">{formatDateTime(appt.requestedTime)}</div>
                      <StatusBadge status={appt.status} />
                      <div className="flex gap-2 sm:ml-2 flex-wrap">
                        {appt.status === 'pending' && (
                          <>
                            <Button variant="primary" className="!px-3 !py-1.5 text-xs" disabled={actioningId === appt._id} onClick={() => runAction(appt._id, 'confirm')}>{t('appointments.confirm')}</Button>
                            <Button variant="danger" className="!px-3 !py-1.5 text-xs" disabled={actioningId === appt._id} onClick={() => openReject(appt)}>{t('appointments.reject')}</Button>
                          </>
                        )}
                        {appt.status === 'confirmed' && (
                          <>
                            <Button variant="subtle" className="!px-3 !py-1.5 text-xs" disabled={actioningId === appt._id} onClick={() => runAction(appt._id, 'complete')}>{t('appointments.markDone')}</Button>
                            <Button variant="ghost" className="!px-3 !py-1.5 text-xs" disabled={actioningId === appt._id} onClick={() => setCancelTarget(appt)}>{t('appointments.cancel')}</Button>
                          </>
                        )}
                        {(appt.status === 'pending' || appt.status === 'confirmed') && (
                          <Button variant="ghost" className="!px-3 !py-1.5 text-xs" disabled={actioningId === appt._id} onClick={() => setRescheduleTarget(appt)}>{t('appointments.reschedule')}</Button>
                        )}
                        {(appt.status === 'confirmed' || appt.status === 'completed') && (
                          <Button variant="ghost" className="!px-3 !py-1.5 text-xs" disabled={actioningId === appt._id} onClick={() => runAction(appt._id, 'no-show')}>{t('appointments.noShow')}</Button>
                        )}
                        <Button variant="ghost" className="!px-2.5 !py-1.5 text-xs" onClick={() => openNote(appt)}>📝</Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-border-soft text-sm text-text-muted">
                <span>{t('appointments.pageOf', { current: data.pagination.currentPage, total: data.pagination.totalPages })}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" className="!px-3 !py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('appointments.prev')}</Button>
                  <Button variant="ghost" className="!px-3 !py-1.5 text-xs" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>{t('appointments.next')}</Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={t('appointments.rejectTitle')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={!rejectReason.trim() || actioningId === rejectTarget?._id} onClick={submitReject}>{t('appointments.sendRejection')}</Button>
          </>
        )}
      >
        <p className="text-sm text-text-muted mb-3">{t('appointments.rejectBody')}</p>
        <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t('appointments.rejectPlaceholder')} autoFocus />
      </Modal>

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={t('appointments.cancelTitle')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={actioningId === cancelTarget?._id} onClick={submitCancel}>{t('appointments.cancel')}</Button>
          </>
        )}
      >
        <p className="text-sm text-text-muted">{t('appointments.cancelBody', { name: cancelTarget?.userName })}</p>
      </Modal>

      <RescheduleModal
        booking={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSaved={(updated) => {
          setData((prev) => ({ ...prev, appointments: prev.appointments.map((a) => (a._id === updated._id ? updated : a)) }));
          setRescheduleTarget(null);
        }}
      />

      <Modal
        open={!!noteTarget}
        onClose={() => setNoteTarget(null)}
        title={t('appointments.noteTitle')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setNoteTarget(null)}>{t('common.cancel')}</Button>
            <Button onClick={saveNote}>{t('common.save')}</Button>
          </>
        )}
      >
        <Textarea rows={3} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={t('appointments.notePlaceholder')} autoFocus />
      </Modal>

      <ManualBookingModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={load}
        shop={shop}
      />
    </div>
  );
}
