import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun, X, Github } from 'lucide-react';
import { homeFor, useAuth } from '../context/AuthContext';
import { useAnnouncementToasts } from '../lib/useAnnouncements';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="EventSphere home">
      <img src="/favicon.svg" alt="" width="36" height="36" className="h-9 w-9" />
      <span className="font-display text-lg font-bold text-slate-900 dark:text-white">EventSphere</span>
    </Link>
  );
}

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // storage may be blocked; the toggle still works for this page view
    }
    setDark(next);
  };
  return [dark, toggle];
}

export function ThemeToggle() {
  const [dark, toggle] = useTheme();
  return (
    <button type="button" onClick={toggle} className="btn btn-ghost p-2" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

const navClass = ({ isActive }) =>
  `rounded-card px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useAnnouncementToasts();

  useEffect(() => setOpen(false), [location.pathname]);

  const links = [{ to: '/events', label: 'Events' }];
  if (user?.role === 'student') links.push({ to: '/dashboard', label: 'My tickets' });
  if (user?.role === 'club') links.push({ to: '/club', label: 'Club dashboard' }, { to: '/scan', label: 'Scanner' });
  if (user?.role === 'admin') links.push({ to: '/admin', label: 'Admin' }, { to: '/scan', label: 'Scanner' });

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="btn btn-primary sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70]">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={navClass} end={l.to === '/club'}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            {user ? (
              <div className="hidden items-center gap-2 md:flex">
                <Link to={homeFor(user.role)} className="flex items-center gap-2 rounded-card px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-accent-500 text-xs font-semibold text-white">
                    {user.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>
                  <span className="max-w-32 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{user.name}</span>
                </Link>
                <button type="button" onClick={logout} className="btn btn-ghost p-2" aria-label="Sign out" title="Sign out">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/login" className="btn btn-secondary">
                  Sign in
                </Link>
                <Link to="/signup" className="btn btn-primary">
                  Sign up
                </Link>
              </div>
            )}
            <button
              type="button"
              className="btn btn-ghost p-2 md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" className="border-t border-slate-200 px-4 py-3 md:hidden dark:border-slate-800" aria-label="Mobile">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={navClass} end={l.to === '/club'}>
                  {l.label}
                </NavLink>
              ))}
              {user ? (
                <button type="button" onClick={logout} className="btn btn-secondary mt-2">
                  <LogOut className="h-4 w-4" /> Sign out ({user.name})
                </button>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link to="/login" className="btn btn-secondary">
                    Sign in
                  </Link>
                  <Link to="/signup" className="btn btn-primary">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 py-8 dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-sm text-slate-500 sm:flex-row sm:px-6 dark:text-slate-400">
          <p>© {new Date().getFullYear()} EventSphere · Demo data only.</p>
          <div className="flex items-center gap-4">
            <a href="/api/docs" className="link">
              API docs
            </a>
            <a href="https://github.com/arjunkadampatil/eventsphere" className="link inline-flex items-center gap-1">
              <Github className="h-4 w-4" aria-hidden="true" /> Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
