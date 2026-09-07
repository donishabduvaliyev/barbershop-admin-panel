import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  MagnifyingGlassIcon, PencilSquareIcon, KeyIcon, ArrowTopRightOnSquareIcon,
  TrashIcon, ArrowUturnLeftIcon, PauseIcon, PlayIcon, ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../components/ToastProvider';
import { Card, Button, Field, Input, EmptyState } from '../../components/ui';
import Modal from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';

const FILTERS = ['all', 'active', 'suspended', 'unclaimed', 'archived'];
const CATEGORY_OPTIONS = ['Barbershop', 'Hair Salon', 'Nail Salon'];
const emptyForm = { nameEn: '', nameUz: '', nameRu: '', category: 'Barbershop', phone: '', address: '' };
const currency = (n) => `${Math.round(n).toLocaleString()} UZS`;

function Badge({ color, children }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

export default function SuperAdminShops() {
  const { t, i18n } = useTranslation();
  const { api, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [shops, setShops] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [claimTarget, setClaimTarget] = useState(null);
  const [claimCode, setClaimCode] = useState(null);
  const [claimBusy, setClaimBusy] = useState(false);

  const load = () => {
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    if (status !== 'all') query.set('status', status);
    const qs = query.toString();
    api.get(`/superadmin/shops${qs ? `?${qs}` : ''}`).then((res) => setShops(res.shops));
  };

  useEffect(() => {
    setShops(null);
    const timeout = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (shop) => {
    setEditing(shop);
    setForm({
      nameEn: shop.name?.en || '', nameUz: shop.name?.uz || '', nameRu: shop.name?.ru || '',
      category: shop.category || 'Barbershop',
      phone: shop.phone || '', address: shop.address || '',
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    setSaving(true);
    try {
      const payload = {
        name: { en: form.nameEn.trim(), uz: form.nameUz.trim(), ru: form.nameRu.trim() },
        category: form.category,
        phone: form.phone.trim(),
        address: form.address.trim(),
      };
      if (editing) {
        await api.patch(`/superadmin/shops/${editing.id}`, payload);
        showToast(t('superadmin.shops.toastUpdated'));
      } else {
        await api.post('/superadmin/shops', payload);
        showToast(t('superadmin.shops.toastCreated'));
      }
      setFormOpen(false);
      load();
    } catch (err) {
      showToast(err.message || t(editing ? 'superadmin.shops.toastUpdateError' : 'superadmin.shops.toastCreateError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleOperational = async (shop) => {
    setBusyId(shop.id);
    try {
      await api.patch(`/superadmin/shops/${shop.id}`, { isOperational: !shop.isOperational });
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.shops.toastUpdateError'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    setBusyId(deleteTarget.id);
    try {
      await api.delete(`/superadmin/shops/${deleteTarget.id}`);
      showToast(t('superadmin.shops.toastDeleted'));
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.shops.toastDeleteError'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmRestore = async () => {
    setBusyId(restoreTarget.id);
    try {
      await api.post(`/superadmin/shops/${restoreTarget.id}/restore`);
      showToast(t('superadmin.shops.toastRestored'));
      setRestoreTarget(null);
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.shops.toastRestoreError'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openClaimCode = (shop) => { setClaimTarget(shop); setClaimCode(null); };

  const generateClaimCode = async () => {
    setClaimBusy(true);
    try {
      const res = await api.post(`/superadmin/shops/${claimTarget.id}/claim-code`);
      setClaimCode(res.claimCode);
      showToast(t('superadmin.shops.toastClaimCodeGenerated'));
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.shops.toastClaimCodeError'), 'error');
    } finally {
      setClaimBusy(false);
    }
  };

  const copyClaimCode = () => {
    navigator.clipboard?.writeText(claimCode || '').then(() => showToast(t('superadmin.shops.codeCopied')));
  };

  const manageAsShop = async (shop) => {
    setBusyId(shop.id);
    try {
      const res = await api.post(`/superadmin/shops/${shop.id}/manage-as`);
      login(res.token, { ...res.shop, role: 'owner' });
      navigate('/');
    } catch (err) {
      showToast(err.message || t('superadmin.shops.toastManageError'), 'error');
      setBusyId(null);
    }
  };

  const categoryLabel = (cat) => {
    if (cat === 'Nail Salon') return t('superadmin.shops.categoryNailSalon');
    if (cat === 'Hair Salon') return t('superadmin.shops.categoryHairSalon');
    return t('superadmin.shops.categoryBarbershop');
  };

  const canSubmit = form.nameEn.trim() && form.nameUz.trim() && form.nameRu.trim() && form.category && form.phone.trim() && form.address.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">{t('superadmin.shops.title')}</h1>
          <p className="text-text-muted text-sm mt-1">{t('superadmin.shops.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>{t('superadmin.shops.addShop')}</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <MagnifyingGlassIcon className="w-4 h-4 text-text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('superadmin.shops.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 bg-surface border border-border-soft rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize', status === f ? 'bg-accent text-black' : 'text-text-muted hover:text-text')}
            >
              {t(`superadmin.shops.filter${f[0].toUpperCase()}${f.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {shops === null ? (
          <div>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-5 py-4"><Skeleton className="h-10 w-full" /></div>)}</div>
        ) : shops.length === 0 ? (
          <EmptyState icon="🏪" title={t('superadmin.shops.noShopsTitle')} description={t('superadmin.shops.noShopsDesc')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-text-muted uppercase tracking-wide text-left">
                  <th className="px-5 py-3 font-medium">{t('superadmin.shops.colName')}</th>
                  <th className="px-4 py-3 font-medium">{t('superadmin.shops.colOwner')}</th>
                  <th className="px-4 py-3 font-medium">{t('superadmin.shops.colStatus')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('superadmin.shops.colBookings')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('superadmin.shops.colRevenue')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('superadmin.shops.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => {
                  const name = shop.name?.[i18n.language] || shop.name?.en || shop.name?.ru;
                  const busy = busyId === shop.id;
                  return (
                    <tr key={shop.id} className="border-t border-border-soft align-middle">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={shop.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 bg-surface-3" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                          <div className="min-w-0">
                            <p className="text-text font-medium truncate max-w-[200px]">{name}</p>
                            <p className="text-xs text-text-faint truncate max-w-[200px]">{categoryLabel(shop.category)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {shop.ownerTelegramId ? (
                          <Badge color="var(--color-success)">{t('superadmin.shops.claimed')}</Badge>
                        ) : (
                          <Badge color="var(--color-warning)">{t('superadmin.shops.unclaimed')}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {shop.isArchived ? (
                          <Badge color="var(--color-text-faint)">{t('superadmin.shops.archived')}</Badge>
                        ) : shop.isOperational ? (
                          <Badge color="var(--color-success)">{t('superadmin.shops.active')}</Badge>
                        ) : (
                          <Badge color="var(--color-danger)">{t('superadmin.shops.suspended')}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-right whitespace-nowrap">{shop.bookings}</td>
                      <td className="px-4 py-3 text-text text-right whitespace-nowrap">{currency(shop.revenue)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!shop.isArchived && (
                            <>
                              <button title={t('superadmin.shops.editShop')} onClick={() => openEdit(shop)} className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-surface-3 transition-colors">
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              <button title={t('superadmin.shops.generateClaimCode')} onClick={() => openClaimCode(shop)} className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-surface-3 transition-colors">
                                <KeyIcon className="w-4 h-4" />
                              </button>
                              <button
                                title={shop.isOperational ? t('superadmin.shops.suspend') : t('superadmin.shops.reactivate')}
                                disabled={busy}
                                onClick={() => toggleOperational(shop)}
                                className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-surface-3 transition-colors disabled:opacity-40"
                              >
                                {shop.isOperational ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                              </button>
                              <button
                                title={t('superadmin.shops.manageAsShop')}
                                disabled={busy}
                                onClick={() => manageAsShop(shop)}
                                className="p-1.5 rounded-lg text-text-faint hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
                              >
                                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                              </button>
                              <button title={t('superadmin.shops.deleteShop')} onClick={() => setDeleteTarget(shop)} className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-danger/10 transition-colors">
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {shop.isArchived && (
                            <button title={t('superadmin.shops.restoreShop')} onClick={() => setRestoreTarget(shop)} className="p-1.5 rounded-lg text-text-faint hover:text-accent hover:bg-accent/10 transition-colors">
                              <ArrowUturnLeftIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / edit shop */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('superadmin.shops.editShop') : t('superadmin.shops.addShop')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={saving || !canSubmit} onClick={submitForm}>
              {editing ? t('superadmin.shops.save') : t('superadmin.shops.create')}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label={t('superadmin.shops.nameEn')}><Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} autoFocus /></Field>
          <Field label={t('superadmin.shops.nameUz')}><Input value={form.nameUz} onChange={(e) => setForm({ ...form, nameUz: e.target.value })} /></Field>
          <Field label={t('superadmin.shops.nameRu')}><Input value={form.nameRu} onChange={(e) => setForm({ ...form, nameRu: e.target.value })} /></Field>

          <Field label={t('superadmin.shops.category')}>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            >
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('superadmin.shops.phone')}><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label={t('superadmin.shops.address')}><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      {/* Delete (archive) confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('superadmin.shops.deleteShop')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={busyId === deleteTarget?.id} onClick={confirmDelete}>{t('common.remove')}</Button>
          </>
        )}
      >
        <p className="text-sm text-text-muted">
          {t('superadmin.shops.deleteConfirm', { name: deleteTarget?.name?.[i18n.language] || deleteTarget?.name?.en })}
        </p>
      </Modal>

      {/* Restore confirm */}
      <Modal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        title={t('superadmin.shops.restoreShop')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setRestoreTarget(null)}>{t('common.cancel')}</Button>
            <Button disabled={busyId === restoreTarget?.id} onClick={confirmRestore}>{t('superadmin.shops.restoreShop')}</Button>
          </>
        )}
      >
        <p className="text-sm text-text-muted">
          {t('superadmin.shops.restoreConfirm', { name: restoreTarget?.name?.[i18n.language] || restoreTarget?.name?.en })}
        </p>
      </Modal>

      {/* Claim code */}
      <Modal
        open={!!claimTarget}
        onClose={() => setClaimTarget(null)}
        title={t('superadmin.shops.newClaimCodeTitle')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setClaimTarget(null)}>{t('common.cancel')}</Button>
            {!claimCode && (
              <Button disabled={claimBusy} onClick={generateClaimCode}>{t('superadmin.shops.generateClaimCode')}</Button>
            )}
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">{t('superadmin.shops.newClaimCodeDesc')}</p>
          {claimCode && (
            <div className="flex items-center gap-2 bg-surface-3 border border-border rounded-lg px-3 py-2.5">
              <span className="font-mono text-lg text-accent tracking-wider flex-1">{claimCode}</span>
              <button onClick={copyClaimCode} className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-surface transition-colors" title={t('superadmin.shops.copyCode')}>
                <ClipboardDocumentIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
