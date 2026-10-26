import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../lib/AuthContext';
import { useToast } from './ToastProvider';
import { Button, Field, Input } from './ui';
import Modal from './Modal';

const pad = (n) => String(n).padStart(2, '0');

// Shared by the Calendar page (tapping a free cell) and the Appointments
// list ("+ New booking") — same form either way, just pre-filled
// differently. Mirrors the reference's "Yangi bandlov" flow: pick or add a
// client, service, staff ("Any available" when none picked), date/time,
// how they reached out, and an optional note.
export default function ManualBookingModal({ open, onClose, onCreated, shop, presetDate, presetHour, presetStaffId }) {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const { showToast } = useToast();

  const [shopData, setShopData] = useState(shop);
  const [clientMode, setClientMode] = useState('search'); // 'search' | 'new'
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');

  const [serviceId, setServiceId] = useState(null);
  const [staffId, setStaffId] = useState(presetStaffId || null);
  const [date, setDate] = useState(presetDate || new Date());
  const [hour, setHour] = useState(presetHour ?? null);
  const [source, setSource] = useState('phone');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [daySchedule, setDaySchedule] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  useEffect(() => {
    if (shop) setShopData(shop);
  }, [shop]);

  // Fetch shop data if missing services or staff
  useEffect(() => {
    if (open && (!shopData || !shopData.services?.length)) {
      api.get('/admin/shop')
        .then((s) => { if (s) setShopData(s); })
        .catch(() => {});
    }
  }, [open, shopData, api]);

  // Fetch schedule for the selected date to know booked slots and staff presence
  useEffect(() => {
    if (!open || !date) return;
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const dateKey = `${y}-${m}-${d}`;
    setScheduleLoading(true);
    api.get(`/admin/shop/schedule?date=${dateKey}`)
      .then(setDaySchedule)
      .catch(() => setDaySchedule(null))
      .finally(() => setScheduleLoading(false));
  }, [open, date, api]);

  const dates = useMemo(() => [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  }), []);

  const effectiveShop = shopData || shop;
  const activeServices = effectiveShop?.services?.filter((s) => s.isActive !== false) || [];
  const selectedService = activeServices.find((s) => String(s._id) === String(serviceId));

  const selectedStaffMember = useMemo(() => {
    if (!staffId || !daySchedule?.staff) return null;
    return daySchedule.staff.find((s) => String(s.id) === String(staffId));
  }, [staffId, daySchedule]);

  const isStaffOff = selectedStaffMember?.isOffToday;

  const availableHours = useMemo(() => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const startHour = isToday ? now.getHours() + 1 : 8;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];

    const effectiveWH = (staffId && selectedStaffMember?.workingHours?.length)
      ? selectedStaffMember.workingHours
      : (daySchedule?.workingHours || effectiveShop?.workingHours || []);

    const todaysWH = effectiveWH.filter((wh) => wh.days?.includes(dayName));
    if (todaysWH.length === 0 && effectiveWH.length > 0) return [];

    const minHour = todaysWH.length > 0
      ? Math.max(startHour, Math.min(...todaysWH.map((w) => Number(w.from.split(':')[0]))))
      : Math.max(startHour, 8);
    const maxHour = todaysWH.length > 0
      ? Math.max(...todaysWH.map((w) => Number(w.to.split(':')[0])))
      : 22;

    const list = [];

    if (staffId) {
      if (isStaffOff) return [];
      if (isToday && selectedStaffMember?.isAvailableNow === false) return [];
      if (serviceId && selectedStaffMember?.serviceIds?.length > 0 && !selectedStaffMember.serviceIds.some((id) => String(id) === String(serviceId))) {
        return [];
      }
      const bookedHours = new Set(
        (selectedStaffMember?.bookings || [])
          .filter((b) => b.status === 'pending' || b.status === 'confirmed')
          .map((b) => b.hour)
      );

      for (let h = minHour; h < maxHour; h++) {
        const inSchedule = todaysWH.length === 0 || todaysWH.some((w) => {
          const from = Number(w.from.split(':')[0]);
          const to = Number(w.to.split(':')[0]);
          return h >= from && h < to;
        });
        if (inSchedule && !bookedHours.has(h)) {
          list.push({ hour: h, freeCount: 1 });
        }
      }
    } else {
      const allStaff = daySchedule?.staff || [];
      const unassigned = daySchedule?.unassignedBookings || [];

      for (let h = minHour; h < maxHour; h++) {
        const inSchedule = todaysWH.length === 0 || todaysWH.some((w) => {
          const from = Number(w.from.split(':')[0]);
          const to = Number(w.to.split(':')[0]);
          return h >= from && h < to;
        });
        if (!inSchedule) continue;

        if (allStaff.length > 0) {
          const freeStaffAtHour = allStaff.filter((s) => {
            if (s.isOffToday) return false;
            if (isToday && s.isAvailableNow === false) return false;
            if (serviceId && s.serviceIds?.length > 0 && !s.serviceIds.some((id) => String(id) === String(serviceId))) {
              return false;
            }
            const sWH = s.workingHours?.length ? s.workingHours : daySchedule?.workingHours;
            if (sWH?.length) {
              const sTodayWH = sWH.filter((w) => w.days?.includes(dayName));
              const sOpen = sTodayWH.some((w) => {
                const [f] = w.from.split(':').map(Number);
                const [t] = w.to.split(':').map(Number);
                return h >= f && h < t;
              });
              if (!sOpen) return false;
            }
            const isBooked = (s.bookings || []).some(
              (b) => b.hour === h && (b.status === 'pending' || b.status === 'confirmed')
            );
            return !isBooked;
          });

          const unassignedCount = unassigned.filter((b) => b.hour === h && (b.status === 'pending' || b.status === 'confirmed')).length;
          const availableCount = freeStaffAtHour.length - unassignedCount;

          if (availableCount > 0) {
            list.push({ hour: h, freeCount: availableCount });
          }
        } else {
          const capacity = daySchedule?.capacity || effectiveShop?.capacity || 1;
          const bookingsAtHour = unassigned.filter((b) => b.hour === h && (b.status === 'pending' || b.status === 'confirmed')).length;
          if (bookingsAtHour < capacity) {
            list.push({ hour: h, freeCount: capacity - bookingsAtHour });
          }
        }
      }
    }

    return list;
  }, [date, staffId, selectedStaffMember, isStaffOff, daySchedule, effectiveShop, serviceId]);

  useEffect(() => {
    if (!open) return;
    setClientMode('search');
    setSearch('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setNewName('');
    setNewNumber('');
    const defaultServiceId = activeServices[0]?._id || null;
    setServiceId(defaultServiceId);
    setStaffId(presetStaffId || null);
    setDate(presetDate || new Date());
    setHour(presetHour ?? null);
    setSource('phone');
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If services load after modal was opened
  useEffect(() => {
    if (open && !serviceId && activeServices.length > 0) {
      setServiceId(activeServices[0]._id);
    }
  }, [open, serviceId, activeServices]);

  // Ensure selected hour is always valid among availableHours
  useEffect(() => {
    if (availableHours.length > 0) {
      if (hour === null || !availableHours.some((item) => item.hour === hour)) {
        setHour(availableHours[0].hour);
      }
    } else {
      setHour(null);
    }
  }, [availableHours, hour]);

  useEffect(() => {
    if (!open || clientMode !== 'search' || !search.trim()) { setSearchResults([]); return; }
    const timeout = setTimeout(() => {
      api.get(`/admin/customers?search=${encodeURIComponent(search.trim())}`)
        .then((res) => setSearchResults(res.customers || []))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, clientMode, open]);

  const hasClient = clientMode === 'search' ? !!selectedCustomer : !!newName.trim();
  const canSubmit = hasClient && !!serviceId && !!date && hour !== null && !saving;

  const submit = async () => {
    if (!hasClient) {
      showToast(clientMode === 'search' ? (t('appointments.manual.selectClientError') || 'Mijozni tanlang') : (t('appointments.manual.enterNameError') || 'Mijoz ismini kiriting'), 'error');
      return;
    }
    if (!serviceId) {
      showToast(t('appointments.manual.selectServiceError') || 'Xizmatni tanlang', 'error');
      return;
    }
    if (hour === null) {
      showToast(t('appointments.manual.selectHourError') || 'Vaqtni tanlang', 'error');
      return;
    }

    setSaving(true);
    try {
      const requestedDate = new Date(date);
      requestedDate.setHours(hour, 0, 0, 0);
      const payload = {
        serviceId,
        staffId: staffId || undefined,
        requestedTime: requestedDate.toISOString(),
        source,
        note: note.trim() || undefined,
        ...(clientMode === 'search'
          ? { telegramId: selectedCustomer.telegramId }
          : { name: newName.trim(), number: (newNumber.trim() || '+998900000000') }),
      };
      const booking = await api.post('/admin/appointments', payload);
      showToast(t('appointments.manual.toastCreated') || 'Bandlov muvaffaqiyatli yaratildi!');
      onCreated?.(booking);
      onClose();
    } catch (err) {
      showToast(err.message || t('appointments.manual.toastError') || 'Xatolik yuz berdi', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('appointments.manual.title') || 'Yangi bandlov'}
      maxWidth="max-w-lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="button"
            disabled={saving}
            onClick={submit}
            className={!canSubmit ? 'opacity-50' : ''}
          >
            {saving ? (t('appointments.manual.creating') || 'Yaratilmoqda...') : (t('appointments.manual.create') || 'Bandlov yaratish')}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-text-muted mb-2">{t('appointments.manual.client')}</p>
          {clientMode === 'search' ? (
            <>
              {selectedCustomer ? (
                <div className="flex items-center gap-3 bg-surface-3 border border-border rounded-lg px-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
                    {(selectedCustomer.userName || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text truncate">{selectedCustomer.userName}</p>
                    <p className="text-xs text-text-faint truncate">{selectedCustomer.userNumber}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedCustomer(null)} className="text-xs text-accent shrink-0">{t('common.change')}</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 text-text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('appointments.manual.searchPlaceholder')} className="pl-9" autoFocus />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {searchResults.map((c) => (
                        <button
                          type="button"
                          key={c.telegramId}
                          onClick={() => setSelectedCustomer(c)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-3 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center text-xs font-medium text-text-muted shrink-0">
                            {(c.userName || '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-text truncate">{c.userName}</p>
                            <p className="text-xs text-text-faint truncate">{c.userNumber}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => setClientMode('new')} className="mt-2 flex items-center gap-1.5 text-sm text-accent font-medium">
                    <PlusIcon className="w-4 h-4" /> {t('appointments.manual.addNewClient')}
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('appointments.manual.newClientName')} autoFocus />
              <Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder={t('appointments.manual.newClientNumber')} />
              <button type="button" onClick={() => setClientMode('search')} className="text-sm text-text-muted">{t('appointments.manual.searchInstead')}</button>
            </div>
          )}
        </div>

        <Field label={t('appointments.manual.service')}>
          <select
            value={serviceId || ''}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          >
            {activeServices.length === 0 ? (
              <option value="">{t('common.loading') || 'Yuklanmoqda...'}</option>
            ) : (
              activeServices.map((s) => {
                const sName = typeof s.name === 'object'
                  ? (s.name[i18n.language] || s.name.uz || s.name.en || s.name.ru || 'Xizmat')
                  : (s.name || 'Xizmat');
                return (
                  <option key={s._id} value={s._id}>
                    {sName} · {s.durationMinutes} min {s.price ? `· ${s.price.toLocaleString()} UZS` : ''}
                  </option>
                );
              })
            )}
          </select>
        </Field>

        {effectiveShop?.staff?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-muted mb-2">{t('appointments.manual.staff')}</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setStaffId(null)}
                className={clsx('press-spring px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer', !staffId ? 'btn-gold-admin border-accent font-semibold' : 'bg-surface-3 text-text-muted border-border/80 hover:text-text hover:bg-surface-2')}
              >
                {t('appointments.manual.anyStaff')}
              </button>
              {effectiveShop.staff.map((s) => (
                <button
                  type="button"
                  key={s._id}
                  onClick={() => setStaffId(s._id)}
                  className={clsx('press-spring px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer', String(staffId) === String(s._id) ? 'btn-gold-admin border-accent font-semibold' : 'bg-surface-3 text-text-muted border-border/80 hover:text-text hover:bg-surface-2')}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-text-muted mb-2">{t('appointments.manual.date')}</p>
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
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-text-muted">{t('appointments.manual.time')}</p>
            {scheduleLoading && <span className="text-[11px] text-accent animate-pulse">{t('common.loading', 'Yuklanmoqda...')}</span>}
          </div>
          {availableHours.length === 0 ? (
            <div className="p-3 bg-surface-3 rounded-lg border border-border text-center">
              <p className="text-xs text-danger font-medium">
                {isStaffOff
                  ? (t('appointments.manual.staffOff', `${selectedStaffMember?.name || 'Sartarosh'} tanlangan kunda dam oladi`))
                  : (date.toDateString() === new Date().toDateString() && selectedStaffMember?.isAvailableNow === false)
                  ? (`${selectedStaffMember?.name || 'Sartarosh'} bugun ishda emas (mavjud emas)`)
                  : (serviceId && selectedStaffMember?.serviceIds?.length > 0 && !selectedStaffMember.serviceIds.some((id) => String(id) === String(serviceId)))
                  ? (`${selectedStaffMember?.name || 'Sartarosh'} bu xizmatni bajarmaydi`)
                  : t('appointments.manual.noSlots', 'Tanlangan kunda bo\'sh vaqt mavjud emas')}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableHours.map((item) => (
                <button
                  type="button"
                  key={item.hour}
                  onClick={() => setHour(item.hour)}
                  className={clsx(
                    'press-spring px-3 py-1.5 rounded-lg border text-sm tabular-nums cursor-pointer flex items-center gap-1',
                    hour === item.hour ? 'btn-gold-admin border-accent font-semibold' : 'bg-surface-3 text-text-muted border-border/80 hover:text-text hover:bg-surface-2'
                  )}
                >
                  <span>{pad(item.hour)}:00</span>
                  {!staffId && item.freeCount > 1 && (
                    <span className="text-[10px] opacity-75">({item.freeCount})</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-text-muted mb-2">{t('appointments.manual.source')}</p>
          <div className="flex gap-2">
            {['phone', 'walk-in'].map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={clsx('press-spring flex-1 px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer', source === s ? 'btn-gold-admin border-accent font-semibold' : 'bg-surface-3 text-text-muted border-border/80 hover:text-text hover:bg-surface-2')}
              >
                {t(`appointments.source.${s === 'walk-in' ? 'walkIn' : 'phone'}`)}
              </button>
            ))}
          </div>
        </div>

        <Field label={t('appointments.manual.note')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('appointments.manual.notePlaceholder')} />
        </Field>

        {selectedService && (
          <div className="flex items-center justify-between text-sm bg-surface-3 border border-border rounded-lg px-3 py-2.5">
            <span className="text-text-muted">{t('appointments.manual.summary')}</span>
            <span className="text-text font-medium">{selectedService.durationMinutes} {t('common.min')} · {selectedService.price?.toLocaleString()} UZS</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
