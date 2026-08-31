import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Field, Input, EmptyState } from '../components/ui';
import Modal from '../components/Modal';
import { CardGridSkeleton } from '../components/Skeleton';

const EMPTY_FORM = { en: '', ru: '', uz: '', price: '', durationMinutes: '' };

export default function Services() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const { showToast } = useToast();
  const [services, setServices] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [upcomingCount, setUpcomingCount] = useState(0);

  useEffect(() => {
    api.get('/admin/shop').then((shop) => setServices(shop.services));
  }, [api]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (service) => {
    setEditing(service);
    setForm({ en: service.name.en, ru: service.name.ru, uz: service.name.uz, price: service.price, durationMinutes: service.durationMinutes });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.en || !form.ru || !form.uz || !form.price || !form.durationMinutes) {
      showToast(t('services.toastFillFields'), 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: { en: form.en, ru: form.ru, uz: form.uz },
      price: Number(form.price),
      durationMinutes: Number(form.durationMinutes),
    };
    try {
      const updated = editing
        ? await api.patch(`/admin/shop/services/${editing._id}`, payload)
        : await api.post('/admin/shop/services', payload);
      setServices(updated);
      showToast(editing ? t('services.toastUpdated') : t('services.toastAdded'));
      setModalOpen(false);
    } catch (err) {
      showToast(err.message || t('services.toastSaveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (force = false) => {
    try {
      const path = `/admin/shop/services/${deleteTarget._id}${force ? '?force=true' : ''}`;
      const updated = await api.delete(path);
      setServices(updated);
      showToast(t('services.toastRemoved'));
      setDeleteTarget(null);
      setUpcomingCount(0);
    } catch (err) {
      if (err.status === 409 && err.data?.upcomingCount) {
        setUpcomingCount(err.data.upcomingCount);
        return;
      }
      showToast(err.message || t('services.toastRemoveError'), 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">{t('services.title')}</h1>
          <p className="text-text-muted text-sm mt-1">{t('services.subtitle')}</p>
        </div>
        <Button onClick={openCreate}><PlusIcon className="w-4 h-4" /> {t('services.addService')}</Button>
      </div>

      {services === null ? (
        <CardGridSkeleton />
      ) : services.length === 0 ? (
        <Card><EmptyState icon="✂️" title={t('services.noServicesTitle')} description={t('services.noServicesDesc')} action={<Button onClick={openCreate}>{t('services.addService')}</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service, i) => (
            <motion.div
              key={service._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="p-5 h-full flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-text leading-snug">{service.name.en}</h3>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(service)} className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-surface-3 transition-colors"><PencilSquareIcon className="w-4 h-4" /></button>
                    <button onClick={() => { setDeleteTarget(service); setUpcomingCount(0); }} className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-danger/10 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="text-xs text-text-faint mt-1">{service.name.ru} · {service.name.uz}</p>
                <div className="mt-auto pt-4 flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-accent">{service.price.toLocaleString()}</span>
                  <span className="text-xs text-text-faint">UZS · {service.durationMinutes} min</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('services.editService') : t('services.addServiceTitle')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={save} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label={t('services.nameEn')}><Input value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} placeholder="Haircut" /></Field>
          <Field label={t('services.nameRu')}><Input value={form.ru} onChange={(e) => setForm({ ...form, ru: e.target.value })} placeholder="Стрижка" /></Field>
          <Field label={t('services.nameUz')}><Input value={form.uz} onChange={(e) => setForm({ ...form, uz: e.target.value })} placeholder="Soch olish" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('services.price')}><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="50000" /></Field>
            <Field label={t('services.duration')}><Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="30" /></Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('services.removeTitle')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => remove(upcomingCount > 0)}>
              {upcomingCount > 0 ? t('services.deleteAnyway') : t('common.remove')}
            </Button>
          </>
        )}
      >
        {upcomingCount > 0 ? (
          <p className="text-sm text-warning">
            {t('services.upcomingWarning', { name: deleteTarget?.name.en, count: upcomingCount })}
          </p>
        ) : (
          <p className="text-sm text-text-muted">{t('services.removeConfirm', { name: deleteTarget?.name.en })}</p>
        )}
      </Modal>
    </div>
  );
}
