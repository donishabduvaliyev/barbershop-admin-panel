import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Textarea, EmptyState } from '../components/ui';
import Modal from '../components/Modal';
import { TableRowSkeleton } from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';
import { localeFor } from '../lib/locale';

const currency = (n) => `${Math.round(n || 0).toLocaleString()} UZS`;

export default function Customers() {
  const { t, i18n } = useTranslation();
  const formatDate = (d) => new Date(d).toLocaleDateString(localeFor(i18n.language), { month: 'short', day: 'numeric', year: 'numeric' });
  const { api } = useAuth();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const load = (searchTerm) => {
    const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
    return api.get(`/admin/customers${query}`).then((res) => setCustomers(res.customers));
  };

  useEffect(() => { load(''); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [api]);

  // Debounced server-side search — matches routes/adminCustomers.js's
  // ?search= support rather than fetching every customer up front.
  useEffect(() => {
    const handle = setTimeout(() => load(search), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openDetail = async (telegramId) => {
    setSelectedId(telegramId);
    setDetail(null);
    try {
      const res = await api.get(`/admin/customers/${telegramId}`);
      setDetail(res);
      setNotesDraft(res.notes || '');
    } catch (err) {
      showToast(err.message || t('customers.toastLoadError'), 'error');
      setSelectedId(null);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.patch(`/admin/customers/${selectedId}/notes`, { notes: notesDraft });
      setDetail((d) => ({ ...d, notes: notesDraft }));
      setCustomers((prev) => prev.map((c) => (c.telegramId === selectedId ? { ...c, notes: notesDraft } : c)));
      showToast(t('customers.toastSaved'));
    } catch (err) {
      showToast(err.message || t('customers.toastSaveError'), 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">{t('customers.title')}</h1>
          <p className="text-text-muted text-sm mt-1">{t('customers.subtitle')}</p>
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 text-text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('customers.searchPlaceholder')}
            className="bg-surface-3 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all w-56"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {customers === null ? (
          <div>{Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} />)}</div>
        ) : customers.length === 0 ? (
          <EmptyState icon="👥" title={t('customers.noCustomersTitle')} description={t('customers.noCustomersDesc')} />
        ) : (
          <div>
            {customers.map((c, i) => (
              <motion.button
                key={c.telegramId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openDetail(c.telegramId)}
                className="w-full flex items-center gap-4 px-5 py-4 border-b border-border-soft last:border-0 text-left hover:bg-surface-2 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center text-sm font-medium text-text-muted shrink-0">
                  {(c.userName || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">{c.userName || t('common.guest')} <span className="text-text-faint font-normal">· {c.userNumber}</span></p>
                  <p className="text-xs text-text-muted truncate">
                    {c.favoriteServices.length > 0 ? c.favoriteServices.join(', ') : t('customers.noFavoriteService')}
                    {c.preferredStaff ? ` · ${t('customers.usuallyWith', { name: c.preferredStaff })}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-medium text-text">{t('customers.visit', { count: c.visitCount })}</p>
                  <p className="text-xs text-text-faint">{t('customers.last', { date: formatDate(c.lastVisit) })}</p>
                </div>
                <div className="text-right shrink-0 w-24">
                  <p className="text-sm font-semibold text-accent">{currency(c.totalSpent)}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title={detail?.userName || t('customers.customerFallback')} maxWidth="max-w-lg">
        {!detail ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-4 bg-surface-3 rounded shimmer-bg" />)}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-surface-3 rounded-xl p-3">
                <p className="text-lg font-semibold text-text">{detail.visitCount}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{t('customers.visits')}</p>
              </div>
              <div className="bg-surface-3 rounded-xl p-3">
                <p className="text-lg font-semibold text-accent">{currency(detail.totalSpent)}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{t('customers.totalSpent')}</p>
              </div>
              <div className="bg-surface-3 rounded-xl p-3">
                <p className="text-lg font-semibold text-text">{detail.lastVisit ? formatDate(detail.lastVisit) : '—'}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{t('customers.lastVisit')}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-text-muted mb-1.5">{t('customers.favoriteServices')}</p>
                {detail.favoriteServices.length > 0 ? (
                  <ul className="space-y-1">
                    {detail.favoriteServices.map((s) => <li key={s} className="text-text">• {s}</li>)}
                  </ul>
                ) : <p className="text-text-faint">{t('customers.none')}</p>}
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted mb-1.5">{t('customers.preferredSpecialist')}</p>
                <p className="text-text">{detail.preferredStaff || <span className="text-text-faint">{t('customers.none')}</span>}</p>
                <p className="text-xs text-text-faint mt-2">{detail.userNumber}{detail.userTelegramUsername ? ` · @${detail.userTelegramUsername}` : ''}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-text-muted mb-1.5">{t('customers.notes')}</p>
              <Textarea rows={3} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder={t('customers.notesPlaceholder')} />
              <div className="flex justify-end mt-2">
                <Button variant="subtle" className="!px-3 !py-1.5 text-xs" onClick={saveNotes} disabled={savingNotes || notesDraft === detail.notes}>
                  {savingNotes ? t('common.saving') : t('customers.saveNotes')}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-text-muted mb-2">{t('customers.timeline')}</p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {detail.timeline.map((visit) => (
                  <div key={visit.id} className="flex items-center gap-3 bg-surface-3 rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text truncate">{visit.serviceName || t('common.service')}{visit.staffName ? ` · ${visit.staffName}` : ''}</p>
                      <p className="text-xs text-text-faint">{formatDate(visit.requestedTime)}</p>
                    </div>
                    {visit.price != null && <span className="text-xs font-medium text-text-muted shrink-0">{currency(visit.price)}</span>}
                    <StatusBadge status={visit.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
