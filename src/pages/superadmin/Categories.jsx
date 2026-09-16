import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  PlusIcon, PencilSquareIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon,
  MagnifyingGlassIcon, XMarkIcon, UsersIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../components/ToastProvider';
import { Card, Button, Field, Input, Switch, EmptyState } from '../../components/ui';
import Modal from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';

const emptyForm = { key: '', labelEn: '', labelUz: '', labelRu: '', icon: '' };

export default function SuperAdminCategories() {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const { showToast } = useToast();
  const lang = i18n.language || 'en';

  const [categories, setCategories] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [shopsTarget, setShopsTarget] = useState(null);
  const [shopSearch, setShopSearch] = useState('');
  const [shopResults, setShopResults] = useState(null);
  const [shopBusyId, setShopBusyId] = useState(null);

  const load = () => api.get('/superadmin/categories').then((res) => setCategories(res.categories));

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (cat) => {
    setEditing(cat);
    setForm({ key: cat.key, labelEn: cat.label.en, labelUz: cat.label.uz, labelRu: cat.label.ru, icon: cat.icon || '' });
    setFormOpen(true);
  };

  const canSubmit = editing
    ? form.labelEn.trim() && form.labelUz.trim() && form.labelRu.trim()
    : form.key.trim() && form.labelEn.trim() && form.labelUz.trim() && form.labelRu.trim();

  const submitForm = async () => {
    setSaving(true);
    try {
      const label = { en: form.labelEn.trim(), uz: form.labelUz.trim(), ru: form.labelRu.trim() };
      if (editing) {
        await api.patch(`/superadmin/categories/${editing._id}`, { label, icon: form.icon.trim() });
        showToast(t('superadmin.categories.toastUpdated'));
      } else {
        const maxOrder = categories?.length ? Math.max(...categories.map((c) => c.order)) : -1;
        await api.post('/superadmin/categories', { key: form.key.trim(), label, icon: form.icon.trim(), order: maxOrder + 1 });
        showToast(t('superadmin.categories.toastCreated'));
      }
      setFormOpen(false);
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.categories.toastSaveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (cat) => {
    setBusyId(cat._id);
    try {
      await api.patch(`/superadmin/categories/${cat._id}`, { isActive: !cat.isActive });
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.categories.toastSaveError'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index, direction) => {
    const other = index + direction;
    if (other < 0 || other >= categories.length) return;
    const a = categories[index];
    const b = categories[other];
    setBusyId(a._id);
    try {
      await Promise.all([
        api.patch(`/superadmin/categories/${a._id}`, { order: b.order }),
        api.patch(`/superadmin/categories/${b._id}`, { order: a.order }),
      ]);
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.categories.toastSaveError'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    setBusyId(deleteTarget._id);
    try {
      await api.delete(`/superadmin/categories/${deleteTarget._id}`);
      showToast(t('superadmin.categories.toastDeleted'));
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.categories.toastDeleteError'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openShops = (cat) => { setShopsTarget(cat); setShopSearch(''); setShopResults(null); };

  useEffect(() => {
    if (!shopsTarget) return;
    const timeout = setTimeout(() => {
      const query = new URLSearchParams();
      if (shopSearch.trim()) query.set('search', shopSearch.trim());
      api.get(`/superadmin/shops?${query.toString()}`).then((res) => setShopResults(res.shops));
    }, shopSearch ? 300 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopsTarget, shopSearch]);

  const memberIds = new Set((shopsTarget?.shops || []).map((s) => String(s.id)));

  const addShop = async (shopId) => {
    setShopBusyId(shopId);
    try {
      const updated = await api.post(`/superadmin/categories/${shopsTarget._id}/shops`, { shopId });
      setShopsTarget(updated);
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.categories.toastSaveError'), 'error');
    } finally {
      setShopBusyId(null);
    }
  };

  const removeShop = async (shopId) => {
    setShopBusyId(shopId);
    try {
      const updated = await api.delete(`/superadmin/categories/${shopsTarget._id}/shops/${shopId}`);
      setShopsTarget(updated);
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.categories.toastSaveError'), 'error');
    } finally {
      setShopBusyId(null);
    }
  };

  const moveMember = async (index, direction) => {
    const shops = shopsTarget.shops;
    const other = index + direction;
    if (other < 0 || other >= shops.length) return;
    const reordered = [...shops];
    [reordered[index], reordered[other]] = [reordered[other], reordered[index]];
    setShopsTarget({ ...shopsTarget, shops: reordered }); // optimistic
    try {
      const updated = await api.patch(`/superadmin/categories/${shopsTarget._id}/shops/reorder`, {
        shopIds: reordered.map((s) => s.id),
      });
      setShopsTarget(updated);
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.categories.toastSaveError'), 'error');
      openShops(shopsTarget); // revert to server truth
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">{t('superadmin.categories.title')}</h1>
          <p className="text-text-muted text-sm mt-1">{t('superadmin.categories.subtitle')}</p>
        </div>
        <Button onClick={openCreate}><PlusIcon className="w-4 h-4" /> {t('superadmin.categories.addCategory')}</Button>
      </div>

      <Card className="overflow-hidden">
        {categories === null ? (
          <div>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-5 py-4"><Skeleton className="h-10 w-full" /></div>)}</div>
        ) : categories.length === 0 ? (
          <EmptyState icon="🗂️" title={t('superadmin.categories.noCategoriesTitle')} description={t('superadmin.categories.noCategoriesDesc')} />
        ) : (
          <div className="divide-y divide-border-soft">
            {categories.map((cat, i) => (
              <div key={cat._id} className="px-5 py-4 flex items-center gap-3 flex-wrap">
                <div className="flex flex-col shrink-0">
                  <button disabled={i === 0 || busyId} onClick={() => move(i, -1)} className="p-0.5 text-text-faint hover:text-text disabled:opacity-30">
                    <ChevronUpIcon className="w-4 h-4" />
                  </button>
                  <button disabled={i === categories.length - 1 || busyId} onClick={() => move(i, 1)} className="p-0.5 text-text-faint hover:text-text disabled:opacity-30">
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-xl shrink-0">{cat.icon || '🗂️'}</span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-text font-medium truncate">{cat.label[lang] || cat.label.en}</p>
                    <span className={clsx(
                      'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                      cat.type === 'auto' ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-text-muted'
                    )}>
                      {cat.type === 'auto' ? t('superadmin.categories.autoBadge') : t('superadmin.categories.manualBadge')}
                    </span>
                  </div>
                  <p className="text-xs text-text-faint truncate">
                    {cat.type === 'manual'
                      ? t('superadmin.categories.shopCount', { count: cat.shops.length })
                      : t(`superadmin.categories.autoRule.${cat.autoRule}`)}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {cat.type === 'manual' && (
                    <button title={t('superadmin.categories.manageShops')} onClick={() => openShops(cat)} className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-surface-3 transition-colors">
                      <UsersIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button title={t('common.edit')} onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-surface-3 transition-colors">
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  <Switch checked={cat.isActive} onChange={() => toggleActive(cat)} />
                  {cat.type === 'manual' && (
                    <button title={t('common.remove')} onClick={() => setDeleteTarget(cat)} className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-danger/10 transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create / edit category */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('superadmin.categories.editCategory') : t('superadmin.categories.addCategory')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={saving || !canSubmit} onClick={submitForm}>
              {editing ? t('common.save') : t('superadmin.categories.create')}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          {!editing && (
            <Field label={t('superadmin.categories.key')} hint={t('superadmin.categories.keyHint')}>
              <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.trim().toLowerCase().replace(/\s+/g, '-') })} placeholder="new-in-town" autoFocus />
            </Field>
          )}
          <Field label={t('superadmin.categories.icon')} hint={t('superadmin.categories.iconHint')}>
            <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="✨" />
          </Field>
          <Field label={t('superadmin.categories.labelEn')}><Input value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} /></Field>
          <Field label={t('superadmin.categories.labelUz')}><Input value={form.labelUz} onChange={(e) => setForm({ ...form, labelUz: e.target.value })} /></Field>
          <Field label={t('superadmin.categories.labelRu')}><Input value={form.labelRu} onChange={(e) => setForm({ ...form, labelRu: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('superadmin.categories.deleteCategory')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={busyId === deleteTarget?._id} onClick={confirmDelete}>{t('common.remove')}</Button>
          </>
        )}
      >
        <p className="text-sm text-text-muted">
          {t('superadmin.categories.deleteConfirm', { name: deleteTarget?.label[lang] || deleteTarget?.label.en })}
        </p>
      </Modal>

      {/* Manage shops in a manual category */}
      <Modal
        open={!!shopsTarget}
        onClose={() => setShopsTarget(null)}
        title={shopsTarget ? t('superadmin.categories.shopsInCategory', { name: shopsTarget.label[lang] || shopsTarget.label.en }) : ''}
        footer={<Button variant="ghost" onClick={() => setShopsTarget(null)}>{t('common.close')}</Button>}
      >
        {shopsTarget && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">{t('superadmin.categories.currentMembers')}</p>
              {shopsTarget.shops.length === 0 ? (
                <p className="text-sm text-text-faint">{t('superadmin.categories.noMembers')}</p>
              ) : (
                <div className="space-y-1.5">
                  {shopsTarget.shops.map((shop, i) => (
                    <div key={shop.id} className="flex items-center gap-2 bg-surface-3 border border-border rounded-lg px-3 py-2">
                      <div className="flex flex-col shrink-0">
                        <button disabled={i === 0} onClick={() => moveMember(i, -1)} className="text-text-faint hover:text-text disabled:opacity-30"><ChevronUpIcon className="w-3.5 h-3.5" /></button>
                        <button disabled={i === shopsTarget.shops.length - 1} onClick={() => moveMember(i, 1)} className="text-text-faint hover:text-text disabled:opacity-30"><ChevronDownIcon className="w-3.5 h-3.5" /></button>
                      </div>
                      <img src={shop.image} alt="" className="w-8 h-8 rounded-md object-cover shrink-0 bg-surface" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                      <span className="text-sm text-text truncate flex-1">{shop.name?.[lang] || shop.name?.en}</span>
                      <button disabled={shopBusyId === shop.id} onClick={() => removeShop(shop.id)} className="p-1 text-text-faint hover:text-danger transition-colors shrink-0">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-text-muted mb-2">{t('superadmin.categories.addShops')}</p>
              <div className="relative mb-2">
                <MagnifyingGlassIcon className="w-4 h-4 text-text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={shopSearch} onChange={(e) => setShopSearch(e.target.value)} placeholder={t('superadmin.shops.searchPlaceholder')} className="pl-9" />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {shopResults === null ? (
                  <Skeleton className="h-9 w-full" />
                ) : shopResults.filter((s) => !memberIds.has(String(s.id))).length === 0 ? (
                  <p className="text-sm text-text-faint py-2">{t('superadmin.categories.noMoreShops')}</p>
                ) : (
                  shopResults.filter((s) => !memberIds.has(String(s.id))).map((shop) => (
                    <div key={shop.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-3 transition-colors">
                      <img src={shop.image} alt="" className="w-7 h-7 rounded-md object-cover shrink-0 bg-surface-3" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                      <span className="text-sm text-text truncate flex-1">{shop.name?.[lang] || shop.name?.en}</span>
                      <button disabled={shopBusyId === shop.id} onClick={() => addShop(shop.id)} className="p-1 text-accent hover:bg-accent/10 rounded transition-colors shrink-0">
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
