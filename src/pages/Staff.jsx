import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Field, Input, EmptyState } from '../components/ui';
import Modal from '../components/Modal';
import { CardGridSkeleton } from '../components/Skeleton';

const EMPTY_FORM = { name: '', title: '', photo: '' };

export default function Staff() {
  const { api } = useAuth();
  const { showToast } = useToast();
  const [staff, setStaff] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [upcomingCount, setUpcomingCount] = useState(0);

  useEffect(() => {
    api.get('/admin/shop').then((shop) => setStaff(shop.staff));
  }, [api]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (member) => { setEditing(member); setForm({ name: member.name, title: member.title || '', photo: member.photo || '' }); setModalOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const updated = editing
        ? await api.patch(`/admin/shop/staff/${editing._id}`, form)
        : await api.post('/admin/shop/staff', form);
      setStaff(updated);
      showToast(editing ? 'Staff member updated' : 'Staff member added');
      setModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Could not save staff member', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (force = false) => {
    try {
      const path = `/admin/shop/staff/${deleteTarget._id}${force ? '?force=true' : ''}`;
      const updated = await api.delete(path);
      setStaff(updated);
      showToast('Staff member removed');
      setDeleteTarget(null);
      setUpcomingCount(0);
    } catch (err) {
      if (err.status === 409 && err.data?.upcomingCount) {
        setUpcomingCount(err.data.upcomingCount);
        return;
      }
      showToast(err.message || 'Could not remove staff member', 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">Staff</h1>
          <p className="text-text-muted text-sm mt-1">Who works at your shop.</p>
        </div>
        <Button onClick={openCreate}><PlusIcon className="w-4 h-4" /> Add staff</Button>
      </div>

      {staff === null ? (
        <CardGridSkeleton />
      ) : staff.length === 0 ? (
        <Card><EmptyState icon="💇" title="No staff yet" description="Add your team so customers can pick who they book with." action={<Button onClick={openCreate}>Add staff</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member, i) => (
            <motion.div key={member._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5 h-full flex flex-col items-center text-center">
                <div className="flex gap-1 self-end -mt-1 -mr-1 mb-1">
                  <button onClick={() => openEdit(member)} className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-surface-3 transition-colors"><PencilSquareIcon className="w-4 h-4" /></button>
                  <button onClick={() => { setDeleteTarget(member); setUpcomingCount(0); }} className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-danger/10 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                </div>
                <img
                  src={member.photo || 'https://placehold.co/100x100/1a1a1f/9c9ca6?text=%F0%9F%92%88'}
                  alt={member.name}
                  className="w-16 h-16 rounded-full object-cover border border-border mb-3"
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/1a1a1f/9c9ca6?text=%F0%9F%92%88'; }}
                />
                <h3 className="font-medium text-text">{member.name}</h3>
                {member.title && <p className="text-xs text-text-muted mt-0.5">{member.title}</p>}
                <div className="flex items-center gap-1 mt-2 text-xs text-text-muted">
                  <StarSolid className="w-3.5 h-3.5 text-accent" />
                  <span>{member.rating?.toFixed(1) || '0.0'}</span>
                  <span className="text-text-faint">({member.reviewsCount || 0})</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit staff member' : 'Add staff member'}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Aziz" /></Field>
          <Field label="Title" hint="Optional — e.g. Senior Barber"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Senior Barber" /></Field>
          <Field label="Photo URL" hint="Optional"><Input value={form.photo} onChange={(e) => setForm({ ...form, photo: e.target.value })} placeholder="https://…" /></Field>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove staff member"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => remove(upcomingCount > 0)}>
              {upcomingCount > 0 ? 'Delete anyway' : 'Remove'}
            </Button>
          </>
        )}
      >
        {upcomingCount > 0 ? (
          <p className="text-sm text-warning">
            <span className="font-medium">{deleteTarget?.name}</span> has {upcomingCount} upcoming appointment{upcomingCount === 1 ? '' : 's'}.
            Deleting them won't cancel those appointments, but they'll no longer be assigned to a real staff member.
          </p>
        ) : (
          <p className="text-sm text-text-muted">Remove <span className="text-text font-medium">{deleteTarget?.name}</span> from your team?</p>
        )}
      </Modal>
    </div>
  );
}
