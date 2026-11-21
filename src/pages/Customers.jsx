import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MagnifyingGlassIcon, PlusIcon, PencilSquareIcon, PhoneIcon, SparklesIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import { Card, Button, Textarea, EmptyState, Field, Input } from '../components/ui';
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
  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createNumber, setCreateNumber] = useState('');
  const [creating, setCreating] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [crmData, setCrmData] = useState(null);
  const [activeSegment, setActiveSegment] = useState('all'); // 'all' | 'vip' | 'regular' | 'new' | 'at_risk' | 'lost'
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastSegment, setBroadcastSegment] = useState('at_risk');
  const [broadcastTemplate, setBroadcastTemplate] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  // Tracks whichever customer is currently "active" in the detail modal —
  // every async action below (load detail, save notes/info, toggle block)
  // checks this before writing to `detail`, so a slow response for a
  // customer the admin has since navigated away from can never clobber
  // whatever's now showing (a real bug: without this, opening customer A
  // then quickly opening B before A's fetch resolves could leave the modal
  // titled B but showing A's data, and saving from there would silently
  // overwrite B's notes with A's).
  const activeCustomerRef = useRef(null);

  const load = (searchTerm) => {
    const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
    return api.get(`/admin/customers${query}`).then((res) => setCustomers(res.customers));
  };

  useEffect(() => {
    load('');
    api.get('/admin/crm/segments').then(setCrmData).catch(() => {});
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [api]);

  const sendBroadcast = async (e) => {
    e.preventDefault();
    setBroadcasting(true);
    try {
      const res = await api.post('/admin/crm/broadcast-reengagement', {
        targetSegment: broadcastSegment,
        messageTemplate: broadcastTemplate.trim() || undefined,
      });
      showToast(t('crm.broadcastSentToast', { count: res.sentCount, defaultValue: `Sent to ${res.sentCount} clients` }));
      setBroadcastOpen(false);
      setBroadcastTemplate('');
    } catch (err) {
      showToast(err.message || t('crm.broadcastError', 'Failed to send broadcast'), 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  // Debounced server-side search — matches routes/adminCustomers.js's
  // ?search= support rather than fetching every customer up front.
  useEffect(() => {
    const handle = setTimeout(() => load(search), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openDetail = async (telegramId) => {
    activeCustomerRef.current = telegramId;
    setSelectedId(telegramId);
    setDetail(null);
    setEditingInfo(false);
    try {
      const res = await api.get(`/admin/customers/${telegramId}`);
      if (activeCustomerRef.current !== telegramId) return; // superseded by a later open/close
      setDetail(res);
      setNotesDraft(res.notes || '');
    } catch (err) {
      if (activeCustomerRef.current !== telegramId) return;
      showToast(err.message || t('customers.toastLoadError'), 'error');
      activeCustomerRef.current = null;
      setSelectedId(null);
    }
  };

  const closeDetail = () => {
    activeCustomerRef.current = null;
    setSelectedId(null);
  };

  const startEditInfo = () => {
    setEditName(detail.userName || '');
    setEditNumber(detail.userNumber || '');
    setEditingInfo(true);
  };

  const saveInfo = async () => {
    if (!editName.trim()) return;
    const targetId = selectedId;
    setSavingInfo(true);
    try {
      await api.patch(`/admin/customers/${targetId}`, { name: editName.trim(), number: editNumber.trim() });
      setCustomers((prev) => prev.map((c) => (c.telegramId === targetId ? { ...c, userName: editName.trim(), userNumber: editNumber.trim() } : c)));
      if (activeCustomerRef.current === targetId) {
        setDetail((d) => ({ ...d, userName: editName.trim(), userNumber: editNumber.trim() }));
        setEditingInfo(false);
      }
      showToast(t('customers.toastSaved'));
    } catch (err) {
      showToast(err.message || t('customers.toastSaveError'), 'error');
    } finally {
      setSavingInfo(false);
    }
  };

  const createCustomer = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await api.post('/admin/customers', { name: createName.trim(), number: createNumber.trim() });
      showToast(t('customers.toastCreated'));
      setCreateOpen(false);
      setCreateName('');
      setCreateNumber('');
      load(search);
      api.get('/admin/crm/segments').then(setCrmData).catch(() => {});
    } catch (err) {
      showToast(err.message || t('customers.toastSaveError'), 'error');
    } finally {
      setCreating(false);
    }
  };

  // Blocking a real customer needs a deliberate confirm step (matches
  // Reviews.jsx's hide flow) — a misclick shouldn't instantly cut someone
  // off from booking. Unblocking is harmless to allow immediately.
  const requestToggleBlock = () => {
    if (detail.isBlocked) {
      toggleBlock();
    } else {
      setBlockConfirmOpen(true);
    }
  };

  const toggleBlock = async () => {
    const targetId = selectedId;
    const isBlocked = !detail.isBlocked;
    setBlockConfirmOpen(false);
    setBlockBusy(true);
    try {
      await api.patch(`/admin/customers/${targetId}/block`, { isBlocked });
      setCustomers((prev) => prev.map((c) => (c.telegramId === targetId ? { ...c, isBlocked } : c)));
      if (activeCustomerRef.current === targetId) {
        setDetail((d) => ({ ...d, isBlocked }));
      }
      showToast(isBlocked ? t('customers.toastBlocked') : t('customers.toastUnblocked'));
    } catch (err) {
      showToast(err.message || t('customers.toastSaveError'), 'error');
    } finally {
      setBlockBusy(false);
    }
  };

  const saveNotes = async () => {
    const targetId = selectedId;
    const notes = notesDraft;
    setSavingNotes(true);
    try {
      await api.patch(`/admin/customers/${targetId}/notes`, { notes });
      setCustomers((prev) => prev.map((c) => (c.telegramId === targetId ? { ...c, notes } : c)));
      if (activeCustomerRef.current === targetId) {
        setDetail((d) => ({ ...d, notes }));
      }
      showToast(t('customers.toastSaved'));
    } catch (err) {
      showToast(err.message || t('customers.toastSaveError'), 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const segmentMap = new Map(
    (crmData?.customers || []).map((item) => [Number(item.telegramId), item])
  );

  const visibleCustomers = customers === null
    ? null
    : activeSegment === 'all'
      ? customers
      : customers.filter((c) => segmentMap.get(Number(c.telegramId))?.segment === activeSegment);

  const SEGMENT_BADGES = {
    vip: 'bg-accent/15 text-accent border-accent/30',
    regular: 'bg-success/15 text-success border-success/30',
    new: 'bg-info/15 text-info border-info/30',
    at_risk: 'bg-warning/15 text-warning border-warning/30',
    lost: 'bg-danger/15 text-danger border-danger/30',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">{t('customers.title')}</h1>
          <p className="text-text-muted text-sm mt-1">{t('customers.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-text-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('customers.searchPlaceholder')}
              className="bg-surface-3 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all w-56"
            />
          </div>
          <Button variant="subtle" onClick={() => setBroadcastOpen(true)} className="!px-3 !py-2 text-sm">
            <SparklesIcon className="w-4 h-4 text-accent" /> {t('crm.winBackBtn', 'Win-Back')}
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="!px-3 !py-2 text-sm"><PlusIcon className="w-4 h-4" /> {t('customers.newClient')}</Button>
        </div>
      </div>

      {/* CRM RFM Segments Strip */}
      {crmData?.segments && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: t('crm.segAll', 'All'), count: crmData.totalClients || 0 },
            { id: 'vip', label: t('crm.segVip', 'VIP'), count: crmData.segments.vip?.count || 0 },
            { id: 'regular', label: t('crm.segRegular', 'Regular'), count: crmData.segments.regular?.count || 0 },
            { id: 'new', label: t('crm.segNew', 'New'), count: crmData.segments.new?.count || 0 },
            { id: 'at_risk', label: t('crm.segAtRisk', 'At-Risk'), count: crmData.segments.at_risk?.count || 0 },
            { id: 'lost', label: t('crm.segLost', 'Lost'), count: crmData.segments.lost?.count || 0 },
          ].map((seg) => (
            <button
              key={seg.id}
              type="button"
              onClick={() => setActiveSegment(seg.id)}
              className={clsx(
                'px-3.5 py-2 rounded-xl border text-xs font-medium whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer',
                activeSegment === seg.id
                  ? 'bg-accent text-black border-accent font-semibold'
                  : 'bg-surface border-border-soft text-text-muted hover:text-text hover:bg-surface-2'
              )}
            >
              <span>{seg.label}</span>
              <span
                className={clsx(
                  'px-1.5 py-0.5 rounded-full text-[10px] tabular-nums font-semibold',
                  activeSegment === seg.id ? 'bg-black/15 text-black' : 'bg-surface-3 text-text'
                )}
              >
                {seg.count}
              </span>
            </button>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        {visibleCustomers === null ? (
          <div>{Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} />)}</div>
        ) : visibleCustomers.length === 0 ? (
          <EmptyState icon="👥" title={t('customers.noCustomersTitle')} description={t('customers.noCustomersDesc')} />
        ) : (
          <div>
            {visibleCustomers.map((c, i) => {
              const crmInfo = segmentMap.get(Number(c.telegramId));
              return (
              <motion.div
                key={c.telegramId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openDetail(c.telegramId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') openDetail(c.telegramId); }}
                className="w-full flex items-center gap-4 px-5 py-4 border-b border-border-soft last:border-0 text-left hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center text-sm font-medium text-text-muted shrink-0">
                  {(c.userName || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate flex items-center gap-1.5 flex-wrap">
                    {c.userName || t('common.guest')} <span className="text-text-faint font-normal">· {c.userNumber}</span>
                    {crmInfo?.segment && (
                      <span
                        className={clsx(
                          'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0',
                          SEGMENT_BADGES[crmInfo.segment] || 'bg-surface-3 text-text-muted border-border'
                        )}
                      >
                        {t(`crm.seg_${crmInfo.segment}`, crmInfo.segment.replace('_', ' '))}
                      </span>
                    )}
                    {c.isBlocked && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-danger/15 text-danger shrink-0">{t('customers.blocked')}</span>}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {c.favoriteServices.length > 0 ? c.favoriteServices.join(', ') : t('customers.noFavoriteService')}
                    {c.preferredStaff ? ` · ${t('customers.usuallyWith', { name: c.preferredStaff })}` : ''}
                    {c.noShowCount > 0 ? ` · ${t('customers.noShowCount', { count: c.noShowCount })}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-medium text-text">{t('customers.visit', { count: c.visitCount })}</p>
                  <p className="text-xs text-text-faint">{c.lastVisit ? t('customers.last', { date: formatDate(c.lastVisit) }) : '—'}</p>
                </div>
                <div className="text-right shrink-0 w-24">
                  <p className="text-sm font-semibold text-accent">{currency(c.totalSpent)}</p>
                </div>
                {c.userNumber && (
                  <a
                    href={`tel:${c.userNumber}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg text-text-faint hover:text-accent hover:bg-surface-3 transition-colors shrink-0"
                    title={t('customers.call')}
                  >
                    <PhoneIcon className="w-4 h-4" />
                  </a>
                )}
              </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={!!selectedId} onClose={closeDetail} title={detail?.userName || t('customers.customerFallback')} maxWidth="max-w-lg">
        {!detail ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-4 bg-surface-3 rounded shimmer-bg" />)}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
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
              <div className="bg-surface-3 rounded-xl p-3">
                <p className={`text-lg font-semibold ${detail.noShowCount > 0 ? 'text-danger' : 'text-text'}`}>{detail.noShowCount}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{t('customers.noShows')}</p>
              </div>
            </div>

            <button
              onClick={requestToggleBlock}
              disabled={blockBusy}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${detail.isBlocked ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-surface-3 border-border text-text-muted hover:text-text'}`}
            >
              {detail.isBlocked ? t('customers.unblockAction') : t('customers.blockAction')}
            </button>

            <div className="bg-surface-3 border border-border-soft rounded-xl p-4 space-y-3 text-xs">
              <h3 className="font-semibold text-text text-sm mb-2">{t('customers.clientDetails', 'Mijoz ma\'lumotlari')}</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-surface-2 border border-border/60">
                  <span className="text-text-muted block text-[11px] mb-0.5">{t('customers.fullName', 'To\'liq ism')}:</span>
                  <span className="font-semibold text-text text-sm">{detail.userName || '—'}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-2 border border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-text-muted block text-[11px] mb-0.5">{t('common.phoneNumber', 'Telefon raqam')}:</span>
                    <span className="font-semibold text-text text-sm font-mono">{detail.userNumber || '—'}</span>
                  </div>
                  {!editingInfo && (
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      {detail.userNumber && (
                        <a href={`tel:${detail.userNumber}`} className="p-1.5 rounded-lg bg-surface-3 text-text-faint hover:text-accent transition-colors" title={t('customers.call')}>
                          <PhoneIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={startEditInfo} className="p-1.5 rounded-lg bg-surface-3 text-text-faint hover:text-accent transition-colors" title={t('common.edit')}>
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-surface-2 border border-border/60">
                  <span className="text-text-muted block text-[11px] mb-0.5">{t('customers.telegramProfile', 'Telegram profil')}:</span>
                  <span className="font-medium text-text">
                    {detail.userTelegramUsername ? `@${detail.userTelegramUsername}` : `ID: ${detail.telegramId}`}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-2 border border-border/60">
                  <span className="text-text-muted block text-[11px] mb-0.5">{t('customers.firstVisit', 'Birinchi tashrif')}:</span>
                  <span className="font-medium text-text">
                    {detail.firstVisit ? formatDate(detail.firstVisit) : '—'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-2 border border-border/60">
                  <span className="text-text-muted block text-[11px] mb-0.5">{t('customers.preferredSpecialist', 'Doimiy mutaxassis')}:</span>
                  <span className="font-medium text-text">{detail.preferredStaff || t('customers.none', 'Mavjud emas')}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-2 border border-border/60">
                  <span className="text-text-muted block text-[11px] mb-0.5">{t('customers.favoriteServices', 'Sevimli xizmatlar')}:</span>
                  <span className="font-medium text-text">
                    {detail.favoriteServices.length > 0 ? detail.favoriteServices.join(', ') : t('customers.none', 'Mavjud emas')}
                  </span>
                </div>
              </div>
            </div>

            {editingInfo && (
              <div className="grid sm:grid-cols-2 gap-3 bg-surface-3 border border-border rounded-lg p-3">
                <Field label={t('appointments.manual.newClientName')}><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></Field>
                <Field label={t('common.phoneNumber')}><Input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} /></Field>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => setEditingInfo(false)}>{t('common.cancel')}</Button>
                  <Button className="!px-3 !py-1.5 text-xs" disabled={!editName.trim() || savingInfo} onClick={saveInfo}>{savingInfo ? t('common.saving') : t('common.save')}</Button>
                </div>
              </div>
            )}

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

      <Modal
        open={blockConfirmOpen}
        onClose={() => setBlockConfirmOpen(false)}
        title={t('customers.blockAction')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setBlockConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={blockBusy} onClick={toggleBlock}>{t('customers.blockAction')}</Button>
          </>
        )}
      >
        <p className="text-sm text-text-muted">{t('customers.blockConfirm', { name: detail?.userName })}</p>
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('customers.newClient')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={!createName.trim() || creating} onClick={createCustomer}>{creating ? t('common.saving') : t('common.save')}</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label={t('appointments.manual.newClientName')}><Input value={createName} onChange={(e) => setCreateName(e.target.value)} autoFocus /></Field>
          <Field label={t('common.phoneNumber')}><Input value={createNumber} onChange={(e) => setCreateNumber(e.target.value)} /></Field>
        </div>
      </Modal>

      {/* Win-Back Re-engagement Broadcast Modal */}
      <Modal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        title={t('crm.broadcastTitle', 'Send Telegram Win-Back Broadcast')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setBroadcastOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button disabled={broadcasting} onClick={sendBroadcast}>
              {broadcasting ? t('common.sending', 'Sending...') : t('crm.sendBroadcastBtn', 'Send Broadcast')}
            </Button>
          </>
        )}
      >
        <form onSubmit={sendBroadcast} className="space-y-4">
          <Field label={t('crm.targetSegmentLabel', 'Target Segment')}>
            <select
              value={broadcastSegment}
              onChange={(e) => setBroadcastSegment(e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
            >
              <option value="at_risk">{t('crm.segAtRisk', 'At-Risk (29-60 days)')} ({crmData?.segments?.at_risk?.count || 0})</option>
              <option value="lost">{t('crm.segLost', 'Lost (60+ days)')} ({crmData?.segments?.lost?.count || 0})</option>
              <option value="vip">{t('crm.segVip', 'VIP Clients')} ({crmData?.segments?.vip?.count || 0})</option>
              <option value="regular">{t('crm.segRegular', 'Regular Clients')} ({crmData?.segments?.regular?.count || 0})</option>
            </select>
          </Field>

          <Field
            label={t('crm.messageTemplateLabel', 'Custom Message (optional)')}
            hint={t('crm.templateHint', 'Variables: {name}, {shop}. Leave blank for default localized message.')}
          >
            <Textarea
              rows={3}
              value={broadcastTemplate}
              onChange={(e) => setBroadcastTemplate(e.target.value)}
              placeholder={t('crm.templatePlaceholder', 'Salom {name}! {shop} sizni kutmoqda...')}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
