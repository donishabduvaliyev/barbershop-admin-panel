import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { TrashIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Field, Input, EmptyState } from '../components/ui';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';

const SEGMENTS = [
  { key: 'all', label: 'All customers', description: 'Everyone who has completed a visit here.' },
  { key: 'inactive60', label: 'Inactive 60+ days', description: "Customers who haven't visited in over 60 days." },
];

// validFrom/validTo are calendar dates (from a <input type="date">), stored
// as UTC midnight — formatting in the viewer's local timezone would roll
// them back a day for anyone west of UTC, so render in UTC instead.
function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const emptyForm = { title: '', serviceId: '', discountPercent: 10, validFrom: '', validTo: '' };

export default function Promotions() {
  const { api } = useAuth();
  const { showToast } = useToast();

  const [promotions, setPromotions] = useState(null);
  const [services, setServices] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [sendTarget, setSendTarget] = useState(null);
  const [segment, setSegment] = useState('all');
  const [recipientCount, setRecipientCount] = useState(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);

  const load = () => api.get('/admin/promotions').then((res) => setPromotions(res.promotions));

  useEffect(() => {
    load();
    api.get('/admin/shop').then((shop) => setServices(shop.services || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => { setForm(emptyForm); setCreateOpen(true); };

  const submitCreate = async () => {
    setSaving(true);
    try {
      await api.post('/admin/promotions', {
        title: form.title.trim(),
        serviceId: form.serviceId || null,
        discountPercent: Number(form.discountPercent),
        validFrom: new Date(form.validFrom).toISOString(),
        validTo: new Date(form.validTo).toISOString(),
      });
      setCreateOpen(false);
      showToast('Promotion created');
      load();
    } catch (err) {
      showToast(err.message || 'Could not create promotion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/promotions/${deleteTarget._id}`);
      setDeleteTarget(null);
      showToast('Promotion deleted');
      load();
    } catch (err) {
      showToast(err.message || 'Could not delete promotion', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openSend = (promo) => { setSendTarget(promo); setSegment('all'); setRecipientCount(null); };

  const checkRecipients = async () => {
    setChecking(true);
    try {
      const res = await api.post(`/admin/promotions/${sendTarget._id}/send`, { segment });
      setRecipientCount(res.recipientCount);
    } catch (err) {
      showToast(err.message || 'Could not check recipients', 'error');
    } finally {
      setChecking(false);
    }
  };

  // Re-check whenever the segment changes so the shown count always
  // matches the currently-selected segment before the user confirms.
  useEffect(() => {
    if (sendTarget) checkRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendTarget, segment]);

  const confirmSend = async () => {
    setSending(true);
    try {
      const res = await api.post(`/admin/promotions/${sendTarget._id}/send?confirm=true`, { segment });
      showToast(`Sent to ${res.recipientCount} customer${res.recipientCount === 1 ? '' : 's'}`);
      setSendTarget(null);
    } catch (err) {
      showToast(err.message || 'Could not send promotion', 'error');
    } finally {
      setSending(false);
    }
  };

  const serviceName = (id) => {
    if (!id) return 'All services';
    const s = services.find((sv) => sv._id === id);
    return s?.name?.en || 'Service';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">Promotions</h1>
          <p className="text-text-muted text-sm mt-1">Create a discount and send it to a customer segment on Telegram.</p>
        </div>
        <Button onClick={openCreate}>New promotion</Button>
      </div>

      <Card className="overflow-hidden">
        {promotions === null ? (
          <div>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="px-5 py-4"><Skeleton className="h-10 w-full" /></div>)}</div>
        ) : promotions.length === 0 ? (
          <EmptyState icon="🎉" title="No promotions yet" description="Create one to offer a discount and message your customers about it." />
        ) : (
          <div>
            {promotions.map((promo) => (
              <div key={promo._id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-border-soft last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">{promo.title} <span className="text-accent">· {promo.discountPercent}% off</span></p>
                  <p className="text-xs text-text-muted truncate">{serviceName(promo.serviceId)} · {formatDate(promo.validFrom)} – {formatDate(promo.validTo)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="subtle" className="!px-3 !py-1.5 text-xs" onClick={() => openSend(promo)}>
                    <PaperAirplaneIcon className="w-3.5 h-3.5" /> Send
                  </Button>
                  <button onClick={() => setDeleteTarget(promo)} className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-danger/10 transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New promotion"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={saving || !form.title.trim() || !form.discountPercent || !form.validFrom || !form.validTo}
              onClick={submitCreate}
            >
              Create
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Autumn 20% off" autoFocus /></Field>

          <Field label="Service">
            <select
              value={form.serviceId}
              onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            >
              <option value="">All services</option>
              {services.map((s) => <option key={s._id} value={s._id}>{s.name?.en}</option>)}
            </select>
          </Field>

          <Field label="Discount %"><Input type="number" min={1} max={100} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} /></Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valid from"><Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></Field>
            <Field label="Valid to"><Input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete promotion"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" disabled={deleting} onClick={confirmDelete}>Delete</Button>
          </>
        )}
      >
        <p className="text-sm text-text-muted">Delete <span className="text-text font-medium">{deleteTarget?.title}</span>? This won't affect any messages already sent.</p>
      </Modal>

      <Modal
        open={!!sendTarget}
        onClose={() => setSendTarget(null)}
        title={`Send "${sendTarget?.title}"`}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setSendTarget(null)}>Cancel</Button>
            <Button disabled={checking || sending || !recipientCount} onClick={confirmSend}>
              {sending ? 'Sending…' : `Send to ${recipientCount ?? '…'} customer${recipientCount === 1 ? '' : 's'}`}
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-muted">Pick who should get this on Telegram.</p>
          {SEGMENTS.map((seg) => (
            <button
              key={seg.key}
              onClick={() => setSegment(seg.key)}
              className={clsx(
                'w-full text-left px-4 py-3 rounded-xl border transition-colors',
                segment === seg.key ? 'border-accent bg-accent/10' : 'border-border-soft hover:border-border'
              )}
            >
              <p className="text-sm font-medium text-text">{seg.label}</p>
              <p className="text-xs text-text-muted mt-0.5">{seg.description}</p>
            </button>
          ))}
          <div className="pt-2 text-sm text-text-muted">
            {checking ? 'Counting recipients…' : (
              <>This will message <span className="text-text font-medium">{recipientCount ?? 0}</span> customer{recipientCount === 1 ? '' : 's'}. Sending can't be undone.</>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
