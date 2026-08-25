import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CameraIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

// A single-photo upload tile: shows the current image (or a placeholder),
// tapping it opens the file picker, and an in-progress upload shows a
// spinner overlay in place. `shape` controls circular (staff avatars) vs
// rounded-rect (shop photos) presentation.
export default function ImageUpload({ value, onUpload, onRemove, shape = 'rect', size = 'md' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const sizeClass = size === 'sm' ? 'w-16 h-16' : size === 'lg' ? 'w-full aspect-video' : 'w-24 h-24';
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets picking the same file twice still fire onChange
    if (!file) return;

    setError('');
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <div className={clsx('relative group overflow-hidden border border-border bg-surface-3', sizeClass, shapeClass)}>
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-faint">
            <CameraIcon className="w-6 h-6" />
          </div>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 text-transparent group-hover:text-white transition-all"
        >
          {uploading ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <CameraIcon className="w-5 h-5" />
          )}
        </button>

        {value && onRemove && !uploading && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
