import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, CheckCircle2, ClipboardCheck, GraduationCap, Percent, Ticket, Users, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, formatTime } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Spinner, StatCard } from '../../components/ui';

function usePalette() {
  const read = () => document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark
    ? { primary: '#7B83F6', accent: '#06AFCC', grid: 'rgba(148,163,184,.14)', text: '#94A3B8', tooltipBg: '#1E293B' }
    : { primary: '#4F46E5', accent: '#0891B2', grid: 'rgba(15,23,42,.07)', text: '#64748B', tooltipBg: '#0F172A' };
}

const monthLabel = (key) =>
  new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(`${key}-01T00:00:00Z`));

function ChartCard({ title, subtitle, children, table }) {
  return (
    <section className="card" aria-label={title}>
      <div className="card-header">
        <div>
          <h2 className="card-title">{title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="px-2 pt-4 pb-2 sm:px-4">
        <div className="h-64">{children}</div>
        <details className="px-2 text-sm">
          <summary className="cursor-pointer py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400">View as table</summary>
          {table}
        </details>
      </div>
    </section>
  );
}

function RejectDialog({ event, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const reject = useMutation({
    mutationFn: () => api.patch(`/api/events/${event.id}/status`, { status: 'rejected', reason }),
    onSuccess: () => {
      toast.info(`"${event.title}" rejected. The club can edit and resubmit.`);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });
  return (
    <Modal open={Boolean(event)} onClose={onClose} title="Reject event">
      {event && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            reject.mutate();
          }}
        >
          <p className="text-sm">
            Tell <strong>{event.club?.name}</strong> why &quot;{event.title}&quot; can&apos;t be published. They&apos;ll see this on their dashboard.
          </p>
          <Field label="Reason">
            {({ id }) => <textarea id={id} rows={3} className="input" required value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={!reason.trim() || reject.isPending}>
              {reject.isPending && <Spinner className="h-4 w-4" />} Reject
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ApprovalQueue() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(null);
  const pending = useQuery({ queryKey: ['admin', 'pending'], queryFn: () => api.get('/api/events/manage?status=pending&limit=50') });
  const approve = useMutation({
    mutationFn: (event) => api.patch(`/api/events/${event.id}/status`, { status: 'approved' }),
    onSuccess: (_d, event) => {
      toast.success(`"${event.title}" is now live.`);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <section className="card" aria-labelledby="queue-title">
      <div className="card-header">
        <h2 id="queue-title" className="card-title">
          Awaiting approval
        </h2>
        {pending.data && <span className="badge badge-amber">{pending.data.total}</span>}
      </div>
      {pending.isLoading ? (
        <div className="space-y-3 p-5">
          <div className="skeleton h-12" />
          <div className="skeleton h-12" />
        </div>
      ) : pending.data?.items.length ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {pending.data.items.map((e) => (
            <li key={e.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Link to={`/club/events/${e.id}`} className="font-medium text-slate-900 hover:text-primary-600 dark:text-white">
                  {e.title}
                </Link>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {e.club?.name} · {e.category} · {formatDate(e.startsAt)}, {formatTime(e.startsAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRejecting(e)}>
                  <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => approve.mutate(e)}
                  disabled={approve.isPending && approve.variables?.id === e.id}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={ClipboardCheck} title="Queue is clear" text="New club submissions will appear here." />
      )}
      <RejectDialog event={rejecting} onClose={() => setRejecting(null)} />
    </section>
  );
}

export default function AdminDashboard() {
  const colors = usePalette();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => api.get('/api/admin/analytics'),
  });

  if (isLoading) return <PageLoader />;
  if (isError) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState error={error} onRetry={refetch} /></div>;

  const { kpis, registrationsByMonth, eventsByCategory, topEvents } = data;
  const months = registrationsByMonth.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const axis = { stroke: colors.text, fontSize: 12, tickLine: false, axisLine: false };
  const tooltip = {
    contentStyle: { background: colors.tooltipBg, border: 'none', borderRadius: 8, color: '#F8FAFC', fontSize: 12 },
    labelStyle: { color: '#F8FAFC', fontWeight: 600 },
    itemStyle: { color: '#E2E8F0' },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Admin dashboard" subtitle="Approve events and keep an eye on campus engagement." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={kpis.students} hint={`${kpis.clubs} clubs`} icon={GraduationCap} />
        <StatCard label="Live events" value={kpis.approvedEvents} hint={`${kpis.pendingEvents} pending`} icon={CalendarCheck} />
        <StatCard label="Registrations" value={kpis.registrations.toLocaleString('en-IN')} hint={`₹${kpis.revenue.toLocaleString('en-IN')} in fees`} icon={Ticket} />
        <StatCard label="Attendance rate" value={`${kpis.attendanceRate}%`} hint="Past events: checked in ÷ registered" icon={Percent} />
      </div>

      <div className="mt-8">
        <ApprovalQueue />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Registrations by month"
          subtitle="Last 6 months · registered vs checked in"
          table={
            <table className="table mb-3">
              <thead>
                <tr><th scope="col">Month</th><th scope="col" className="text-right">Registered</th><th scope="col" className="text-right">Checked in</th></tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}><td>{m.label}</td><td className="text-right tabular-nums">{m.registrations}</td><td className="text-right tabular-nums">{m.attended}</td></tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer>
            <AreaChart data={months} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="label" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tooltip} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: colors.text }} />
              <Area type="monotone" dataKey="registrations" name="Registered" stroke={colors.primary} fill={colors.primary} fillOpacity={0.12} strokeWidth={2} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="attended" name="Checked in" stroke={colors.accent} fill={colors.accent} fillOpacity={0.12} strokeWidth={2} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Registrations by category"
          subtitle="Approved events"
          table={
            <table className="table mb-3">
              <thead>
                <tr><th scope="col">Category</th><th scope="col" className="text-right">Events</th><th scope="col" className="text-right">Registrations</th></tr>
              </thead>
              <tbody>
                {eventsByCategory.map((c) => (
                  <tr key={c.category}><td>{c.category}</td><td className="text-right tabular-nums">{c.events}</td><td className="text-right tabular-nums">{c.registrations}</td></tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer>
            <BarChart data={eventsByCategory} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={colors.grid} />
              <XAxis type="number" allowDecimals={false} {...axis} />
              <YAxis type="category" dataKey="category" width={80} {...axis} />
              <Tooltip {...tooltip} cursor={{ fill: colors.grid }} />
              <Bar dataKey="registrations" name="Registrations" fill={colors.primary} radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="card mt-8" aria-labelledby="top-title">
        <div className="card-header">
          <h2 id="top-title" className="card-title">
            Most popular events
          </h2>
          <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col" className="hidden sm:table-cell">Club</th>
                <th scope="col" className="text-right">Registered</th>
                <th scope="col" className="text-right">Checked in</th>
              </tr>
            </thead>
            <tbody>
              {topEvents.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/club/events/${e.id}`} className="font-medium text-slate-900 hover:text-primary-600 dark:text-white">
                      {e.title}
                    </Link>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{formatDate(e.startsAt)}</span>
                  </td>
                  <td className="hidden text-slate-600 sm:table-cell dark:text-slate-400">{e.club}</td>
                  <td className="text-right tabular-nums">
                    {e.registrations}
                    {e.capacity > 0 && <span className="text-slate-400">/{e.capacity}</span>}
                  </td>
                  <td className="text-right tabular-nums">{e.attended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
