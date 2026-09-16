import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { EyeSlashIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../components/ToastProvider';
import { Card, Button, Field, Textarea, EmptyState } from '../../components/ui';
import Modal from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';

const FILTERS = ['all', 'visible', 'hidden'];

function Stars({ value }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarSolid key={i} className={`w-3.5 h-3.5 ${i < value ? 'text-accent' : 'text-border'}`} />
      ))}
    </span>
  );
}

export default function SuperAdminReviews() {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const { showToast } = useToast();

  const [reviews, setReviews] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const [hideTarget, setHideTarget] = useState(null);
  const [hideReason, setHideReason] = useState('');
  const [hiding, setHiding] = useState(false);

  const load = () => {
    const query = new URLSearchParams();
    if (filter === 'visible') query.set('hidden', 'false');
    if (filter === 'hidden') query.set('hidden', 'true');
    const qs = query.toString();
    api.get(`/superadmin/reviews${qs ? `?${qs}` : ''}`).then((res) => setReviews(res.reviews));
  };

  useEffect(() => { setReviews(null); load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openHide = (review) => { setHideTarget(review); setHideReason(''); };

  const confirmHide = async () => {
    setHiding(true);
    try {
      await api.patch(`/superadmin/reviews/${hideTarget.id}/hide`, { reason: hideReason.trim() });
      showToast(t('superadmin.reviews.toastHidden'));
      setHideTarget(null);
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.reviews.toastError'), 'error');
    } finally {
      setHiding(false);
    }
  };

  const restore = async (review) => {
    setBusyId(review.id);
    try {
      await api.patch(`/superadmin/reviews/${review.id}/restore`);
      showToast(t('superadmin.reviews.toastRestored'));
      load();
    } catch (err) {
      showToast(err.message || t('superadmin.reviews.toastError'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">{t('superadmin.reviews.title')}</h1>
          <p className="text-text-muted text-sm mt-1">{t('superadmin.reviews.subtitle')}</p>
        </div>
        <div className="flex gap-1.5 bg-surface border border-border-soft rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${filter === f ? 'bg-accent text-black' : 'text-text-muted hover:text-text'}`}
            >
              {t(`superadmin.reviews.filter${f[0].toUpperCase()}${f.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {reviews === null ? (
          <div>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-5 py-4"><Skeleton className="h-10 w-full" /></div>)}</div>
        ) : reviews.length === 0 ? (
          <EmptyState icon="⭐" title={t('superadmin.reviews.noReviewsTitle')} description={t('superadmin.reviews.noReviewsDesc')} />
        ) : (
          <div className="divide-y divide-border-soft">
            {reviews.map((r) => (
              <div key={r.id} className="px-5 py-4 flex items-center gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-text truncate">{r.shopName?.[i18n.language] || r.shopName?.en}</p>
                    <Stars value={r.rating} />
                    {r.isHidden && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-danger/15 text-danger">{t('superadmin.reviews.hidden')}</span>}
                  </div>
                  <p className="text-xs text-text-faint truncate mt-0.5">
                    {r.userName || t('superadmin.reviews.unknownCustomer')}
                    {r.staffName ? ` · ${r.staffName}${r.staffRating ? ` (${r.staffRating}★)` : ''}` : ''}
                    {' · '}{new Date(r.createdAt).toLocaleDateString(i18n.language)}
                  </p>
                  {r.isHidden && r.hiddenReason && (
                    <p className="text-xs text-danger/80 mt-1">{t('superadmin.reviews.hiddenReasonLabel')}: {r.hiddenReason}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {r.isHidden ? (
                    <button
                      title={t('superadmin.reviews.restore')}
                      disabled={busyId === r.id}
                      onClick={() => restore(r)}
                      className="p-1.5 rounded-lg text-text-faint hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      title={t('superadmin.reviews.hide')}
                      onClick={() => openHide(r)}
                      className="p-1.5 rounded-lg text-text-faint hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <EyeSlashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={!!hideTarget}
        onClose={() => setHideTarget(null)}
        title={t('superadmin.reviews.hideTitle')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setHideTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={hiding} onClick={confirmHide}>{hiding ? t('common.saving') : t('superadmin.reviews.hide')}</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-muted">{t('superadmin.reviews.hideDesc')}</p>
          <Field label={t('superadmin.reviews.hideReasonLabel')}>
            <Textarea rows={3} value={hideReason} onChange={(e) => setHideReason(e.target.value)} placeholder={t('superadmin.reviews.hideReasonPlaceholder')} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
