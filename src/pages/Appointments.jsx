import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useShopSocket } from '../lib/socket';
import { useToast } from '../components/ToastProvider';
import StatusBadge from '../components/StatusBadge';
import { Card, Button, EmptyState, Textarea } from '../components/ui';
import Modal from '../components/Modal';
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

export default function Appointments() {
  const { t, i18n } = useTranslation();
  const { api, token } = useAuth();
  const { showToast } = useToast();

  const formatDateTime = (iso) => new Date(iso).toLocaleString(localeFor(i18n.language), {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams({ page, limit: 12, ...(status ? { status } : {}) });
    return api.get(`/admin/appointments?${query}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [api, page, status]);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-text">{t('appointments.title')}</h1>
      </div>

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

      <Card className="overflow-hidden">
        {loading && !data ? (
          <div>{Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} />)}</div>
        ) : data?.appointments.length === 0 ? (
          <EmptyState icon="📭" title={t('appointments.noAppointmentsTitle')} description={t('appointments.noAppointmentsDesc')} />
        ) : (
          <div>
            <AnimatePresence initial={false}>
              {data?.appointments.map((appt) => (
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
                    <p className="text-sm font-medium text-text truncate">{appt.userName || t('common.guest')} <span className="text-text-faint font-normal">· {appt.userNumber}</span></p>
                    <p className="text-xs text-text-muted truncate">{appt.serviceName || t('common.service')}{appt.staffName ? ` · ${appt.staffName}` : ''}{appt.price ? ` · ${appt.price.toLocaleString()} UZS` : ''}</p>
                  </div>
                  <div className="text-xs text-text-muted whitespace-nowrap">{formatDateTime(appt.requestedTime)}</div>
                  <StatusBadge status={appt.status} />
                  <div className="flex gap-2 sm:ml-2">
                    {appt.status === 'pending' && (
                      <>
                        <Button variant="primary" className="!px-3 !py-1.5 text-xs" disabled={actioningId === appt._id} onClick={() => runAction(appt._id, 'confirm')}>{t('appointments.confirm')}</Button>
                        <Button variant="danger" className="!px-3 !py-1.5 text-xs" disabled={actioningId === appt._id} onClick={() => openReject(appt)}>{t('appointments.reject')}</Button>
                      </>
                    )}
                    {appt.status === 'confirmed' && (
                      <Button variant="subtle" className="!px-3 !py-1.5 text-xs" disabled={actioningId === appt._id} onClick={() => runAction(appt._id, 'complete')}>{t('appointments.markDone')}</Button>
                    )}
                    {(appt.status === 'confirmed' || appt.status === 'completed') && (
                      <Button variant="ghost" className="!px-3 !py-1.5 text-xs" disabled={actioningId === appt._id} onClick={() => runAction(appt._id, 'no-show')}>{t('appointments.noShow')}</Button>
                    )}
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
    </div>
  );
}
