import React from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export function Button({ variant = 'primary', className, children, ...props }) {
  const variants = {
    primary: 'bg-accent text-black hover:bg-accent-hover shadow-lg shadow-accent/20',
    ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-surface-3 border border-border',
    danger: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30',
    subtle: 'bg-surface-3 text-text hover:bg-border border border-border',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium px-4 py-2.5 transition-colors disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="text-text-muted font-medium">{label}</span>}
      {children}
      {hint && <span className="text-xs text-text-faint">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={clsx(
        'w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all',
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={clsx(
        'w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none',
        className
      )}
      {...props}
    />
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <span
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-surface-3 border border-border'
        )}
      >
        <motion.span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </span>
      {label && <span className="text-sm text-text">{label}</span>}
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={clsx('bg-surface border border-border-soft rounded-2xl', className)} {...props}>
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="text-4xl mb-3 opacity-60">{icon}</div>}
      <p className="text-text font-medium mb-1">{title}</p>
      {description && <p className="text-sm text-text-muted max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
