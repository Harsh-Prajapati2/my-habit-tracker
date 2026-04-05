import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, RotateCcw, X } from 'lucide-react';

// Toast types and their styles
const TOAST_STYLES = {
  success: {
    container: 'toast-success',
    icon: 'text-[var(--success)]',
    Icon: CheckCircle2,
  },
  error: {
    container: 'toast-error',
    icon: 'text-[var(--error)]',
    Icon: AlertCircle,
  },
  info: {
    container: 'toast-info',
    icon: 'text-[var(--info)]',
    Icon: Info,
  },
};

// Individual toast component
function Toast({ id, type = 'info', title, message, onClose, onUndo, duration = 3000 }) {
  const [isLeaving, setIsLeaving] = useState(false);
  const styles = TOAST_STYLES[type] || TOAST_STYLES.info;
  const { Icon } = styles;

  const handleClose = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => onClose(id), 200);
  }, [id, onClose]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(handleClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, handleClose]);

  return (
    <div
      className={`
        toast pointer-events-auto flex w-full max-w-sm items-start gap-3 p-4
        transition-all duration-200
        ${styles.container}
        ${isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      role="alert"
    >
      <div className={`mt-0.5 flex-shrink-0 ${styles.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        {message && (
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{message}</p>
        )}
        
        {onUndo && (
          <button
            onClick={() => {
              onUndo();
              handleClose();
            }}
            className="mt-2 btn btn-ghost btn-sm"
          >
            <RotateCcw className="h-3 w-3" />
            Undo
          </button>
        )}
      </div>
      
      <button
        onClick={handleClose}
        className="flex-shrink-0 rounded-md p-1 text-[var(--text-tertiary)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Toast container component
export function ToastContainer({ toasts, onClose, onUndo }) {
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={onClose}
          onUndo={toast.undoAction ? () => onUndo(toast) : null}
        />
      ))}
    </div>
  );
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((type, title, message = '', options = {}) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      type,
      title,
      message,
      duration: options.duration ?? 3000,
      undoAction: options.undoAction,
    };
    
    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const close = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleUndo = useCallback((toast) => {
    if (toast.undoAction) {
      toast.undoAction();
    }
  }, []);

  const success = useCallback((title, message, options) => show('success', title, message, options), [show]);
  const error = useCallback((title, message, options) => show('error', title, message, options), [show]);
  const info = useCallback((title, message, options) => show('info', title, message, options), [show]);

  return {
    toasts,
    show,
    close,
    success,
    error,
    info,
    handleUndo,
    ToastContainer: () => <ToastContainer toasts={toasts} onClose={close} onUndo={handleUndo} />,
  };
}

export default Toast;
