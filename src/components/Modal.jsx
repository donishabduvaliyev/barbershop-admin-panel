import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-md' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`w-full ${maxWidth} max-h-[85vh] flex flex-col bg-surface-2 border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden`}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="px-6 pt-5 pb-4 border-b border-border-soft flex items-center justify-between shrink-0">
                <h3 className="text-base font-semibold text-text">{title}</h3>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
                >
                  ×
                </button>
              </div>
            )}
            {/* Only this middle section scrolls — a tall form (e.g. Staff's
                edit modal) never pushes the footer's Save/Cancel buttons
                out of reach on a short viewport. */}
            <div className="px-6 py-5 overflow-y-auto">{children}</div>
            {footer && <div className="px-6 py-4 border-t border-border-soft flex justify-end gap-2 shrink-0">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
