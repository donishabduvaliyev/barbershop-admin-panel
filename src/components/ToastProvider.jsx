import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);

const VARIANT_STYLES = {
  success: { icon: '✓', color: 'var(--color-success)' },
  error: { icon: '✕', color: 'var(--color-danger)' },
  info: { icon: 'i', color: 'var(--color-info)' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, variant = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end">
        <AnimatePresence>
          {toasts.map((toast) => {
            const style = VARIANT_STYLES[toast.variant] || VARIANT_STYLES.info;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 24, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => dismiss(toast.id)}
                className="flex items-center gap-3 bg-surface-2 border border-border text-text text-sm rounded-xl shadow-2xl shadow-black/40 pl-3 pr-4 py-3 min-w-[220px] max-w-sm cursor-pointer backdrop-blur-xl"
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{ background: `color-mix(in srgb, ${style.color} 18%, transparent)`, color: style.color }}
                >
                  {style.icon}
                </span>
                <span className="leading-snug">{toast.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
