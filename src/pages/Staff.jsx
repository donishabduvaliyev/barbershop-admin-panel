import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Field, Input, EmptyState } from '../components/ui';
import Modal from '../components/Modal';
import ImageUpload from '../components/ImageUpload';
import { CardGridSkeleton } from '../components/Skeleton';

const EMPTY_FORM = { name: '', title: '', photo: '', daysOff: [] };
const todayKey = () => new Date().toISOString().slice(0, 10);
const formatDayOff = (dateKey) => new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

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
  const [newDayOffDate, setNewDayOffDate] = useState('');
  const [dayOffConflict, setDayOffConflict] = useState(null);

  useEffect(() => {
    api.get('/admin/shop').then((shop) => setStaff(shop.staff));
  }, [api]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (member) => {
    setEditing(member);
    setForm({ name: member.name, title: member.title || '', photo: member.photo || '', daysOff: member.daysOff || [] });
    setNewDayOffDate('');
    setDayOffConflict(null);
    setModalOpen(true);
  };

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

  const uploadPhoto = async (file) => {
    const { photo } = await api.upload(`/admin/shop/staff/${editing._id}/photo`, file);
    setForm((f) => ({ ...f, photo }));
    setStaff((prev) => prev.map((m) => (m._id === editing._id ? { ...m, photo } : m)));
  };

  const addDayOff = async (force = false) => {
    if (!newDayOffDate) return;
    try {
      const path = `/admin/shop/staff/${editing._id}/days-off${force ? '?force=true' : ''}`;
      const res = await api.post(path, { date: newDayOffDate });
      setForm((f) => ({ ...f, daysOff: res.daysOff }));
      setStaff((prev) => prev.map((m) => (m._id === editing._id ? { ...m, daysOff: res.daysOff } : m)));
      setDayOffConflict(null);
      setNewDayOffDate('');
      showToast(
        res.rejectedCount
          ? `Day off added — ${res.rejectedCount} appointment${res.rejectedCount === 1 ? '' : 's'} rejected and the client${res.rejectedCount === 1 ? '' : 's'} notified`
          : 'Day off added'
      );
    } catch (err) {
      if (err.status === 409 && err.data?.conflicts) {
        setDayOffConflict({ message: err.message, conflicts: err.data.conflicts });
        return;
      }
      showToast(err.message || 'Could not add day off', 'error');
    }
  };

  const removeDayOff = async (date) => {
    try {
      const res = await api.delete(`/admin/shop/staff/${editing._id}/days-off`, { date });
      setForm((f) => ({ ...f, daysOff: res.daysOff }));
      setStaff((prev) => prev.map((m) => (m._id === editing._id ? { ...m, daysOff: res.daysOff } : m)));
    } catch (err) {
      showToast(err.message || 'Could not remove day off', 'error');
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
                {member.daysOff?.includes(todayKey()) ? (
                  <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[11px] font-medium">
                    <CalendarDaysIcon className="w-3 h-3" /> Off today
                  </span>
                ) : member.daysOff?.filter((d) => d >= todayKey()).length > 0 ? (
                  <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-3 text-text-faint text-[11px]">
                    <CalendarDaysIcon className="w-3 h-3" /> {member.daysOff.filter((d) => d >= todayKey()).length} day{member.daysOff.filter((d) => d >= todayKey()).length === 1 ? '' : 's'} off scheduled
                  </span>
                ) : null}
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
          {editing ? (
            <Field label="Photo">
              <ImageUpload value={form.photo} onUpload={uploadPhoto} shape="circle" />
            </Field>
          ) : (
            <Field label="Photo" hint="Save the staff member first, then edit them to add a photo.">
              <div className="w-24 h-24 rounded-full border border-dashed border-border flex items-center justify-center text-text-faint text-xs text-center px-2">
                Add after saving
              </div>
            </Field>
          )}
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Aziz" /></Field>
          <Field label="Title" hint="Optional — e.g. Senior Barber"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Senior Barber" /></Field>

          {editing && (
            <Field label="Time off" hint="Customers can't book them on these dates.">
              <div className="space-y-2">
                {form.daysOff.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {[...form.daysOff].sort().map((date) => (
                      <span key={date} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-surface-3 border border-border text-xs text-text">
                        {formatDayOff(date)}
                        <button onClick={() => removeDayOff(date)} className="w-4 h-4 rounded-full flex items-center justify-center text-text-faint hover:text-danger hover:bg-danger/10 transition-colors">
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input type="date" min={todayKey()} value={newDayOffDate} onChange={(e) => { setNewDayOffDate(e.target.value); setDayOffConflict(null); }} className="!w-40" />
                  <Button variant="subtle" className="!px-3 !py-2 text-xs" disabled={!newDayOffDate} onClick={() => addDayOff(false)}>
                    <CalendarDaysIcon className="w-4 h-4" /> Add
                  </Button>
                </div>
                {dayOffConflict && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
                    <p className="text-xs text-warning">{dayOffConflict.message} Marking this day off will reject {dayOffConflict.conflicts.length === 1 ? 'it' : 'them'} and notify the client{dayOffConflict.conflicts.length === 1 ? '' : 's'}.</p>
                    <ul className="text-xs text-text-muted space-y-0.5">
                      {dayOffConflict.conflicts.map((c) => (
                        <li key={c.id}>• {c.userName || 'Guest'} — {new Date(c.requestedTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</li>
                      ))}
                    </ul>
                    <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => addDayOff(true)}>Mark off anyway</Button>
                  </div>
                )}
              </div>
            </Field>
          )}
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
