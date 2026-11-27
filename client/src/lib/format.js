const TZ = 'Asia/Kolkata';

const dateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
const longDateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone: TZ });

export const formatDate = (d) => dateFmt.format(new Date(d));
export const formatLongDate = (d) => longDateFmt.format(new Date(d));
export const formatTime = (d) => timeFmt.format(new Date(d)).toUpperCase();
export const monthShort = (d) => monthFmt.format(new Date(d)).toUpperCase();
export const dayNumber = (d) => dayFmt.format(new Date(d));

export function formatRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = formatDate(s) === formatDate(e);
  return sameDay
    ? `${formatDate(s)} · ${formatTime(s)} – ${formatTime(e)}`
    : `${formatDate(s)}, ${formatTime(s)} – ${formatDate(e)}, ${formatTime(e)}`;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export function relativeTime(d) {
  const seconds = Math.round((new Date(d).getTime() - Date.now()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, 'second');
}

export const formatFee = (fee) => (fee > 0 ? `₹${Number(fee).toLocaleString('en-IN')}` : 'Free');

// datetime-local inputs want "YYYY-MM-DDTHH:mm" in the user's local time.
export function toLocalInput(d) {
  if (!d) return '';
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
