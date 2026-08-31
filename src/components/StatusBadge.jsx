import React from 'react';
import { useTranslation } from 'react-i18next';

const STATUS_META = {
  pending: { key: 'pending', color: 'var(--color-warning)' },
  confirmed: { key: 'confirmed', color: 'var(--color-info)' },
  completed: { key: 'completed', color: 'var(--color-success)' },
  rejected: { key: 'rejected', color: 'var(--color-danger)' },
  cancelled: { key: 'cancelled', color: 'var(--color-text-faint)' },
  'no-show': { key: 'noShow', color: 'var(--color-danger)' },
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const meta = STATUS_META[status] || { key: null, color: 'var(--color-text-faint)' };
  const label = meta.key ? t(`statusBadge.${meta.key}`) : status;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      {label}
    </span>
  );
}
