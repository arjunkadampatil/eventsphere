import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, KeyRound, ShieldCheck, Users } from 'lucide-react';
import { api, ApiError, refreshSession } from '../lib/api';
import { homeFor, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Field, PageLoader, Spinner } from '../components/ui';

const DEMO = [
  { role: 'Student', email: 'student@eventsphere.dev', icon: GraduationCap, blurb: 'Tickets, QR & certificates' },
  { role: 'Club', email: 'club@eventsphere.dev', icon: Users, blurb: 'Create events, scan attendees' },
  { role: 'Admin', email: 'admin@eventsphere.dev', icon: ShieldCheck, blurb: 'Approvals & analytics' },
];
const DEMO_PASSWORD = 'Demo@1234';

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
      {children}
    </div>
  );
}

function GoogleButton() {
  const { data } = useQuery({ queryKey: ['providers'], queryFn: () => api.get('/api/auth/providers'), staleTime: Infinity });
  if (!data?.google) return null;
  return (
    <>
      <a href={`${import.meta.env.VITE_API_URL ?? ''}/api/auth/google`} className="btn btn-secondary mt-6 w-full py-3">
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
        Continue with Google
      </a>
      <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>
    </>
  );
}

export function Login() {
  const { login, user, status } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  if (status === 'authenticated' && user) return <Navigate to={params.get('next') || homeFor(user.role)} replace />;

  async function submit(email, password, key) {
    setBusy(key);
    setError('');
    try {
      const signedIn = await login(email, password);
      navigate(params.get('next') || homeFor(signedIn.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Is the API running?');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle={
        <>
          New here?{' '}
          <Link to="/signup" className="link">
            Create a student account
          </Link>
        </>
      }
    >
      {params.get('error') === 'google' && (
        <p className="mt-4 rounded-card bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Google sign-in was cancelled or failed.
        </p>
      )}

      <section
        className="mt-6 rounded-card border border-primary-200 bg-primary-50/60 p-4 dark:border-primary-500/30 dark:bg-primary-500/5"
        aria-labelledby="demo-title"
      >
        <h2 id="demo-title" className="flex items-center gap-2 text-sm font-semibold text-primary-800 dark:text-primary-300">
          <KeyRound className="h-4 w-4" aria-hidden="true" /> Try a demo account
        </h2>
        <p className="mt-1 text-xs text-primary-800 dark:text-primary-300">
          One click signs you in. Password for all: <code className="rounded bg-white px-1.5 py-0.5 font-mono dark:bg-slate-900">{DEMO_PASSWORD}</code>
        </p>
        <div className="mt-3 grid gap-2">
          {DEMO.map(({ role, email, icon: Icon, blurb }) => (
            <button
              key={role}
              type="button"
              disabled={busy !== null}
              onClick={() => submit(email, DEMO_PASSWORD, role)}
              className="flex items-center gap-3 rounded-card border border-primary-200 bg-white px-3 py-2.5 text-left text-sm transition hover:border-primary-400 hover:shadow-soft disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-500"
            >
              <Icon className="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              <span className="flex-1">
                <span className="block font-semibold text-slate-900 dark:text-white">{role}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono">{email}</span> · {blurb}
                </span>
              </span>
              {busy === role && <Spinner className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </section>

      <GoogleButton />

      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit(form.email, form.password, 'form');
        }}
      >
        {error && (
          <p className="rounded-card bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
            {error}
          </p>
        )}
        <Field label="Email">
          {({ id }) => (
            <input
              id={id}
              type="email"
              autoComplete="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          )}
        </Field>
        <Field label="Password">
          {({ id }) => (
            <input
              id={id}
              type="password"
              autoComplete="current-password"
              required
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="link text-sm">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className="btn btn-primary w-full py-3" disabled={busy !== null}>
          {busy === 'form' && <Spinner className="h-4 w-4" />} Sign in
        </button>
      </form>
    </AuthShell>
  );
}

export function Signup() {
  const { register, user, status } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', college: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated' && user) return <Navigate to={homeFor(user.role)} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await register(form);
      toast.success('Welcome to EventSphere! Find something fun to join.');
      navigate('/events', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setErrors({ ...err.fieldErrors(), form: err.details ? '' : err.message });
      else setErrors({ form: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        <>
          Already registered?{' '}
          <Link to="/login" className="link">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton />
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {errors.form && (
          <p className="rounded-card bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
            {errors.form}
          </p>
        )}
        <Field label="Full name" error={errors.name}>
          {({ id, invalid }) => <input id={id} className="input" autoComplete="name" aria-invalid={invalid} value={form.name} onChange={set('name')} />}
        </Field>
        <Field label="Email" error={errors.email}>
          {({ id, invalid }) => (
            <input id={id} type="email" className="input" autoComplete="email" aria-invalid={invalid} value={form.email} onChange={set('email')} />
          )}
        </Field>
        <Field label="College (optional)" error={errors.college}>
          {({ id }) => <input id={id} className="input" autoComplete="organization" value={form.college} onChange={set('college')} />}
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
          {({ id, invalid }) => (
            <input
              id={id}
              type="password"
              className="input"
              autoComplete="new-password"
              aria-invalid={invalid}
              value={form.password}
              onChange={set('password')}
            />
          )}
        </Field>
        <button type="submit" className="btn btn-primary w-full py-3" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />} Create account
        </button>
      </form>
    </AuthShell>
  );
}

// Google OAuth lands here after the server has set the refresh cookie.
export function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    refreshSession().then((session) =>
      navigate(session ? homeFor(session.user.role) : '/login?error=google', { replace: true }),
    );
  }, [navigate]);
  return <PageLoader label="Signing you in…" />;
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link that works for one hour.">
      {done ? (
        <p className="mt-6 rounded-card bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" role="status">
          {done}
        </p>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              setDone((await api.post('/api/auth/forgot-password', { email })).message);
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Email" error={error}>
            {({ id }) => <input id={id} type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <button className="btn btn-primary w-full py-3" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Send reset link
          </button>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link to="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell title="Choose a new password">
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api.post('/api/auth/reset-password', { token: params.get('token') ?? '', password });
            toast.success('Password updated. Sign in with your new password.');
            navigate('/login', { replace: true });
          } catch (err) {
            setError(err instanceof ApiError ? err.fieldErrors().password || err.message : err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="New password" error={error} hint="At least 8 characters, with a letter and a number.">
          {({ id, invalid }) => (
            <input
              id={id}
              type="password"
              autoComplete="new-password"
              className="input"
              aria-invalid={invalid}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <button className="btn btn-primary w-full py-3" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />} Update password
        </button>
      </form>
    </AuthShell>
  );
}
