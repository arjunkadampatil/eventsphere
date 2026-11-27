import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, Megaphone, X } from 'lucide-react';

const ToastContext = createContext(null);
let nextId = 1;

const STYLES = {
  success: ['text-emerald-600 dark:text-emerald-400', CheckCircle2],
  error: ['text-red-600 dark:text-red-400', AlertCircle],
  info: ['text-primary-600 dark:text-primary-400', Info],
  announcement: ['text-accent-700 dark:text-accent-400', Megaphone],
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind, message, title) => {
      const id = nextId++;
      setToasts((all) => [...all.slice(-3), { id, kind, message, title }]);
      setTimeout(() => dismiss(id), kind === 'announcement' ? 9000 : 5000);
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      success: (m, t) => push('success', m, t),
      error: (m, t) => push('error', m, t),
      info: (m, t) => push('info', m, t),
      announcement: (m, t) => push('announcement', m, t),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const [color, Icon] = STYLES[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-lift dark:border-slate-700 dark:bg-slate-900"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden="true" />
              <div className="flex-1 text-sm">
                {t.title && <p className="font-semibold text-slate-900 dark:text-white">{t.title}</p>}
                <p className="text-slate-700 dark:text-slate-200">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-m-1 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
