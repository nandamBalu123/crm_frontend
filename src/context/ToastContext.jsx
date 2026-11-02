import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);
const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

/** "Validation failed" alone does not tell the user what to fix, so list the field messages. */
export function errorText(m) {
  if (typeof m === 'string') return m;
  const base = m?.message || 'Something went wrong';
  const details = (m?.details || []).filter((d) => d?.message).slice(0, 4);
  if (!details.length) return base;
  const field = (p) => String(p || '').replace(/^body\./, '').split('.').pop().replace(/_/g, ' ');
  return `${base}: ${details.map((d) => (d.path ? `${field(d.path)} — ${d.message}` : d.message)).join('; ')}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((type, message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-4), { id, type, message, title: opts.title }]);
    setTimeout(() => dismiss(id), opts.duration || (type === 'error' ? 7000 : 4000));
  }, [dismiss]);
  const api = useMemo(() => ({
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', errorText(m), o),
    info: (m, o) => push('info', m, o),
    warning: (m, o) => push('warning', m, o),
  }), [push]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`toast ${t.type}`}>
              <Icon size={18} aria-hidden />
              <div className="grow">
                {t.title && <strong>{t.title}</strong>}
                <div>{t.message}</div>
              </div>
              <button className="btn ghost sm icon" onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
