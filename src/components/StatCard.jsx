import React from 'react';
import { motion } from 'framer-motion';
import { useCountUp } from '../lib/useCountUp';

export default function StatCard({ label, value, icon, format = (v) => Math.round(v).toLocaleString(), suffix = '', accent = false, index = 0 }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative bg-surface border border-border-soft rounded-2xl p-5 overflow-hidden"
    >
      {accent && (
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ background: 'radial-gradient(circle at top right, var(--color-accent), transparent 70%)' }} />
      )}
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
        {icon && <span className="text-lg opacity-70">{icon}</span>}
      </div>
      <div className="mt-2 text-3xl font-semibold text-text tracking-tight">
        {format(animated)}{suffix}
      </div>
    </motion.div>
  );
}
