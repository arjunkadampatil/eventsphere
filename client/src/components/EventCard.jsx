import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Users, Video } from 'lucide-react';
import Poster from './Poster';
import { formatDate, formatTime, formatFee } from '../lib/format';

export default function EventCard({ event, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  const seatsLeft = event.capacity > 0 ? Math.max(event.capacity - event.registrationsCount, 0) : null;
  return (
    <article className="card group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative aspect-[16/9] overflow-hidden">
        <Poster event={event} className="transition duration-300 group-hover:scale-[1.03]" />
        <span className="badge badge-slate absolute top-3 left-3 bg-white/90 text-slate-800 ring-0 backdrop-blur dark:bg-slate-900/80 dark:text-slate-100">
          {event.category}
        </span>
        <span className="badge absolute top-3 right-3 bg-white/90 font-semibold text-slate-900 ring-0 backdrop-blur dark:bg-slate-900/80 dark:text-white">
          {formatFee(event.fee)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium text-primary-700 dark:text-primary-300">{event.club?.name}</p>
        <Heading className="mt-1 line-clamp-2 text-lg leading-snug font-semibold">
          <Link to={`/events/${event.id}`} className="after:absolute after:inset-0 focus:outline-none">
            <span className="relative">{event.title}</span>
          </Link>
        </Heading>
        <dl className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          <div>
            <dt className="sr-only">When</dt>
            <dd className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              {formatDate(event.startsAt)} · {formatTime(event.startsAt)}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Where</dt>
            <dd className="flex items-center gap-2">
              {event.mode === 'online' ? (
                <Video className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{event.mode === 'online' ? 'Online' : event.venue}</span>
            </dd>
          </div>
        </dl>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {event.registrationsCount} going
          </span>
          {event.isFull ? (
            <span className="badge badge-red">Full</span>
          ) : seatsLeft !== null && seatsLeft <= 15 ? (
            <span className="badge badge-amber">{seatsLeft} seats left</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[16/9] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-5 w-4/5" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
      </div>
    </div>
  );
}
