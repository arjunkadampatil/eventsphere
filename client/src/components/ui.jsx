import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-slate-500" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-4 font-display font-semibold text-slate-900 dark:text-white">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center" role="alert">
      <p className="font-display font-semibold text-slate-900 dark:text-white">Something went wrong</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{error?.message ?? 'Please try again.'}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

const STATUS = {
  approved: ['badge-green', 'Approved'],
  pending: ['badge-amber', 'Pending review'],
  rejected: ['badge-red', 'Rejected'],
};
export function StatusBadge({ status }) {
  const [cls, label] = STATUS[status] ?? ['badge-slate', status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  const child = typeof children === 'function' ? children({ id, invalid: Boolean(error) }) : children;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {child}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
      </button>
      <span className="px-2 text-sm text-slate-500 tabular-nums dark:text-slate-400">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

export function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-card bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, size = 'max-w-md' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${size} rounded-card bg-white p-0 text-slate-700 shadow-lift backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm dark:bg-slate-900 dark:text-slate-300`}
      aria-labelledby="modal-title"
    >
      {open && (
        <div>
          <div className="card-header">
            <h2 id="modal-title" className="card-title">
              {title}
            </h2>
            <button type="button" className="btn btn-ghost -mr-2 p-2" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="link mb-4 inline-flex items-center gap-1 text-sm">
      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {children}
    </Link>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-600 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
