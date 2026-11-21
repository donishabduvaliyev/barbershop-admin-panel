import React, { useCallback, useEffect, useState } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useToast } from './ToastProvider';
import StatCard from './StatCard';
import { Card, Input, EmptyState } from './ui';
import { StatCardSkeleton, TableRowSkeleton } from './Skeleton';

const currency = (n) => `${Math.round(n || 0).toLocaleString()} UZS`;

const toLocalDateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function StaffPayrollTab({ onCommissionUpdated }) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const { showToast } = useToast();

  const [preset, setPreset] = useState('month'); // 'today' | 'week' | 'month'
  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editingStaffId, setEditingStaffId] = useState(null);
  const [commissionDraft, setCommissionDraft] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let query = '';
      if (preset === 'today') {
        query = `?date=${toLocalDateKey(now)}`;
      } else if (preset === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 6);
        query = `?from=${toLocalDateKey(weekAgo)}&to=${toLocalDateKey(now)}`;
      } else {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        query = `?from=${toLocalDateKey(firstDay)}&to=${toLocalDateKey(now)}`;
      }
      const res = await api.get(`/admin/staff/commissions${query}`);
      setPayroll(res);
    } catch (err) {
      showToast(err.message || t('staff.payrollLoadError', 'Failed to load payroll'), 'error');
    } finally {
      setLoading(false);
    }
  }, [api, preset, showToast, t]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  const saveCommission = async (staffId) => {
    const val = Number(commissionDraft);
    if (!Number.isFinite(val) || val < 0 || val > 100 || commissionDraft === '') {
      showToast(t('staff.invalidCommission', 'Commission must be between 0 and 100%'), 'error');
      return;
    }
    setSavingRate(true);
    try {
      await api.patch(`/admin/staff/${staffId}/commission`, { commission: val });
      showToast(t('staff.commissionUpdatedToast', 'Commission rate updated'));
      setEditingStaffId(null);
      await loadPayroll();
      onCommissionUpdated?.();
    } catch (err) {
      showToast(err.message || t('staff.toastSaveError', 'Failed to update commission'), 'error');
    } finally {
      setSavingRate(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Period Preset Selector */}
      <div className="flex items-center gap-1.5 bg-surface border border-border-soft rounded-xl p-1 w-fit">
        {[
          { id: 'today', label: t('common.today', 'Today') },
          { id: 'week', label: t('staff.presetWeek', 'Last 7 Days') },
          { id: 'month', label: t('staff.presetMonth', 'This Month') },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPreset(item.id)}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
              preset === item.id
                ? 'bg-accent text-black font-semibold'
                : 'text-text-muted hover:text-text'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <Card className="p-4 space-y-3">
            <TableRowSkeleton />
            <TableRowSkeleton />
          </Card>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              index={0}
              accent
              label={t('staff.grossRevenue', 'Gross Revenue')}
              value={payroll?.totalGrossRevenue || 0}
              format={(v) => Math.round(v).toLocaleString()}
              suffix=" UZS"
            />
            <StatCard
              index={1}
              label={t('staff.totalPayout', 'Staff Payout')}
              value={payroll?.totalStaffPayout || 0}
              format={(v) => Math.round(v).toLocaleString()}
              suffix=" UZS"
            />
            <StatCard
              index={2}
              label={t('staff.salonRetained', 'Salon Retained')}
              value={payroll?.totalShopRetained || 0}
              format={(v) => Math.round(v).toLocaleString()}
              suffix=" UZS"
            />
          </div>

          {/* Per-Master Breakdown */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border-soft">
              <h3 className="text-sm font-semibold text-text uppercase tracking-wide">
                {t('staff.payrollBreakdownTitle', 'Commission Breakdown by Master')}
              </h3>
            </div>
            {!payroll?.staffBreakdown?.length ? (
              <EmptyState
                icon="💵"
                title={t('staff.noPayrollData', 'No completed visits in this period')}
                description={t('staff.noPayrollDesc', 'Completed bookings automatically calculate master payouts here.')}
              />
            ) : (
              <div className="divide-y divide-border-soft">
                {payroll.staffBreakdown.map((row) => {
                  const isEditing = editingStaffId && editingStaffId === String(row.staffId);
                  return (
                    <div key={row.staffId || row.name} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-text">{row.name}</p>
                          {row.staffId && !isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStaffId(String(row.staffId));
                                setCommissionDraft(String(row.commissionRate));
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] font-semibold hover:bg-accent/25 transition-colors cursor-pointer tabular-nums"
                              title={t('staff.editCommissionHint', 'Edit commission %')}
                            >
                              {row.commissionRate}%
                              <PencilIcon className="w-3 h-3" />
                            </button>
                          )}
                          {isEditing && (
                            <div className="inline-flex items-center gap-1.5">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={commissionDraft}
                                onChange={(e) => setCommissionDraft(e.target.value)}
                                className="w-20 py-1 px-2 text-xs tabular-nums"
                              />
                              <button
                                type="button"
                                disabled={savingRate}
                                onClick={() => saveCommission(row.staffId)}
                                className="p-1.5 rounded-lg bg-success/15 text-success hover:bg-success/25 cursor-pointer"
                              >
                                <CheckIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingStaffId(null)}
                                className="p-1.5 rounded-lg bg-surface-3 text-text-muted hover:text-text cursor-pointer"
                              >
                                <XMarkIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-text-muted tabular-nums">
                          {row.completedBookingsCount} {t('staff.visitsCount', 'visits')}
                          {row.shiftsCount > 0 ? ` · ${row.shiftsCount} ${t('staff.shiftsCount', 'shifts')} (${row.totalHoursWorked}h)` : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-4 sm:text-right text-xs shrink-0">
                        <div>
                          <span className="text-text-faint block">{t('staff.grossShort', 'Gross')}</span>
                          <span className="font-medium text-text tabular-nums">{currency(row.grossRevenue)}</span>
                        </div>
                        <div>
                          <span className="text-text-faint block">{t('staff.payoutShort', 'Master Cut')}</span>
                          <span className="font-semibold text-accent tabular-nums">{currency(row.staffPayout)}</span>
                        </div>
                        <div>
                          <span className="text-text-faint block">{t('staff.salonShort', 'Salon Cut')}</span>
                          <span className="font-semibold text-success tabular-nums">{currency(row.shopRetained)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
