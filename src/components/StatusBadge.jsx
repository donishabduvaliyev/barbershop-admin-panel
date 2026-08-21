import React from 'react';

const STATUS_META = {
  pending: { label: 'Pending', color: 'var(--color-warning)' },
  confirmed: { label: 'Confirmed', color: 'var(--color-info)' },
  completed: { label: 'Completed', color: 'var(--color-success)' },
  rejected: { label: 'Rejected', color: 'var(--color-danger)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-text-faint)' },
};

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: 'var(--color-text-faint)' };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
