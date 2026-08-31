import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { TrashIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Field, Input, EmptyState } from '../components/ui';
import Modal from '../components/Modal';
import { Skeleton } from '../components/Skeleton';

const SEGMENTS = [
  { key: 'all', labelKey: 'segmentAll', descKey: 'segmentAllDesc' },
  { key: 'inactive60', labelKey: 'segmentInactive', descKey: 'segmentInactiveDesc' },
];

// validFrom/validTo are calendar dates (from a <input type="date">), stored
// as UTC midnight — formatting in the viewer's local timezone would roll
// them back a day for anyone west of UTC, so render in UTC instead.
function formatDate(iso, locale) {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const emptyForm = { title: '', serviceId: '', discountPercent: 10, validFrom: '', validTo: '' };

export default function Promotions() {
  const { t, i18n } = useTranslation();
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
      showToast(t('promotions.toastCreated'));
      load();
    } catch (err) {
      showToast(err.message || t('promotions.toastCreateError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/promotions/${deleteTarget._id}`);
      setDeleteTarget(null);
      showToast(t('promotions.toastDeleted'));
      load();
    } catch (err) {
      showToast(err.message || t('promotions.toastDeleteError'), 'error');
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
      showToast(err.message || t('promotions.toastCountError'), 'error');
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
      showToast(t('promotions.toastSentTo', { count: res.recipientCount }));
      setSendTarget(null);
    } catch (err) {
      showToast(err.message || t('promotions.toastSendError'), 'error');
    } finally {
      setSending(false);
    }
  };

  const serviceName = (id) => {
    if (!id) return t('promotions.allServices');
    const s = services.find((sv) => sv._id === id);
    return s?.name?.en || t('common.service');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">{t('promotions.title')}</h1>
          <p className="text-text-muted text-sm mt-1">{t('promotions.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>{t('promotions.newPromotion')}</Button>
      </div>

      <Card className="overflow-hidden">
        {promotions === null ? (
          <div>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="px-5 py-4"><Skeleton className="h-10 w-full" /></div>)}</div>
        ) : promotions.length === 0 ? (
          <EmptyState icon="🎉" title={t('promotions.noPromotionsTitle')} description={t('promotions.noPromotionsDesc')} />
        ) : (
          <div>
            {promotions.map((promo) => (
              <div key={promo._id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-border-soft last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">{promo.title} <span className="text-accent">· {promo.discountPercent}% off</span></p>
                  <p className="text-xs text-text-muted truncate">{serviceName(promo.serviceId)} · {formatDate(promo.validFrom, i18n.language)} – {formatDate(promo.validTo, i18n.language)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="subtle" className="!px-3 !py-1.5 text-xs" onClick={() => openSend(promo)}>
                    <PaperAirplaneIcon className="w-3.5 h-3.5" /> {t('promotions.send')}
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
        title={t('promotions.newPromotion')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button
              disabled={saving || !form.title.trim() || !form.discountPercent || !form.validFrom || !form.validTo}
              onClick={submitCreate}
            >
              {t('promotions.create')}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label={t('promotions.titleField')}><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('promotions.titlePlaceholder')} autoFocus /></Field>

          <Field label={t('promotions.service')}>
            <select
              value={form.serviceId}
              onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            >
              <option value="">{t('promotions.allServices')}</option>
              {services.map((s) => <option key={s._id} value={s._id}>{s.name?.en}</option>)}
            </select>
          </Field>

          <Field label={t('promotions.discount')}><Input type="number" min={1} max={100} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} /></Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('promotions.validFrom')}><Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></Field>
            <Field label={t('promotions.validTo')}><Input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('promotions.deletePromotion')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={deleting} onClick={confirmDelete}>{t('common.remove')}</Button>
          </>
        )}
      >
        <p className="text-sm text-text-muted">{t('promotions.deleteConfirm', { title: deleteTarget?.title })}</p>
      </Modal>

      <Modal
        open={!!sendTarget}
        onClose={() => setSendTarget(null)}
        title={`${t('promotions.send')} "${sendTarget?.title}"`}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setSendTarget(null)}>{t('common.cancel')}</Button>
            <Button disabled={checking || sending || !recipientCount} onClick={confirmSend}>
              {sending ? t('promotions.sending') : t('promotions.sendTo', { count: recipientCount ?? 0 })}
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-muted">{t('promotions.pickSegment')}</p>
          {SEGMENTS.map((seg) => (
            <button
              key={seg.key}
              onClick={() => setSegment(seg.key)}
              className={clsx(
                'w-full text-left px-4 py-3 rounded-xl border transition-colors',
                segment === seg.key ? 'border-accent bg-accent/10' : 'border-border-soft hover:border-border'
              )}
            >
              <p className="text-sm font-medium text-text">{t(`promotions.${seg.labelKey}`)}</p>
              <p className="text-xs text-text-muted mt-0.5">{t(`promotions.${seg.descKey}`)}</p>
            </button>
          ))}
          <div className="pt-2 text-sm text-text-muted">
            {checking ? t('promotions.counting') : (
              <>{t('promotions.willMessage', { count: recipientCount ?? 0 })}</>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
