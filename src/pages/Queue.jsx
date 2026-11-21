import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import {
  PlusIcon,
  QrCodeIcon,
  BellAlertIcon,
  CheckIcon,
  XMarkIcon,
  PhoneIcon,
  PrinterIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useShopSocket } from '../lib/socket';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Field, Input, EmptyState } from '../components/ui';
import Modal from '../components/Modal';
import CheckoutModal from '../components/CheckoutModal';
import { TableRowSkeleton } from '../components/Skeleton';

const STATUS_STYLE = {
  waiting: 'bg-warning/15 text-warning border-warning/30',
  called: 'bg-info/15 text-info border-info/30',
  in_chair: 'bg-success/15 text-success border-success/30',
};

export default function Queue() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { api, token, shop } = useAuth();
  const { showToast } = useToast();

  const [queue, setQueue] = useState(null);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [busyId, setBusyId] = useState(null);

  // Add Walk-in modal
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setAddOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', staffId: '', serviceId: '', serviceName: '' });
  const [adding, setAdding] = useState(false);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [resolvedShopId, setResolvedShopId] = useState(() => {
    const candidate = shop?._id || (typeof shop?.id === 'string' && /^[a-f0-9]{24}$/i.test(shop.id) ? shop.id : '');
    return candidate;
  });

  // QR Poster modal
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Optional 1-click Checkout after completing
  const [checkoutTarget, setCheckoutTarget] = useState(null);

  const loadUpcoming = useCallback(() => {
    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    api.get(`/admin/appointments?from=${hourStart.toISOString()}&to=${twoHoursLater.toISOString()}&limit=20`)
      .then((res) => {
        const active = (res.appointments || []).filter(
          (a) => (a.status === 'pending' || a.status === 'confirmed') && a.source !== 'walk-in'
        );
        setUpcomingBookings(active);
      })
      .catch(() => {});
  }, [api]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await api.get('/admin/waitlist');
      setQueue(res.queue || []);
    } catch (err) {
      showToast(err.message || t('queue.toastLoadError', 'Failed to load queue'), 'error');
    }
  }, [api, showToast, t]);

  useEffect(() => {
    loadQueue();
    loadUpcoming();
    api.get('/admin/shop').then((s) => {
      if (s?._id) setResolvedShopId(s._id);
      setStaff(s.staff || []);
      setServices(s.services || []);
    }).catch(() => {});
  }, [api, loadQueue, loadUpcoming]);

  // Real-time live queue & appointment updates via Socket.io
  useShopSocket(token, () => {
    loadQueue();
    loadUpcoming();
  }, 'waitlist:update');

  useShopSocket(token, () => {
    loadUpcoming();
  }, 'appointment:update');

  const customerBaseUrl = import.meta.env.VITE_CUSTOMER_APP_URL || 'https://barbershop-telegram-bot.netlify.app';
  const checkInUrl = resolvedShopId ? `${customerBaseUrl}/waitlist/${resolvedShopId}` : '';

  const openQrModal = async () => {
    if (!checkInUrl) {
      showToast(t('queue.toastLoadError', 'Shop ID still loading, please try again.'), 'error');
      return;
    }
    setQrOpen(true);
    try {
      const dataUrl = await QRCode.toDataURL(checkInUrl, {
        width: 512,
        margin: 2,
        color: { dark: '#0a0a0c', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrDataUrl('');
    }
  };

  const handleAddWalkIn = async (e) => {
    e.preventDefault();
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      showToast(t('queue.namePhoneRequired', 'Name and phone are required'), 'error');
      return;
    }
    setAdding(true);
    try {
      await api.post('/admin/waitlist', {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        staffId: form.staffId || null,
        serviceId: form.serviceId || null,
        serviceName: form.serviceName.trim(),
      });
      showToast(t('queue.toastAdded', 'Client added to queue'));
      setAddOpen(false);
      setForm({ customerName: '', customerPhone: '', staffId: '', serviceId: '', serviceName: '' });
      await loadQueue();
    } catch (err) {
      showToast(err.message || t('queue.toastError', 'Failed to add client'), 'error');
    } finally {
      setAdding(false);
    }
  };

  const transition = async (entry, action) => {
    setBusyId(entry._id);
    // Optimistic UI update for zero-latency feel
    const nextStatusMap = { call: 'called', seat: 'in_chair' };
    if (action === 'cancel' || action === 'complete') {
      setQueue((prev) => (prev || []).filter((e) => e._id !== entry._id));
    } else if (nextStatusMap[action]) {
      setQueue((prev) => (prev || []).map((e) => (e._id === entry._id ? { ...e, status: nextStatusMap[action] } : e)));
    }

    try {
      const res = await api.patch(`/admin/waitlist/${entry._id}/${action}`, {});
      await loadQueue();
      if (action === 'call') showToast(t('queue.toastCalled', 'Client called to chair'));
      if (action === 'seat') showToast(t('queue.toastSeated', 'Client seated in chair'));
      if (action === 'cancel') showToast(t('queue.toastCancelled', 'Removed from queue'));
      if (action === 'complete') {
        showToast(t('queue.toastCompleted', 'Visit completed'));
        const matchedService = services.find(
          (sv) =>
            sv.name?.uz === entry.serviceName ||
            sv.name?.en === entry.serviceName ||
            sv.name?.ru === entry.serviceName
        );
        const resolvedPrice = res?.entry?.price ?? matchedService?.price ?? 0;
        setCheckoutTarget({
          initialAmount: resolvedPrice || '',
          price: resolvedPrice,
          paidAmount: 0,
          bookingId: res?.entry?.bookingId || entry.bookingId || null,
          staffId: entry.staffId || null,
          staffName: entry.staffName || '',
          customerName: entry.customerName,
          customerPhone: entry.customerPhone,
          description: entry.serviceName || t('queue.walkInService', 'Walk-In Service'),
        });
      }
    } catch (err) {
      await loadQueue(); // Revert optimistic update on failure
      showToast(err.message || t('queue.toastError', 'Action failed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const waitingCount = (queue || []).filter((e) => e.status === 'waiting').length;
  const calledCount = (queue || []).filter((e) => e.status === 'called').length;
  const inChairCount = (queue || []).filter((e) => e.status === 'in_chair').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">
            {t('queue.title', 'Live Walk-In Queue')}
          </h1>
          <p className="text-sm text-text-muted">
            {t('queue.subtitle', 'Real-time digital waitlist with instant Telegram turn alerts')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="subtle" onClick={openQrModal}>
            <QrCodeIcon className="w-4 h-4" />
            {t('queue.qrPosterBtn', 'QR Poster')}
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon className="w-4 h-4" />
            {t('queue.addWalkInBtn', 'Add Walk-In')}
          </Button>
        </div>
      </div>

      {/* Live Status Strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 flex items-center justify-between">
          <span className="text-xs font-medium text-text-muted uppercase">{t('queue.statusWaiting', 'Waiting')}</span>
          <span className="text-xl font-semibold text-warning tabular-nums">{waitingCount}</span>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <span className="text-xs font-medium text-text-muted uppercase">{t('queue.statusCalled', 'Called')}</span>
          <span className="text-xl font-semibold text-info tabular-nums">{calledCount}</span>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <span className="text-xs font-medium text-text-muted uppercase">{t('queue.statusInChair', 'In Chair')}</span>
          <span className="text-xl font-semibold text-success tabular-nums">{inChairCount}</span>
        </Card>
      </div>

      {/* Unified Schedule Context: Upcoming Scheduled Bookings (Next 2h) */}
      {upcomingBookings.length > 0 && (
        <Card className="p-4 space-y-2.5 border-accent/25">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-accent uppercase tracking-wide">
              📅 {t('queue.upcomingBookingsTitle', 'Upcoming Scheduled Appointments (Next 2h)')}
            </span>
            <span className="text-xs text-text-muted tabular-nums">{upcomingBookings.length}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {upcomingBookings.map((b) => {
              const hhmm = new Date(b.requestedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={b._id}
                  className="shrink-0 px-3 py-2 rounded-xl bg-surface-2 border border-border-soft text-xs space-y-0.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-accent tabular-nums">{hhmm}</span>
                    <span className="font-medium text-text truncate max-w-[120px]">{b.userName || 'Client'}</span>
                  </div>
                  <p className="text-[11px] text-text-muted truncate max-w-[160px]">
                    {b.staffName || 'Any'} {b.serviceName ? `· ${b.serviceName}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Queue List */}
      {queue === null ? (
        <Card className="p-4 space-y-3">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </Card>
      ) : queue.length === 0 ? (
        <Card>
          <EmptyState
            icon="🪑"
            title={t('queue.emptyTitle', 'No walk-in clients waiting')}
            description={t('queue.emptyDesc', 'Add a walk-in guest manually or display the reception QR code for self check-in.')}
            action={(
              <Button onClick={() => setAddOpen(true)}>
                <PlusIcon className="w-4 h-4" />
                {t('queue.addWalkInBtn', 'Add Walk-In')}
              </Button>
            )}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {queue.map((entry) => {
              const isBusy = busyId === entry._id;
              return (
                <motion.div
                  key={entry._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
                        <span className="font-display font-bold text-accent text-lg tabular-nums">
                          #{entry.queueNumber}
                        </span>
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-text truncate">{entry.customerName}</h3>
                          <span
                            className={clsx(
                              'text-[11px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide',
                              STATUS_STYLE[entry.status] || 'bg-surface-3 text-text-muted border-border'
                            )}
                          >
                            {t(`queue.status_${entry.status}`, entry.status.replace('_', ' '))}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                          <a href={`tel:${entry.customerPhone}`} className="inline-flex items-center gap-1 hover:text-accent">
                            <PhoneIcon className="w-3.5 h-3.5" />
                            <span className="tabular-nums">{entry.customerPhone}</span>
                          </a>
                          {entry.staffName && <span>· {entry.staffName}</span>}
                          {entry.serviceName && <span>· {entry.serviceName}</span>}
                          {entry.status === 'waiting' && (
                            <span className="text-warning tabular-nums">· ~{entry.estimatedWaitMinutes} min</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {entry.status === 'waiting' && (
                        <Button
                          variant="subtle"
                          disabled={isBusy}
                          onClick={() => transition(entry, 'call')}
                          className="min-h-[40px] px-3 text-xs"
                        >
                          <BellAlertIcon className="w-4 h-4 text-info" />
                          {t('queue.callBtn', 'Call')}
                        </Button>
                      )}
                      {(entry.status === 'waiting' || entry.status === 'called') && (
                        <Button
                          variant="primary"
                          disabled={isBusy}
                          onClick={() => transition(entry, 'seat')}
                          className="min-h-[40px] px-3 text-xs"
                        >
                          {t('queue.seatBtn', 'Seat in Chair')}
                        </Button>
                      )}
                      {entry.status === 'in_chair' && (
                        <Button
                          variant="primary"
                          disabled={isBusy}
                          onClick={() => transition(entry, 'complete')}
                          className="min-h-[40px] px-3 text-xs"
                        >
                          <CheckIcon className="w-4 h-4" />
                          {t('queue.completeBtn', 'Complete & Pay')}
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        disabled={isBusy}
                        onClick={() => transition(entry, 'cancel')}
                        className="min-h-[40px] px-2.5 text-xs"
                        title={t('common.cancel', 'Cancel')}
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Walk-In Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('queue.addWalkInBtn', 'Add Walk-In Client')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button disabled={adding} onClick={handleAddWalkIn}>
              {adding ? t('common.saving', 'Adding...') : t('queue.addToQueueSubmit', 'Add to Queue')}
            </Button>
          </>
        )}
      >
        <form onSubmit={handleAddWalkIn} className="space-y-4">
          <Field label={t('queue.clientNameLabel', 'Client Name')}>
            <Input
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              placeholder="Aziz"
              required
            />
          </Field>

          <Field label={t('queue.clientPhoneLabel', 'Phone Number')}>
            <Input
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              placeholder="+998901234567"
              required
            />
          </Field>

          {staff.length > 0 && (
            <Field label={t('queue.preferredStaffLabel', 'Master / Barber (optional)')}>
              <select
                value={form.staffId}
                onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
              >
                <option value="">{t('queue.anyAvailableStaff', 'Next Available Master')}</option>
                {staff.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </Field>
          )}

          {services.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-sm text-text-muted font-medium block">{t('queue.serviceLabel', 'Service (optional)')}</span>
              <div className="flex flex-wrap gap-1.5">
                {services.filter((sv) => sv.isActive !== false).slice(0, 10).map((sv) => {
                  const label = sv.name?.[i18n.language] || sv.name?.uz || sv.name?.en;
                  const active = form.serviceName === label;
                  return (
                    <button
                      key={sv._id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          serviceId: active ? '' : sv._id,
                          serviceName: active ? '' : label,
                        }))
                      }
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                        active
                          ? 'bg-accent/15 border-accent text-accent'
                          : 'bg-surface-3 border-border text-text-muted hover:text-text'
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Reception QR Poster Modal */}
      <Modal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title={t('queue.qrPosterTitle', 'Reception Walk-In QR Poster')}
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <p className="text-xs text-text-muted max-w-xs">
            {t('queue.qrPosterDesc', 'Display this QR code at your reception desk so walk-in guests can join the live queue from their phone.')}
          </p>
          <div className="p-4 bg-white rounded-2xl shadow-lg">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Walk-in Queue QR" className="w-52 h-52 object-contain" />
            ) : (
              <div className="w-52 h-52 bg-surface-3 animate-pulse rounded-xl" />
            )}
          </div>
          <div className="flex items-center gap-2 w-full">
            <Button
              variant="subtle"
              className="flex-1"
              onClick={() => {
                navigator.clipboard?.writeText(checkInUrl);
                showToast(t('queue.linkCopied', 'Check-in link copied'));
              }}
            >
              <ClipboardDocumentIcon className="w-4 h-4" />
              {t('queue.copyLink', 'Copy Link')}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => window.print()}
            >
              <PrinterIcon className="w-4 h-4" />
              {t('queue.printBtn', 'Print')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Optional 1-Click Checkout to Register */}
      <CheckoutModal
        open={!!checkoutTarget}
        onClose={() => setCheckoutTarget(null)}
        {...(checkoutTarget || {})}
      />
    </div>
  );
}
