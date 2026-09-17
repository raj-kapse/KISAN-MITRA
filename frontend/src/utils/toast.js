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

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
