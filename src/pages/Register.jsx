import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BanknotesIcon,
  PlusIcon,
  LockClosedIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/ToastProvider';
import StatCard from '../components/StatCard';
import { Card, Button, Field, Input, EmptyState } from '../components/ui';
import Modal from '../components/Modal';
import { StatCardSkeleton, TableRowSkeleton } from '../components/Skeleton';
import { localeFor } from '../lib/locale';

const currency = (n) => `${Math.round(n || 0).toLocaleString()} UZS`;

const TX_TYPES = [
  { id: 'service_payment', labelKey: 'register.typeService', fallback: 'Service Payment', isExpense: false },
  { id: 'product_sale', labelKey: 'register.typeProduct', fallback: 'Product Sale', isExpense: false },
  { id: 'tip', labelKey: 'register.typeTip', fallback: 'Tip', isExpense: false },
  { id: 'expense', labelKey: 'register.typeExpense', fallback: 'Shop Expense', isExpense: true },
  { id: 'payout', labelKey: 'register.typePayout', fallback: 'Staff Payout', isExpense: true },
];

const METHODS = [
  { id: 'cash', labelKey: 'register.methodCash', fallback: 'Cash' },
  { id: 'click', labelKey: 'register.methodClick', fallback: 'Click' },
  { id: 'payme', labelKey: 'register.methodPayme', fallback: 'Payme' },
  { id: 'terminal_uzcard_humo', labelKey: 'register.methodTerminal', fallback: 'Terminal' },
];

export default function Register() {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // { isOpen, register, summary }
  const [transactions, setTransactions] = useState([]);
  const [history, setHistory] = useState([]);
  const [staff, setStaff] = useState([]);

  // Open Register modal
  const [openingFloat, setOpeningFloat] = useState('0');
  const [openingBusy, setOpeningBusy] = useState(false);

  // Add Transaction modal
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState({
    type: 'service_payment',
    amount: '',
    paymentMethod: 'cash',
    staffId: '',
    description: '',
  });
  const [txSaving, setTxSaving] = useState(false);

  // Close Shift & Z-Report modal
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closingBusy, setClosingBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cur, txRes, histRes, shopRes] = await Promise.all([
        api.get('/admin/register/current'),
        api.get('/admin/register/transactions?limit=100'),
        api.get('/admin/register/history?limit=15'),
        api.get('/admin/shop'),
      ]);
      setStatus(cur);
      setTransactions(txRes.transactions || []);
      setHistory(histRes.sessions || []);
      setStaff(shopRes.staff || []);
    } catch (err) {
      showToast(err.message || t('register.toastLoadError', 'Failed to load register'), 'error');
    } finally {
      setLoading(false);
    }
  }, [api, showToast, t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleOpenRegister = async (e) => {
    e.preventDefault();
    const numericFloat = Number(openingFloat || 0);
    if (!Number.isFinite(numericFloat) || numericFloat < 0) {
      showToast(t('register.invalidAmount', 'Enter a valid non-negative amount'), 'error');
      return;
    }
    setOpeningBusy(true);
    try {
      await api.post('/admin/register/open', { openingCashBalance: numericFloat });
      showToast(t('register.toastOpened', 'Cashier shift opened'));
      await loadAll();
    } catch (err) {
      showToast(err.message || t('register.toastError', 'Action failed'), 'error');
    } finally {
      setOpeningBusy(false);
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    const numericAmount = Number(txForm.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || txForm.amount === '') {
      showToast(t('register.invalidAmount', 'Enter a valid positive amount'), 'error');
      return;
    }

    const chosenStaff = staff.find((s) => String(s._id) === txForm.staffId);
    setTxSaving(true);
    try {
      await api.post('/admin/register/transactions', {
        type: txForm.type,
        amount: numericAmount,
        paymentMethod: txForm.paymentMethod,
        staffId: txForm.staffId || null,
        staffName: chosenStaff?.name || '',
        description: txForm.description.trim(),
      });
      showToast(t('register.toastTxRecorded', 'Transaction recorded'));
      setTxModalOpen(false);
      setTxForm({ type: 'service_payment', amount: '', paymentMethod: 'cash', staffId: '', description: '' });
      await loadAll();
    } catch (err) {
      showToast(err.message || t('register.toastError', 'Failed to record transaction'), 'error');
    } finally {
      setTxSaving(false);
    }
  };

  const handleCloseRegister = async (e) => {
    e.preventDefault();
    const numericClosing = Number(closingCash);
    if (closingCash === '' || !Number.isFinite(numericClosing) || numericClosing < 0) {
      showToast(t('register.invalidAmount', 'Enter a valid physical cash count'), 'error');
      return;
    }
    setClosingBusy(true);
    try {
      await api.post('/admin/register/close', {
        closingCashBalance: numericClosing,
        notes: closeNotes.trim(),
      });
      showToast(t('register.toastClosed', 'Shift closed and Z-Report generated'));
      setCloseModalOpen(false);
      setClosingCash('');
      setCloseNotes('');
      await loadAll();
    } catch (err) {
      showToast(err.message || t('register.toastError', 'Failed to close register'), 'error');
    } finally {
      setClosingBusy(false);
    }
  };

  const formatDateTime = (dt) =>
    new Date(dt).toLocaleString(localeFor(i18n.language), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const expectedCash = status?.summary?.expectedCashBalance || 0;
  const discrepancyPreview = closingCash !== '' && Number.isFinite(Number(closingCash))
    ? Number(closingCash) - expectedCash
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">
            {t('register.title', 'Cashier & Z-Report')}
          </h1>
          <p className="text-sm text-text-muted">
            {t('register.subtitle', 'Daily cash drawer, Click/Payme breakdown, and shift reconciliation')}
          </p>
        </div>

        {status?.isOpen && (
          <div className="flex items-center gap-2">
            <Button variant="subtle" onClick={() => setTxModalOpen(true)}>
              <PlusIcon className="w-4 h-4" />
              {t('register.addTransaction', 'Add Transaction')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setClosingCash(String(expectedCash));
                setCloseModalOpen(true);
              }}
            >
              <LockClosedIcon className="w-4 h-4" />
              {t('register.closeShift', 'Close Shift')}
            </Button>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <Card className="p-4 space-y-3">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </Card>
        </div>
      ) : !status?.isOpen ? (
        /* Closed State: Open New Register Shift */
        <Card className="p-6 md:p-8 max-w-lg mx-auto">
          <form onSubmit={handleOpenRegister} className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                <BanknotesIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text">
                  {t('register.openShiftTitle', 'Open Cashier Register')}
                </h2>
                <p className="text-xs text-text-muted">
                  {t('register.openShiftDesc', 'Enter your starting cash drawer float to begin tracking today’s sales.')}
                </p>
              </div>
            </div>

            <Field label={t('register.openingFloatLabel', 'Opening Cash Float (UZS)')}>
              <Input
                type="number"
                min="0"
                step="1000"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="tabular-nums text-base font-semibold"
                required
              />
            </Field>

            <Button type="submit" disabled={openingBusy} className="w-full min-h-[44px]">
              {openingBusy ? t('common.saving', 'Opening...') : t('register.openShiftBtn', 'Open Shift')}
            </Button>
          </form>
        </Card>
      ) : (
        /* Open Register Shift View */
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              index={0}
              accent
              label={t('register.totalIncome', 'Total Income')}
              value={status.summary.totalIncome}
              format={(v) => Math.round(v).toLocaleString()}
              suffix=" UZS"
            />
            <StatCard
              index={1}
              label={t('register.totalExpense', 'Expenses & Payouts')}
              value={status.summary.totalExpense}
              format={(v) => Math.round(v).toLocaleString()}
              suffix=" UZS"
            />
            <StatCard
              index={2}
              label={t('register.expectedCash', 'Expected Drawer Cash')}
              value={status.summary.expectedCashBalance}
              format={(v) => Math.round(v).toLocaleString()}
              suffix=" UZS"
            />
            <StatCard
              index={3}
              label={t('register.netRevenue', 'Net Revenue')}
              value={status.summary.netRevenue}
              format={(v) => Math.round(v).toLocaleString()}
              suffix=" UZS"
            />
          </div>

          {/* Payment Method Breakdown */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wide">
                {t('register.methodBreakdown', 'Payment Method Breakdown')}
              </h2>
              <span className="text-xs text-text-muted tabular-nums">
                {t('register.openingFloatShort', 'Float')}: {currency(status.register.openingCashBalance)}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {METHODS.map(({ id, labelKey, fallback }) => {
                const amt = status.summary.breakdownByMethod?.[id] || 0;
                const pct = status.summary.totalIncome > 0
                  ? Math.round((amt / status.summary.totalIncome) * 100)
                  : 0;
                return (
                  <div key={id} className="p-3.5 rounded-xl bg-surface-2 border border-border-soft space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted font-medium">{t(labelKey, fallback)}</span>
                      <span className="text-accent font-semibold tabular-nums">{pct}%</span>
                    </div>
                    <p className="text-base font-semibold text-text tabular-nums">{currency(amt)}</p>
                    <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Current Shift Transactions */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wide">
                {t('register.ledgerTitle', 'Shift Transactions')} ({transactions.length})
              </h2>
            </div>
            {transactions.length === 0 ? (
              <EmptyState
                icon="🧾"
                title={t('register.noTxTitle', 'No transactions yet')}
                description={t('register.noTxDesc', 'Record service payments, product sales, or cash expenses here.')}
              />
            ) : (
              <div className="divide-y divide-border-soft">
                {transactions.map((tx, idx) => {
                  const isExp = tx.type === 'expense' || tx.type === 'payout';
                  return (
                    <motion.div
                      key={tx._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.25) }}
                      className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-surface-2/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={clsx(
                            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border',
                            isExp
                              ? 'bg-danger/10 border-danger/25 text-danger'
                              : 'bg-success/10 border-success/25 text-success'
                          )}
                        >
                          {isExp ? <ArrowTrendingDownIcon className="w-4 h-4" /> : <ArrowTrendingUpIcon className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text truncate">
                            {tx.description || t(`register.type_${tx.type}`, tx.type.replace('_', ' '))}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {tx.paymentMethod.toUpperCase()}
                            {tx.staffName ? ` · ${tx.staffName}` : ''}
                            {tx.customerName ? ` · ${tx.customerName}` : ''}
                            {' · '}
                            {formatDateTime(tx.createdAt)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={clsx(
                          'text-sm font-semibold tabular-nums shrink-0',
                          isExp ? 'text-danger' : 'text-success'
                        )}
                      >
                        {isExp ? '-' : '+'}{currency(tx.amount)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Past Z-Report History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide flex items-center gap-2">
            <DocumentCheckIcon className="w-4 h-4 text-accent" />
            {t('register.historyTitle', 'Past Z-Reports')}
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {history.map((session) => (
              <Card key={session._id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">
                    {formatDateTime(session.closedAt)}
                  </span>
                  <span
                    className={clsx(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums',
                      session.cashDiscrepancy === 0
                        ? 'bg-success/15 text-success'
                        : session.cashDiscrepancy < 0
                          ? 'bg-danger/15 text-danger'
                          : 'bg-warning/15 text-warning'
                    )}
                  >
                    {session.cashDiscrepancy === 0
                      ? t('register.balanced', 'Balanced')
                      : `${session.cashDiscrepancy > 0 ? '+' : ''}${currency(session.cashDiscrepancy)}`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-border-soft">
                  <div>
                    <span className="text-text-faint block">{t('register.incomeShort', 'Income')}</span>
                    <span className="font-semibold text-text tabular-nums">{currency(session.totalIncome)}</span>
                  </div>
                  <div>
                    <span className="text-text-faint block">{t('register.expenseShort', 'Expenses')}</span>
                    <span className="font-semibold text-text tabular-nums">{currency(session.totalExpense)}</span>
                  </div>
                  <div>
                    <span className="text-text-faint block">{t('register.drawerShort', 'Counted Cash')}</span>
                    <span className="font-semibold text-accent tabular-nums">{currency(session.closingCashBalance)}</span>
                  </div>
                </div>
                {session.notes && (
                  <p className="text-xs text-text-muted italic truncate">“{session.notes}”</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      <Modal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title={t('register.addTransaction', 'Add Transaction')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setTxModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button disabled={txSaving} onClick={handleAddTransaction}>
              {txSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Button>
          </>
        )}
      >
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-sm text-text-muted font-medium block">{t('register.txTypeLabel', 'Type')}</span>
            <div className="flex flex-wrap gap-1.5">
              {TX_TYPES.map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => setTxForm((f) => ({ ...f, type: tp.id }))}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                    txForm.type === tp.id
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-surface-3 border-border text-text-muted hover:text-text'
                  )}
                >
                  {t(tp.labelKey, tp.fallback)}
                </button>
              ))}
            </div>
          </div>

          <Field label={t('register.amountLabel', 'Amount (UZS)')}>
            <Input
              type="number"
              min="0"
              step="1000"
              value={txForm.amount}
              onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="50000"
              className="tabular-nums text-base font-semibold"
              required
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[50000, 80000, 100000, 150000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTxForm((f) => ({ ...f, amount: String(preset) }))}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-[11px] font-medium tabular-nums border transition-colors cursor-pointer',
                    txForm.amount === String(preset)
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-surface-3 border-border text-text-muted hover:text-text'
                  )}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>
          </Field>

          <div className="space-y-1.5">
            <span className="text-sm text-text-muted font-medium block">{t('register.paymentMethodLabel', 'Payment Method')}</span>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTxForm((f) => ({ ...f, paymentMethod: m.id }))}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer min-h-[40px]',
                    txForm.paymentMethod === m.id
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-surface-3 border-border text-text-muted hover:text-text'
                  )}
                >
                  {t(m.labelKey, m.fallback)}
                </button>
              ))}
            </div>
          </div>

          {staff.length > 0 && (
            <Field label={t('register.staffOptional', 'Master / Staff (optional)')}>
              <select
                value={txForm.staffId}
                onChange={(e) => setTxForm((f) => ({ ...f, staffId: e.target.value }))}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
              >
                <option value="">{t('register.noneSelected', '— None —')}</option>
                {staff.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label={t('register.noteLabel', 'Description')}>
            <Input
              value={txForm.description}
              onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('register.notePlaceholder', 'Haircut, Coffee, Supplies...')}
            />
          </Field>
        </form>
      </Modal>

      {/* Close Register & Z-Report Modal */}
      <Modal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title={t('register.closeShiftTitle', 'Close Shift & Generate Z-Report')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCloseModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button variant="danger" disabled={closingBusy} onClick={handleCloseRegister}>
              {closingBusy ? t('common.saving', 'Closing...') : t('register.confirmCloseBtn', 'Confirm & Close Shift')}
            </Button>
          </>
        )}
      >
        <form onSubmit={handleCloseRegister} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-surface-3 border border-border-soft flex items-center justify-between text-sm">
            <span className="text-text-muted">{t('register.expectedCash', 'Expected Drawer Cash')}</span>
            <span className="font-semibold text-text tabular-nums">{currency(expectedCash)}</span>
          </div>

          <Field label={t('register.actualCashLabel', 'Actual Physical Cash Count (UZS)')}>
            <Input
              type="number"
              min="0"
              step="1000"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              className="tabular-nums text-base font-semibold"
              required
            />
          </Field>

          {discrepancyPreview !== null && (
            <div
              className={clsx(
                'px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between',
                discrepancyPreview === 0
                  ? 'bg-success/10 border-success/30 text-success'
                  : discrepancyPreview < 0
                    ? 'bg-danger/10 border-danger/30 text-danger'
                    : 'bg-warning/10 border-warning/30 text-warning'
              )}
            >
              <span>{t('register.discrepancyLabel', 'Drawer Difference')}</span>
              <span className="tabular-nums font-semibold">
                {discrepancyPreview === 0
                  ? t('register.balanced', 'Balanced (0 UZS)')
                  : `${discrepancyPreview > 0 ? '+' : ''}${currency(discrepancyPreview)}`}
              </span>
            </div>
          )}

          <Field label={t('register.closingNotesLabel', 'Shift Notes (optional)')}>
            <Input
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder={t('register.closingNotesPlaceholder', 'Everything balanced')}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
