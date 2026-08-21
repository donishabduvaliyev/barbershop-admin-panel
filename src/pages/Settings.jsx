import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Field, Input, Textarea, Switch } from '../components/ui';
import { Skeleton } from '../components/Skeleton';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_HOURS = { open: false, from: '09:00', to: '18:00' };

function hoursArrayToDayMap(workingHours = []) {
  const map = Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_HOURS }]));
  for (const entry of workingHours) {
    for (const day of entry.days) {
      if (map[day]) map[day] = { open: true, from: entry.from, to: entry.to };
    }
  }
  return map;
}

function dayMapToHoursArray(dayMap) {
  return DAYS.filter((d) => dayMap[d].open).map((d) => ({ days: [d], from: dayMap[d].from, to: dayMap[d].to }));
}

export default function Settings() {
  const { api, shop: sessionShop, login, token } = useAuth();
  const { showToast } = useToast();
  const [shop, setShop] = useState(null);
  const [form, setForm] = useState(null);
  const [hours, setHours] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    api.get('/admin/shop').then((data) => {
      setShop(data);
      setForm({
        name: { ...data.name },
        description: { ...(data.description || { en: '', ru: '', uz: '' }) },
        phone: data.phone || '',
        address: data.address || '',
        isOperational: data.isOperational,
      });
      setHours(hoursArrayToDayMap(data.workingHours));
    });
  }, [api]);

  const saveShop = async () => {
    setSaving(true);
    try {
      const updated = await api.patch('/admin/shop', form);
      setShop(updated);
      login(token, { ...sessionShop, name: updated.name });
      showToast('Shop details updated');
    } catch (err) {
      showToast(err.message || 'Could not save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveHours = async () => {
    setSavingHours(true);
    try {
      const workingHours = await api.patch('/admin/shop/working-hours', { workingHours: dayMapToHoursArray(hours) });
      setShop((prev) => ({ ...prev, workingHours }));
      showToast('Working hours updated');
    } catch (err) {
      showToast(err.message || 'Could not save hours', 'error');
    } finally {
      setSavingHours(false);
    }
  };

  if (!shop || !form || !hours) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card className="p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-text">Settings</h1>
        <p className="text-text-muted text-sm mt-1">Shop details and opening hours.</p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between pb-1">
          <div>
            <p className="text-sm font-medium text-text">Accepting bookings</p>
            <p className="text-xs text-text-muted mt-0.5">Turn off to hide your shop from new bookings temporarily.</p>
          </div>
          <Switch checked={form.isOperational} onChange={(v) => setForm({ ...form, isOperational: v })} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Name (English)"><Input value={form.name.en} onChange={(e) => setForm({ ...form, name: { ...form.name, en: e.target.value } })} /></Field>
          <Field label="Name (Русский)"><Input value={form.name.ru} onChange={(e) => setForm({ ...form, name: { ...form.name, ru: e.target.value } })} /></Field>
          <Field label="Name (O'zbek)"><Input value={form.name.uz} onChange={(e) => setForm({ ...form, name: { ...form.name, uz: e.target.value } })} /></Field>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Description (English)"><Textarea rows={2} value={form.description.en} onChange={(e) => setForm({ ...form, description: { ...form.description, en: e.target.value } })} /></Field>
          <Field label="Description (Русский)"><Textarea rows={2} value={form.description.ru} onChange={(e) => setForm({ ...form, description: { ...form.description, ru: e.target.value } })} /></Field>
          <Field label="Description (O'zbek)"><Textarea rows={2} value={form.description.uz} onChange={(e) => setForm({ ...form, description: { ...form.description, uz: e.target.value } })} /></Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 123 45 67" /></Field>
          <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={saveShop} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-medium text-text">Working hours</h2>
        <div className="space-y-2">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-3 py-1.5">
              <div className="w-28 shrink-0">
                <Switch checked={hours[day].open} onChange={(v) => setHours({ ...hours, [day]: { ...hours[day], open: v } })} label={day.slice(0, 3)} />
              </div>
              {hours[day].open ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input type="time" value={hours[day].from} onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], from: e.target.value } })} className="!w-32" />
                  <span className="text-text-faint text-sm">to</span>
                  <Input type="time" value={hours[day].to} onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], to: e.target.value } })} className="!w-32" />
                </div>
              ) : (
                <span className="text-sm text-text-faint">Closed</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-1">
          <Button onClick={saveHours} disabled={savingHours}>{savingHours ? 'Saving…' : 'Save hours'}</Button>
        </div>
      </Card>
    </div>
  );
}
