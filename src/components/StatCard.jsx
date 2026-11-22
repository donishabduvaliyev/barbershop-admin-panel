import React from 'react';
import { motion } from 'framer-motion';
import { useCountUp } from '../lib/useCountUp';

export default function StatCard({ label, value, format = (v) => Math.round(v).toLocaleString(), suffix = '', index = 0 }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative bg-surface border border-border-soft rounded-2xl p-5 overflow-hidden card-bevel"
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-text-muted">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-medium text-text tracking-tight tabular-nums">
        {format(animated)}{suffix}
      </div>
    </motion.div>
  );
}
