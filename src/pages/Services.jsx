import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Field, Input, EmptyState } from '../components/ui';
import Modal from '../components/Modal';
import { CardGridSkeleton } from '../components/Skeleton';

const EMPTY_FORM = { en: '', ru: '', uz: '', price: '', durationMinutes: '' };

export default function Services() {
  const { api } = useAuth();
  const { showToast } = useToast();
  const [services, setServices] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
      showToast('Please fill in every field', 'error');
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
      showToast(editing ? 'Service updated' : 'Service added');
      setModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Could not save service', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      const updated = await api.delete(`/admin/shop/services/${deleteTarget._id}`);
      setServices(updated);
      showToast('Service removed');
    } catch (err) {
      showToast(err.message || 'Could not remove service', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">Services</h1>
          <p className="text-text-muted text-sm mt-1">What you offer, and what it costs.</p>
        </div>
        <Button onClick={openCreate}><PlusIcon className="w-4 h-4" /> Add service</Button>
      </div>

      {services === null ? (
        <CardGridSkeleton />
      ) : services.length === 0 ? (
        <Card><EmptyState icon="✂️" title="No services yet" description="Add your first service so customers can book it." action={<Button onClick={openCreate}>Add service</Button>} /></Card>
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
                    <button onClick={() => setDeleteTarget(service)} className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-danger/10 transition-colors"><TrashIcon className="w-4 h-4" /></button>
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
        title={editing ? 'Edit service' : 'Add service'}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="Name (English)"><Input value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} placeholder="Haircut" /></Field>
          <Field label="Name (Русский)"><Input value={form.ru} onChange={(e) => setForm({ ...form, ru: e.target.value })} placeholder="Стрижка" /></Field>
          <Field label="Name (O'zbek)"><Input value={form.uz} onChange={(e) => setForm({ ...form, uz: e.target.value })} placeholder="Soch olish" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (UZS)"><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="50000" /></Field>
            <Field label="Duration (min)"><Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="30" /></Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove service"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={remove}>Remove</Button>
          </>
        )}
      >
        <p className="text-sm text-text-muted">Remove <span className="text-text font-medium">{deleteTarget?.name.en}</span>? This won't affect past appointments.</p>
      </Modal>
    </div>
  );
}
