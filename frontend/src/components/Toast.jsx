/**
 * Toast — tiny dependency-free notification host
 *
 * App mounts <ToastHost /> once; any component can push a toast via
 * showToast({ message, tone }) imported from ../utils/toast.
 *
 * Renders bottom-center above the bottom nav, auto-dismisses after 3.5s,
 * and never causes layout shift (fixed positioning).
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { subscribeToasts } from '../utils/toast';
import './Toast.css';

export function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToasts((toast) => {
      setToasts((prev) => [...prev.slice(-2), toast]); // max 3 visible
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3500);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host no-print" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          {toast.tone === 'success' ? (
            <CheckCircle2 size={18} aria-hidden="true" />
          ) : toast.tone === 'warning' ? (
            <AlertTriangle size={18} aria-hidden="true" />
          ) : (
            <Info size={18} aria-hidden="true" />
          )}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

export default ToastHost;
