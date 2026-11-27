import { CATEGORY_STYLE } from '../lib/categories';
import { assetUrl } from '../lib/api';

export default function Poster({ event, className = '', large = false }) {
  const [gradient, Icon] = CATEGORY_STYLE[event.category] ?? CATEGORY_STYLE.Other;
  if (event.posterUrl) {
    return (
      <img
        src={assetUrl(event.posterUrl)}
        alt={`Poster for ${event.title}`}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`relative flex h-full w-full items-end overflow-hidden bg-linear-to-br ${gradient} ${className}`}
      role="img"
      aria-label={`${event.category} event: ${event.title}`}
    >
      <Icon
        className={`absolute text-white/15 ${large ? '-top-6 -right-6 h-56 w-56' : '-top-3 -right-3 h-28 w-28'}`}
        aria-hidden="true"
      />
      <span
        className={`relative p-4 font-display font-bold text-white drop-shadow-sm ${large ? 'text-2xl sm:text-3xl' : 'text-base'} line-clamp-2`}
        aria-hidden="true"
      >
        {event.title}
      </span>
    </div>
  );
}
