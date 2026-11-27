import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock, MapPin, Megaphone, Ticket, Users, Video, Wallet } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatFee, formatLongDate, formatTime, relativeTime } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFollowEvent } from '../lib/useAnnouncements';
import Poster from '../components/Poster';
import { BackLink, ErrorState, PageLoader, Spinner, StatusBadge } from '../components/ui';

function RegisterPanel({ event, registration }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['event', event.id] });
    queryClient.invalidateQueries({ queryKey: ['me', 'registrations'] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const register = useMutation({
    mutationFn: () => api.post(`/api/events/${event.id}/register`, { college: user?.college ?? '' }),
    onSuccess: () => {
      toast.success('You are registered. Your QR ticket is in My tickets.', event.title);
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });
  const cancel = useMutation({
    mutationFn: () => api.del(`/api/events/${event.id}/register`),
    onSuccess: () => {
      toast.info('Registration cancelled.');
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const started = new Date(event.startsAt) <= new Date();
  const capacityPct = event.capacity > 0 ? Math.min(100, Math.round((event.registrationsCount / event.capacity) * 100)) : null;

  let action;
  if (event.status !== 'approved') {
    action = <p className="text-sm text-slate-500 dark:text-slate-400">Registration opens once an admin approves this event.</p>;
  } else if (registration) {
    action = (
      <div className="space-y-3">
        <p className="flex items-center gap-2 rounded-card bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Ticket className="h-4 w-4" aria-hidden="true" /> You&apos;re going! Ticket {registration.ticketCode}
        </p>
        <Link to="/dashboard" className="btn btn-primary w-full">
          View QR ticket
        </Link>
        {!started && !registration.attendedAt && (
          <button type="button" className="btn btn-danger w-full" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            {cancel.isPending && <Spinner className="h-4 w-4" />} Cancel registration
          </button>
        )}
      </div>
    );
  } else if (started) {
    action = <p className="text-sm text-slate-500 dark:text-slate-400">Registration has closed for this event.</p>;
  } else if (event.isFull) {
    action = <p className="text-sm font-medium text-red-700 dark:text-red-400">This event is full.</p>;
  } else if (!user) {
    action = (
      <button type="button" className="btn btn-primary w-full py-3" onClick={() => navigate(`/login?next=/events/${event.id}`)}>
        Sign in to register
      </button>
    );
  } else if (user.role !== 'student') {
    action = <p className="text-sm text-slate-500 dark:text-slate-400">Only student accounts can register for events.</p>;
  } else {
    action = (
      <button type="button" className="btn btn-primary w-full py-3" onClick={() => register.mutate()} disabled={register.isPending}>
        {register.isPending && <Spinner className="h-4 w-4" />} Register {event.fee > 0 ? `· ${formatFee(event.fee)}` : 'for free'}
      </button>
    );
  }

  return (
    <aside className="card h-fit p-5 lg:sticky lg:top-24" aria-label="Registration">
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="sr-only">Date</dt>
          <dd className="flex items-start gap-3 font-medium text-slate-900 dark:text-white">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            {formatLongDate(event.startsAt)}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Time</dt>
          <dd className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            {formatTime(event.startsAt)} – {formatTime(event.endsAt)} IST
          </dd>
        </div>
        <div>
          <dt className="sr-only">Where</dt>
          <dd className="flex items-start gap-3">
            {event.mode === 'online' ? (
              <Video className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            ) : (
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            )}
            {event.mode !== 'online' ? (
              event.venue
            ) : registration && event.meetingLink ? (
              <a className="link" href={event.meetingLink} target="_blank" rel="noreferrer">
                Join online
              </a>
            ) : (
              'Online (link shared after registering)'
            )}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Fee</dt>
          <dd className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            {formatFee(event.fee)}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Registrations</dt>
          <dd className="flex items-start gap-3">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <span className="flex-1">
              {event.registrationsCount} registered{event.capacity > 0 && ` of ${event.capacity}`}
              {capacityPct !== null && (
                <span
                  className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  role="progressbar"
                  aria-valuenow={capacityPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Seats filled"
                >
                  <span
                    className={`block h-full rounded-full ${capacityPct >= 90 ? 'bg-amber-500' : 'bg-primary-600'}`}
                    style={{ width: `${capacityPct}%` }}
                  />
                </span>
              )}
            </span>
          </dd>
        </div>
      </dl>
      <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">{action}</div>
    </aside>
  );
}

function Announcements({ eventId }) {
  const { data } = useQuery({
    queryKey: ['announcements', eventId],
    queryFn: () => api.get(`/api/events/${eventId}/announcements`),
  });
  if (!data?.items.length) return null;
  return (
    <section className="card mt-6" aria-labelledby="ann-title">
      <div className="card-header">
        <h2 id="ann-title" className="card-title flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-accent-700 dark:text-accent-400" aria-hidden="true" /> Announcements
        </h2>
        <span className="badge badge-cyan">Live</span>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.items.map((a) => (
          <li key={a.id} className="px-5 py-3 text-sm">
            <p className="text-slate-800 dark:text-slate-200">{a.message}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{relativeTime(a.createdAt)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  useFollowEvent(id);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.get(`/api/events/${id}`),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        {error instanceof ApiError && error.status === 404 ? (
          <div className="card p-10 text-center">
            <h1 className="text-2xl font-bold">Event not found</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">It may have been removed or is still awaiting approval.</p>
            <Link to="/events" className="btn btn-primary mt-6">
              Browse events
            </Link>
          </div>
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </div>
    );
  }

  const { event, registration } = data;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <BackLink to="/events">All events</BackLink>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="aspect-[16/8]">
              <Poster event={event} large />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="badge badge-indigo">{event.category}</span>
            {event.status !== 'approved' && <StatusBadge status={event.status} />}
            {event.isPast && <span className="badge badge-slate">Ended</span>}
            {event.tags.map((t) => (
              <span key={t} className="badge badge-slate">
                #{t}
              </span>
            ))}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{event.title}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Hosted by <Link to={`/events?club=${event.club._id}`} className="link">{event.club.name}</Link>
          </p>
          <div className="mt-6 max-w-none text-base leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300">
            {event.description}
          </div>
          <Announcements eventId={event.id} />
        </div>
        <RegisterPanel event={event} registration={registration} />
      </div>
    </div>
  );
}
