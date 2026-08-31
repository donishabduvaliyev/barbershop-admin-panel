import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Field, Input, Textarea, Switch } from '../components/ui';
import ImageUpload from '../components/ImageUpload';
import WorkingHoursEditor from '../components/WorkingHoursEditor';
import { Skeleton } from '../components/Skeleton';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Settings() {
  const { t } = useTranslation();
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
        capacity: data.capacity || 1,
        winBackEnabled: data.winBackEnabled ?? true,
      });
      setHours(data.workingHours || []);
    });
  }, [api]);

  const saveShop = async () => {
    setSaving(true);
    try {
      const updated = await api.patch('/admin/shop', form);
      setShop(updated);
      login(token, { ...sessionShop, name: updated.name });
      showToast(t('settings.toastUpdated'));
    } catch (err) {
      showToast(err.message || t('settings.toastSaveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadMainPhoto = async (file) => {
    const { image } = await api.upload('/admin/shop/photo', file);
    setShop((prev) => ({ ...prev, image }));
  };

  const uploadGalleryPhoto = async (file) => {
    const { images } = await api.upload('/admin/shop/photos', file);
    setShop((prev) => ({ ...prev, images }));
  };

  const removeGalleryPhoto = async (url) => {
    const { images } = await api.delete('/admin/shop/photos', { url });
    setShop((prev) => ({ ...prev, images }));
  };

  const saveHours = async () => {
    setSavingHours(true);
    try {
      const workingHours = await api.patch('/admin/shop/working-hours', { workingHours: hours });
      setShop((prev) => ({ ...prev, workingHours }));
      showToast(t('settings.toastHoursUpdated'));
    } catch (err) {
      showToast(err.message || t('settings.toastHoursError'), 'error');
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
        <h1 className="font-display text-2xl font-semibold text-text">{t('settings.title')}</h1>
        <p className="text-text-muted text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-medium text-text">{t('settings.photos')}</h2>
          <p className="text-xs text-text-muted mt-0.5">{t('settings.photosHint')}</p>
        </div>

        <div className="grid sm:grid-cols-[240px_1fr] gap-5">
          <div>
            <p className="text-xs font-medium text-text-muted mb-1.5">{t('settings.mainPhoto')}</p>
            <ImageUpload value={shop.image} onUpload={uploadMainPhoto} shape="rect" size="lg" />
          </div>

          <div>
            <p className="text-xs font-medium text-text-muted mb-1.5">{t('settings.gallery')}</p>
            <div className="flex flex-wrap gap-2">
              {(shop.images || []).map((url) => (
                <div key={url} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeGalleryPhoto(url)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <ImageUpload value={null} onUpload={uploadGalleryPhoto} shape="rect" size="sm" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between pb-1">
          <div>
            <p className="text-sm font-medium text-text">{t('settings.acceptingBookings')}</p>
            <p className="text-xs text-text-muted mt-0.5">{t('settings.acceptingBookingsHint')}</p>
          </div>
          <Switch checked={form.isOperational} onChange={(v) => setForm({ ...form, isOperational: v })} />
        </div>

        <div className="flex items-center justify-between pb-1">
          <div>
            <p className="text-sm font-medium text-text">{t('settings.winBackMessages')}</p>
            <p className="text-xs text-text-muted mt-0.5">{t('settings.winBackHint')}</p>
          </div>
          <Switch checked={form.winBackEnabled} onChange={(v) => setForm({ ...form, winBackEnabled: v })} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={t('settings.nameEn')}><Input value={form.name.en} onChange={(e) => setForm({ ...form, name: { ...form.name, en: e.target.value } })} /></Field>
          <Field label={t('settings.nameRu')}><Input value={form.name.ru} onChange={(e) => setForm({ ...form, name: { ...form.name, ru: e.target.value } })} /></Field>
          <Field label={t('settings.nameUz')}><Input value={form.name.uz} onChange={(e) => setForm({ ...form, name: { ...form.name, uz: e.target.value } })} /></Field>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={t('settings.descEn')}><Textarea rows={2} value={form.description.en} onChange={(e) => setForm({ ...form, description: { ...form.description, en: e.target.value } })} /></Field>
          <Field label={t('settings.descRu')}><Textarea rows={2} value={form.description.ru} onChange={(e) => setForm({ ...form, description: { ...form.description, ru: e.target.value } })} /></Field>
          <Field label={t('settings.descUz')}><Textarea rows={2} value={form.description.uz} onChange={(e) => setForm({ ...form, description: { ...form.description, uz: e.target.value } })} /></Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={t('settings.phone')}><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 123 45 67" /></Field>
          <Field label={t('settings.address')}><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label={t('settings.capacity')}
            hint={shop.staff?.length > 0
              ? t('settings.capacityHintStaff', { count: shop.staff.length })
              : t('settings.capacityHintNoStaff')}
          >
            <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) || 1 })} />
          </Field>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={saveShop} disabled={saving}>{saving ? t('common.saving') : t('settings.saveChanges')}</Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-medium text-text">{t('settings.workingHours')}</h2>
        <WorkingHoursEditor value={hours} onChange={setHours} />
        <div className="flex justify-end pt-1">
          <Button onClick={saveHours} disabled={savingHours}>{savingHours ? t('common.saving') : t('settings.saveHours')}</Button>
        </div>
      </Card>
    </div>
  );
}
