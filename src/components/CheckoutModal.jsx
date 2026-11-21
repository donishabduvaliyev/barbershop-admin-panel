import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { BanknotesIcon, CreditCardIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../lib/AuthContext';
import { useToast } from './ToastProvider';
import Modal from './Modal';
import { Button, Field, Input } from './ui';

const PAYMENT_METHODS = [
  { id: 'cash', labelKey: 'register.methodCash', fallback: 'Cash', icon: BanknotesIcon },
  { id: 'click', labelKey: 'register.methodClick', fallback: 'Click', icon: DevicePhoneMobileIcon },
  { id: 'payme', labelKey: 'register.methodPayme', fallback: 'Payme', icon: DevicePhoneMobileIcon },
  { id: 'terminal_uzcard_humo', labelKey: 'register.methodTerminal', fallback: 'Terminal', icon: CreditCardIcon },
];

export default function CheckoutModal({
  open,
  onClose,
  initialAmount = '',
  staffId = null,
  staffName = '',
  bookingId = null,
  customerName = '',
  customerPhone = '',
  description = '',
  onSuccess,
}) {
  const { t } = useTranslation();
  const { api } = useAuth();
  const { showToast } = useToast();

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [registerClosedError, setRegisterClosedError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(initialAmount ? String(initialAmount) : '');
    setPaymentMethod('cash');
    setNote(description || '');
    setRegisterClosedError(false);
  }, [open, initialAmount, description]);

  const submit = async (e) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0 || amount === '') {
      showToast(t('register.invalidAmount', 'Enter a valid amount'), 'error');
      return;
    }

    setSaving(true);
    setRegisterClosedError(false);
    try {
      const res = await api.post('/admin/register/transactions', {
        type: 'service_payment',
        amount: numericAmount,
        paymentMethod,
        staffId: staffId || null,
        staffName: staffName || '',
        bookingId: bookingId || null,
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        description: note.trim(),
      });
      showToast(t('register.toastTxRecorded', 'Payment recorded to register'));
      onSuccess?.(res.transaction);
      onClose();
    } catch (err) {
      if (err.status === 400 && err.message?.toLowerCase().includes('no open register')) {
        setRegisterClosedError(true);
      } else {
        showToast(err.message || t('register.toastError', 'Failed to record payment'), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const quickOpenAndPay = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0 || amount === '') {
      showToast(t('register.invalidAmount', 'Enter a valid amount'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/register/open', { openingCashBalance: 0 });
      const res = await api.post('/admin/register/transactions', {
        type: 'service_payment',
        amount: numericAmount,
        paymentMethod,
        staffId: staffId || null,
        staffName: staffName || '',
        bookingId: bookingId || null,
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        description: note.trim(),
      });
      showToast(t('register.toastQuickOpenedAndPaid', 'Register opened & payment recorded'));
      onSuccess?.(res.transaction);
      onClose();
    } catch (err) {
      showToast(err.message || t('register.toastError', 'Failed to record payment'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('register.checkoutTitle', 'Record Payment to Register')}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? t('common.saving', 'Saving...') : t('register.recordPaymentBtn', 'Record Payment')}
          </Button>
        </>
      )}
    >
      <form onSubmit={submit} className="space-y-4">
        {registerClosedError && (
          <div className="p-3.5 rounded-xl bg-warning/10 border border-warning/30 text-xs text-warning space-y-2.5">
            <p className="font-medium">{t('register.mustOpenFirst', 'No register shift is open right now.')}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                type="button"
                variant="primary"
                disabled={saving}
                onClick={quickOpenAndPay}
                className="!px-3 !py-1.5 text-xs"
              >
                {t('register.quickOpenAndPayBtn', 'Open Register (0 UZS) & Pay')}
              </Button>
              <Link
                to="/register"
                onClick={onClose}
                className="inline-flex items-center font-semibold underline hover:text-text transition-colors"
              >
                {t('register.goToRegister', 'Open Register Page →')}
              </Link>
            </div>
          </div>
        )}

        {customerName && (
          <div className="px-3.5 py-2.5 rounded-xl bg-surface-3/60 border border-border-soft flex items-center justify-between text-xs">
            <span className="text-text-muted">{t('register.clientLabel', 'Client')}</span>
            <span className="font-medium text-text">{customerName}{staffName ? ` · ${staffName}` : ''}</span>
          </div>
        )}

        <Field label={t('register.amountLabel', 'Amount (UZS)')}>
          <Input
            type="number"
            min="0"
            step="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="80000"
            className="tabular-nums text-base font-semibold"
            required
          />
        </Field>

        <div className="space-y-1.5">
          <span className="text-sm text-text-muted font-medium block">
            {t('register.paymentMethodLabel', 'Payment Method')}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(({ id, labelKey, fallback, icon: Icon }) => {
              const active = paymentMethod === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaymentMethod(id)}
                  className={clsx(
                    'press-spring flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer min-h-[44px]',
                    active
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-surface-3 border-border text-text-muted hover:text-text hover:border-border'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{t(labelKey, fallback)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Field label={t('register.noteLabel', 'Description / Service')}>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('register.notePlaceholder', 'Haircut + Beard')}
          />
        </Field>
      </form>
    </Modal>
  );
}
