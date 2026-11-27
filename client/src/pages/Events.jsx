import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { api, qs } from '../lib/api';
import EventCard, { EventCardSkeleton } from '../components/EventCard';
import { CATEGORY_STYLE } from '../lib/categories';
import { EmptyState, ErrorState, PageHeader, Pagination } from '../components/ui';

const CATEGORIES = Object.keys(CATEGORY_STYLE);
const KEYS = ['q', 'category', 'club', 'from', 'to', 'when', 'sort', 'page'];

export default function Events() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? '']));
  const page = Number(filters.page) || 1;
  const [search, setSearch] = useState(filters.q);

  useEffect(() => setSearch(filters.q), [filters.q]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ ...changes, page: changes.page ?? '' }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== filters.q) update({ q: search.trim() });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = { ...filters, page, limit: 12 };
  const events = useQuery({
    queryKey: ['events', query],
    queryFn: () => api.get(`/api/events${qs(query)}`),
    placeholderData: keepPreviousData,
  });
  const clubs = useQuery({ queryKey: ['clubs'], queryFn: () => api.get('/api/clubs') });
  const active = ['q', 'category', 'club', 'from', 'to'].some((k) => filters[k]) || filters.when === 'past';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Events" subtitle="Find something worth showing up for." />

      <section className="card mb-8 p-4" aria-label="Filters">
        <div className="grid gap-3 md:grid-cols-12">
          <label className="relative md:col-span-4">
            <span className="sr-only">Search events</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search title, topic or venue"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="md:col-span-2">
            <span className="sr-only">Category</span>
            <select className="input" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="sr-only">Club</span>
            <select className="input" value={filters.club} onChange={(e) => update({ club: e.target.value })}>
              <option value="">All clubs</option>
              {clubs.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="sr-only">From date</span>
            <input type="date" className="input" value={filters.from} onChange={(e) => update({ from: e.target.value })} aria-label="From date" />
          </label>
          <label className="md:col-span-2">
            <span className="sr-only">To date</span>
            <input type="date" className="input" value={filters.to} onChange={(e) => update({ to: e.target.value })} aria-label="To date" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <div className="inline-flex rounded-card border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label="When">
            {[
              ['', 'Upcoming'],
              ['past', 'Past'],
              ['all', 'All'],
            ].map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={filters.when === value}
                onClick={() => update({ when: value })}
                className="rounded-[10px] px-3 py-1 font-medium text-slate-600 aria-pressed:bg-primary-600 aria-pressed:text-white dark:text-slate-300"
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Sort</span>
            <select className="input w-auto py-1.5" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="">Soonest</option>
              <option value="popular">Most popular</option>
              <option value="newest">Newly added</option>
            </select>
          </label>
          {active && (
            <button type="button" className="link ml-auto" onClick={() => setParams({}, { replace: true })}>
              Clear filters
            </button>
          )}
          {events.data && (
            <span className={`text-slate-500 dark:text-slate-400 ${active ? '' : 'ml-auto'}`} aria-live="polite">
              {events.data.total} event{events.data.total === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </section>

      {events.isError ? (
        <ErrorState error={events.error} onRetry={events.refetch} />
      ) : events.isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : events.data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={SearchX}
            title="No events match"
            text="Try a different search, widen the dates, or include past events."
            action={
              active && (
                <button type="button" className="btn btn-secondary" onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </button>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${events.isFetching ? 'opacity-70' : ''}`}>
            {events.data.items.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
          <div className="mt-10">
            <Pagination page={page} pages={events.data.pages} onChange={(p) => update({ ...filters, page: String(p) })} />
          </div>
        </>
      )}
    </div>
  );
}
