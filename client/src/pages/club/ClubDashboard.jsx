import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, ClipboardList, Pencil, ScanLine, Ticket, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, formatTime } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, ErrorState, PageHeader, PageLoader, StatCard, StatusBadge } from '../../components/ui';

export default function ClubDashboard() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['manage-events'],
    queryFn: () => api.get('/api/events/manage?limit=100'),
  });

  if (isLoading) return <PageLoader />;
  if (isError) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState error={error} onRetry={refetch} /></div>;

  const events = data.items;
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.endsAt) >= now && e.status === 'approved');
  const registrations = events.reduce((n, e) => n + e.registrationsCount, 0);
  const pastWithRegs = events.filter((e) => new Date(e.endsAt) < now && e.registrationsCount > 0);
  const attendance = pastWithRegs.length
    ? Math.round(
        (pastWithRegs.reduce((n, e) => n + e.attendedCount, 0) / pastWithRegs.reduce((n, e) => n + e.registrationsCount, 0)) * 100,
      )
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        title={user.name}
        subtitle="Create events, track registrations and check people in."
        actions={
          <>
            <Link to="/scan" className="btn btn-secondary">
              <ScanLine className="h-4 w-4" aria-hidden="true" /> Scanner
            </Link>
            <Link to="/club/events/new" className="btn btn-primary">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" /> New event
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Events" value={events.length} hint={`${events.filter((e) => e.status === 'pending').length} awaiting approval`} icon={ClipboardList} />
        <StatCard label="Upcoming" value={upcoming.length} icon={CalendarPlus} />
        <StatCard label="Registrations" value={registrations} icon={Ticket} />
        <StatCard label="Attendance rate" value={`${attendance}%`} hint="Across past events" icon={Users} />
      </div>

      <section className="card mt-8" aria-labelledby="events-title">
        <div className="card-header">
          <h2 id="events-title" className="card-title">
            Your events
          </h2>
        </div>
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="No events yet"
            text="Create your first event. It goes live as soon as an admin approves it."
            action={
              <Link to="/club/events/new" className="btn btn-primary">
                Create event
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col" className="hidden md:table-cell">
                    When
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Registered
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="min-w-48">
                      <Link to={`/club/events/${e.id}`} className="font-medium text-slate-900 hover:text-primary-600 dark:text-white">
                        {e.title}
                      </Link>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{e.category}</span>
                      {e.status === 'rejected' && e.rejectionReason && (
                        <span className="mt-1 block text-xs text-red-700 dark:text-red-400">Admin: {e.rejectionReason}</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap md:table-cell">
                      {formatDate(e.startsAt)}
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{formatTime(e.startsAt)}</span>
                    </td>
                    <td>
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="text-right tabular-nums">
                      {e.registrationsCount}
                      {e.capacity > 0 && <span className="text-slate-400">/{e.capacity}</span>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <Link to={`/club/events/${e.id}/edit`} className="btn btn-ghost btn-sm" aria-label={`Edit ${e.title}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <Link to={`/club/events/${e.id}`} className="btn btn-secondary btn-sm">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
