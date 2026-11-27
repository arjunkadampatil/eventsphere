import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Award, CalendarDays, MapPin, Megaphone, QrCode, Ticket } from 'lucide-react';
import { api, download } from '../../lib/api';
import { dayNumber, formatLongDate, formatRange, formatTime, monthShort, relativeTime } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, Modal, PageHeader, PageLoader, Spinner, StatCard } from '../../components/ui';

function TicketModal({ ticket, onClose }) {
  const { user } = useAuth();
  return (
    <Modal open={Boolean(ticket)} onClose={onClose} title="Your ticket">
      {ticket && (
        <div className="text-center">
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">{ticket.event.title}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatRange(ticket.event.startsAt, ticket.event.endsAt)}</p>
          <div className="mx-auto mt-5 w-fit rounded-card bg-white p-4 ring-1 ring-slate-200">
            <QRCodeSVG value={ticket.ticketCode} size={208} level="M" marginSize={1} title={`QR code for ticket ${ticket.ticketCode}`} />
          </div>
          <p className="mt-4 font-mono text-lg tracking-wider text-slate-900 dark:text-white">{ticket.ticketCode}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user?.name}</p>
          {ticket.attendedAt ? (
            <p className="badge badge-green mt-4">Checked in {relativeTime(ticket.attendedAt)}</p>
          ) : (
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Show this at the entrance. Screen brightness up helps the scanner.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function TicketRow({ ticket, onShow }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const past = new Date(ticket.event.endsAt) < new Date();

  async function getCertificate() {
    setBusy(true);
    try {
      await download(`/api/me/registrations/${ticket.id}/certificate`, 'certificate.pdf');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-card bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
        <span className="text-[11px] font-semibold">{monthShort(ticket.event.startsAt)}</span>
        <span className="text-xl leading-none font-bold">{dayNumber(ticket.event.startsAt)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <Link to={`/events/${ticket.event.id}`} className="font-semibold text-slate-900 hover:text-primary-600 dark:text-white">
          {ticket.event.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {formatTime(ticket.event.startsAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {ticket.event.mode === 'online' ? 'Online' : ticket.event.venue}
          </span>
          <span>{ticket.event.club.name}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {past ? (
          ticket.certificateAvailable ? (
            <button type="button" className="btn btn-accent btn-sm" onClick={getCertificate} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Award className="h-4 w-4" aria-hidden="true" />} Certificate
            </button>
          ) : (
            <span className="badge badge-slate">{ticket.attendedAt ? 'Attended' : 'Missed'}</span>
          )
        ) : (
          <>
            {ticket.attendedAt && <span className="badge badge-green">Checked in</span>}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onShow(ticket)}>
              <QrCode className="h-4 w-4" aria-hidden="true" /> Show ticket
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('upcoming');
  const [ticket, setTicket] = useState(null);
  const regs = useQuery({ queryKey: ['me', 'registrations'], queryFn: () => api.get('/api/me/registrations') });
  const feed = useQuery({ queryKey: ['me', 'announcements'], queryFn: () => api.get('/api/me/announcements') });

  if (regs.isLoading) return <PageLoader />;
  if (regs.isError) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState error={regs.error} onRetry={regs.refetch} /></div>;

  const now = new Date();
  const items = regs.data.items;
  const upcoming = items.filter((r) => new Date(r.event.endsAt) >= now).sort((a, b) => new Date(a.event.startsAt) - new Date(b.event.startsAt));
  const past = items.filter((r) => new Date(r.event.endsAt) < now);
  const list = tab === 'upcoming' ? upcoming : past;
  const next = upcoming[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        title={`Hi ${user.name.split(' ')[0]} 👋`}
        subtitle={next ? `Next up: ${next.event.title} on ${formatLongDate(next.event.startsAt)}.` : 'Your tickets and certificates live here.'}
        actions={
          <Link to="/events" className="btn btn-primary">
            Find events
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Upcoming" value={upcoming.length} icon={Ticket} />
        <StatCard label="Attended" value={items.filter((r) => r.attendedAt).length} icon={CalendarDays} />
        <StatCard label="Certificates" value={items.filter((r) => r.certificateAvailable).length} icon={Award} />
        <StatCard label="Announcements" value={feed.data?.items.length ?? '–'} icon={Megaphone} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-labelledby="tickets-title">
          <div className="card-header">
            <h2 id="tickets-title" className="card-title">
              My tickets
            </h2>
            <div className="inline-flex rounded-card border border-slate-200 p-0.5 text-sm dark:border-slate-700" role="tablist">
              {[
                ['upcoming', `Upcoming (${upcoming.length})`],
                ['past', `Past (${past.length})`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className="rounded-[10px] px-3 py-1 font-medium text-slate-600 aria-selected:bg-primary-600 aria-selected:text-white dark:text-slate-300"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {list.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800" role="tabpanel">
              {list.map((r) => (
                <TicketRow key={r.id} ticket={r} onShow={setTicket} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Ticket}
              title={tab === 'upcoming' ? 'No upcoming events' : 'No past events yet'}
              text={tab === 'upcoming' ? 'Register for an event and your QR ticket will appear here.' : 'Certificates for events you attend show up here.'}
              action={
                tab === 'upcoming' && (
                  <Link to="/events" className="btn btn-primary">
                    Browse events
                  </Link>
                )
              }
            />
          )}
        </section>

        <section className="card h-fit" aria-labelledby="feed-title">
          <div className="card-header">
            <h2 id="feed-title" className="card-title flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-accent-700 dark:text-accent-400" aria-hidden="true" /> Announcements
            </h2>
            <span className="badge badge-cyan">Live</span>
          </div>
          {feed.isLoading ? (
            <div className="space-y-3 p-5">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ) : feed.data?.items.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {feed.data.items.map((a) => (
                <li key={a.id} className="px-5 py-3 text-sm">
                  {a.event && (
                    <Link to={`/events/${a.event.id}`} className="text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300">
                      {a.event.title}
                    </Link>
                  )}
                  <p className="mt-0.5 text-slate-800 dark:text-slate-200">{a.message}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{relativeTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Megaphone} title="All quiet" text="Clubs' updates for your events appear here in real time." />
          )}
        </section>
      </div>

      <TicketModal ticket={ticket} onClose={() => setTicket(null)} />
    </div>
  );
}
