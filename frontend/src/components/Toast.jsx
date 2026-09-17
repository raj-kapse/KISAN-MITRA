/**
 * Toast — tiny dependency-free notification host
 *
 * App mounts <ToastHost /> once; any component can push a toast via
 * showToast({ message, tone }) imported from this module (a module-level
 * listener set — no context plumbing, no dependencies).
 *
 * Renders bottom-center above the bottom nav, auto-dismisses after 3.5s,
 * and never causes layout shift (fixed positioning).
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import './Toast.css';

const listeners = new Set();
let nextId = 1;

/**
 * Push a toast. `message` must already be localized by the caller
 * (components own their { en, hi, mr } strings).
 * @param {{ message: string, tone?: 'success'|'warning'|'info' }} toast
 */
export function showToast({ message, tone = 'success' }) {
  const toast = { id: nextId++, message, tone };
  listeners.forEach((fn) => fn(toast));
}

export function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onToast = (toast) => {
      setToasts((prev) => [...prev.slice(-2), toast]); // max 3 visible
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3500);
    };
    listeners.add(onToast);
    return () => listeners.delete(onToast);
  }, []);

  if (toasts.length === 0) return null;

  const Icon = { success: CheckCircle2, warning: AlertTriangle, info: Info };

  return (
    <div className="toast-host no-print" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const ToneIcon = Icon[toast.tone] || Info;
        return (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <ToneIcon size={18} aria-hidden="true" />
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
