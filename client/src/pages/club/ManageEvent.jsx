import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, ExternalLink, Megaphone, Pencil, ScanLine, Search, Send, Trash2, Users } from 'lucide-react';
import { api, download } from '../../lib/api';
import { formatRange, relativeTime } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BackLink, EmptyState, ErrorState, PageLoader, Spinner, StatCard, StatusBadge } from '../../components/ui';

function AnnouncementComposer({ event }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const list = useQuery({
    queryKey: ['announcements', event.id],
    queryFn: () => api.get(`/api/events/${event.id}/announcements`),
  });
  const post = useMutation({
    mutationFn: () => api.post(`/api/events/${event.id}/announcements`, { message }),
    onSuccess: () => {
      setMessage('');
      toast.success(`Sent live to ${event.registrationsCount} registered attendee${event.registrationsCount === 1 ? '' : 's'}.`);
      queryClient.invalidateQueries({ queryKey: ['announcements', event.id] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <section className="card" aria-labelledby="announce-title">
      <div className="card-header">
        <h2 id="announce-title" className="card-title flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-accent-700 dark:text-accent-400" aria-hidden="true" /> Announcements
        </h2>
      </div>
      <form
        className="space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          post.mutate();
        }}
      >
        <label htmlFor="announcement" className="sr-only">
          Announcement
        </label>
        <textarea
          id="announcement"
          rows={3}
          maxLength={1000}
          className="input"
          placeholder="Venue changed? Starting late? Everyone registered sees it instantly."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit" className="btn btn-accent w-full" disabled={post.isPending || message.trim().length < 3}>
          {post.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" aria-hidden="true" />} Send announcement
        </button>
      </form>
      {list.data?.items.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
          {list.data.items.map((a) => (
            <li key={a.id} className="px-5 py-3 text-sm">
              <p className="text-slate-800 dark:text-slate-200">{a.message}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{relativeTime(a.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ManageEvent() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const eventQ = useQuery({ queryKey: ['event', id], queryFn: () => api.get(`/api/events/${id}`) });
  const attendeesQ = useQuery({ queryKey: ['attendees', id], queryFn: () => api.get(`/api/events/${id}/attendees`) });

  const checkIn = useMutation({
    mutationFn: (ticketCode) => api.post(`/api/events/${id}/check-in`, { ticketCode }),
    onSuccess: ({ attendee }) => {
      toast.success(`${attendee.name} checked in.`);
      queryClient.invalidateQueries({ queryKey: ['attendees', id] });
    },
    onError: (err) => toast.error(err.message),
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/api/events/${id}`),
    onSuccess: () => {
      toast.info('Event deleted.');
      queryClient.invalidateQueries({ queryKey: ['manage-events'] });
      navigate(user.role === 'admin' ? '/admin' : '/club');
    },
    onError: (err) => toast.error(err.message),
  });

  const rows = useMemo(() => {
    const items = attendeesQ.data?.items ?? [];
    const q = filter.trim().toLowerCase();
    return q ? items.filter((r) => `${r.name} ${r.email} ${r.college} ${r.ticketCode}`.toLowerCase().includes(q)) : items;
  }, [attendeesQ.data, filter]);

  if (eventQ.isLoading) return <PageLoader />;
  if (eventQ.isError) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState error={eventQ.error} onRetry={eventQ.refetch} /></div>;

  const { event } = eventQ.data;
  const total = attendeesQ.data?.total ?? event.registrationsCount;
  const attended = attendeesQ.data?.attended ?? event.attendedCount;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <BackLink to={user.role === 'admin' ? '/admin' : '/club'}>Dashboard</BackLink>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} />
            <span className="badge badge-indigo">{event.category}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{event.title}</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {formatRange(event.startsAt, event.endsAt)} · {event.mode === 'online' ? 'Online' : event.venue}
          </p>
          {event.status === 'rejected' && event.rejectionReason && (
            <p className="mt-2 rounded-card bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
              Rejected: {event.rejectionReason} Edit the event to resubmit it.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {event.status === 'approved' && (
            <Link to={`/events/${event.id}`} className="btn btn-secondary">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Public page
            </Link>
          )}
          <Link to={`/club/events/${event.id}/edit`} className="btn btn-secondary">
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
          </Link>
          <Link to={`/scan?event=${event.id}`} className="btn btn-primary">
            <ScanLine className="h-4 w-4" aria-hidden="true" /> Scan tickets
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Registered" value={total} hint={event.capacity ? `of ${event.capacity} seats` : 'No seat limit'} icon={Users} />
        <StatCard label="Checked in" value={attended} hint={total ? `${Math.round((attended / total) * 100)}% of registered` : '—'} icon={Check} />
        <StatCard label="Seats left" value={event.capacity ? Math.max(event.capacity - total, 0) : '∞'} />
        <StatCard label="Fee" value={event.fee ? `₹${event.fee}` : 'Free'} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-labelledby="att-title">
          <div className="card-header flex-wrap">
            <h2 id="att-title" className="card-title">
              Attendees
            </h2>
            <div className="flex w-full gap-2 sm:w-auto">
              <label className="relative flex-1 sm:w-56">
                <span className="sr-only">Filter attendees</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input className="input py-2 pl-9" placeholder="Name, email or code" value={filter} onChange={(e) => setFilter(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={exporting || total === 0}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await download(`/api/events/${id}/attendees.csv`, 'attendees.csv');
                  } catch (err) {
                    toast.error(err.message);
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                {exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" aria-hidden="true" />} CSV
              </button>
            </div>
          </div>
          {attendeesQ.isLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-10" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Users} title={filter ? 'No matches' : 'No registrations yet'} text={filter ? 'Try another name or code.' : 'Share the event page to get sign-ups.'} />
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="table">
                <thead className="sticky top-0">
                  <tr>
                    <th scope="col">Attendee</th>
                    <th scope="col" className="hidden md:table-cell">
                      Ticket
                    </th>
                    <th scope="col" className="text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="block font-medium text-slate-900 dark:text-white">{r.name}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {r.email}
                          {r.college && ` · ${r.college}`}
                        </span>
                      </td>
                      <td className="hidden font-mono text-xs md:table-cell">{r.ticketCode}</td>
                      <td className="text-right">
                        {r.attendedAt ? (
                          <span className="badge badge-green">Checked in</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => checkIn.mutate(r.ticketCode)}
                            disabled={checkIn.isPending}
                          >
                            Check in
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <AnnouncementComposer event={event} />
          {(user.role === 'admin' || total === 0 || event.isPast) && (
            <button
              type="button"
              className="btn btn-danger w-full"
              disabled={remove.isPending}
              onClick={() => window.confirm('Delete this event permanently? Registrations and announcements are removed too.') && remove.mutate()}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
