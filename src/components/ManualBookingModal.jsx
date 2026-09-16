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

  useEffect(() => {
    if (!open) return;
    setClientMode('search');
    setSearch('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setNewName('');
    setNewNumber('');
    setServiceId(shop?.services?.find((s) => s.isActive !== false)?._id || null);
    setStaffId(presetStaffId || null);
    setDate(presetDate || new Date());
    setHour(presetHour ?? null);
    setSource('phone');
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  const dates = useMemo(() => [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  }), []);

  const hours = useMemo(() => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const start = isToday ? now.getHours() + 1 : 8;
    const list = [];
    for (let h = Math.max(start, 8); h <= 22; h++) list.push(h);
    return list;
  }, [date]);

  const activeServices = shop?.services?.filter((s) => s.isActive !== false) || [];
  const selectedService = activeServices.find((s) => String(s._id) === String(serviceId));

  const canSubmit = (
    (clientMode === 'search' ? !!selectedCustomer : (newName.trim() && newNumber.trim())) &&
    serviceId && date && hour !== null && !saving
  );

  const submit = async () => {
    setSaving(true);
    try {
      const requestedDate = new Date(date);
      requestedDate.setHours(hour, 0, 0, 0);
      const payload = {
        serviceId, staffId: staffId || undefined, requestedTime: requestedDate.toISOString(),
        source, note: note.trim() || undefined,
        ...(clientMode === 'search'
          ? { telegramId: selectedCustomer.telegramId }
          : { name: newName.trim(), number: newNumber.trim() }),
      };
      const booking = await api.post('/admin/appointments', payload);
      showToast(t('appointments.manual.toastCreated'));
      onCreated?.(booking);
      onClose();
    } catch (err) {
      showToast(err.message || t('appointments.manual.toastError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('appointments.manual.title')}
      maxWidth="max-w-lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={!canSubmit} onClick={submit}>
            {saving ? t('appointments.manual.creating') : t('appointments.manual.create')}
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
                  <button onClick={() => setSelectedCustomer(null)} className="text-xs text-accent shrink-0">{t('common.change')}</button>
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
                  <button onClick={() => setClientMode('new')} className="mt-2 flex items-center gap-1.5 text-sm text-accent font-medium">
                    <PlusIcon className="w-4 h-4" /> {t('appointments.manual.addNewClient')}
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('appointments.manual.newClientName')} autoFocus />
              <Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder={t('appointments.manual.newClientNumber')} />
              <button onClick={() => setClientMode('search')} className="text-sm text-text-muted">{t('appointments.manual.searchInstead')}</button>
            </div>
          )}
        </div>

        <Field label={t('appointments.manual.service')}>
          <select
            value={serviceId || ''}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          >
            {activeServices.map((s) => <option key={s._id} value={s._id}>{s.name?.en} · {s.durationMinutes} min</option>)}
          </select>
        </Field>

        {shop?.staff?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-muted mb-2">{t('appointments.manual.staff')}</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setStaffId(null)}
                className={clsx('px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-all', !staffId ? 'bg-accent text-black border-accent' : 'bg-surface-3 text-text-muted border-border')}
              >
                {t('appointments.manual.anyStaff')}
              </button>
              {shop.staff.map((s) => (
                <button
                  key={s._id}
                  onClick={() => setStaffId(s._id)}
                  className={clsx('px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-all', String(staffId) === String(s._id) ? 'bg-accent text-black border-accent' : 'bg-surface-3 text-text-muted border-border')}
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
                className={clsx('px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-all text-center min-w-[64px]', d.toDateString() === date.toDateString() ? 'bg-accent text-black border-accent' : 'bg-surface-3 text-text-muted border-border')}
              >
                <div>{d.toLocaleDateString(i18n.language, { weekday: 'short' })}</div>
                <div>{d.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-text-muted mb-2">{t('appointments.manual.time')}</p>
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

        <div>
          <p className="text-xs font-medium text-text-muted mb-2">{t('appointments.manual.source')}</p>
          <div className="flex gap-2">
            {['phone', 'walk-in'].map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={clsx('flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all', source === s ? 'bg-accent text-black border-accent' : 'bg-surface-3 text-text-muted border-border')}
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
