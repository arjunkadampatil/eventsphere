import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BellRing, CalendarCheck, QrCode, ScrollText, ShieldCheck, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';
import EventCard, { EventCardSkeleton } from '../components/EventCard';
import { CATEGORY_STYLE } from '../lib/categories';

const FEATURES = [
  [CalendarCheck, 'One-tap registration', 'Seats are reserved atomically, so popular events never oversell.'],
  [QrCode, 'QR tickets & door scanning', 'Every registration gets a QR ticket; clubs check people in with a phone camera.'],
  [BellRing, 'Live announcements', 'Venue changes and reminders arrive instantly over WebSockets.'],
  [ScrollText, 'Instant certificates', 'Attendees download a verified PDF certificate the moment the event ends.'],
  [ShieldCheck, 'Admin approval', 'Every event is reviewed before it goes public, with feedback when rejected.'],
  [BarChart3, 'Analytics', 'Registrations, attendance rates and category trends at a glance.'],
];

export default function Landing() {
  const featured = useQuery({
    queryKey: ['events', { sort: 'popular', limit: 6 }],
    queryFn: () => api.get('/api/events?sort=popular&limit=6'),
  });
  const clubs = useQuery({ queryKey: ['clubs'], queryFn: () => api.get('/api/clubs') });

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_75%_-10%,rgb(79_70_229/0.16),transparent),radial-gradient(40rem_24rem_at_5%_10%,rgb(6_182_212/0.14),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-3xl">
            <span className="badge badge-indigo">For students, clubs and campus admins</span>
            <h1 className="mt-5 text-4xl leading-tight font-extrabold tracking-tight sm:text-6xl">
              Every campus event,{' '}
              <span className="bg-linear-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent">one tap away.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Discover hackathons, fests and workshops, register in seconds, carry a QR ticket, and get your certificate
              the moment it&apos;s over.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/events" className="btn btn-primary px-6 py-3 text-base">
                Browse events <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/login" className="btn btn-secondary px-6 py-3 text-base">
                Try the demo
              </Link>
            </div>
          </div>
          <ul className="mt-12 flex flex-wrap gap-2" aria-label="Categories">
            {Object.entries(CATEGORY_STYLE).map(([name, [, Icon]]) => (
              <li key={name}>
                <Link
                  to={`/events?category=${name}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-300 hover:text-primary-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" /> {name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900/40" aria-labelledby="popular">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="popular" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Trending this month
              </h2>
              <p className="mt-1 text-slate-600 dark:text-slate-400">The events everyone is signing up for.</p>
            </div>
            <Link to="/events" className="link hidden text-sm sm:inline">
              See all events
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.isLoading
              ? Array.from({ length: 6 }, (_, i) => <EventCardSkeleton key={i} />)
              : featured.data?.items.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24" aria-labelledby="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="features" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Built for the whole event lifecycle
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([Icon, title, text]) => (
              <div key={title} className="card p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-card bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {clubs.data?.items.length > 0 && (
        <section className="border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900/40" aria-labelledby="clubs">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 id="clubs" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Clubs on EventSphere
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clubs.data.items.map((c) => (
                <li key={c.id}>
                  <Link to={`/events?club=${c.id}`} className="card flex h-full items-start gap-4 p-5 transition hover:shadow-lift">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-accent-500 text-sm font-bold text-white">
                      {c.name
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                    <span>
                      <span className="block font-semibold text-slate-900 dark:text-white">{c.name}</span>
                      <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">{c.bio}</span>
                      <span className="mt-2 block text-xs font-medium text-primary-700 dark:text-primary-300">
                        {c.events} event{c.events === 1 ? '' : 's'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
