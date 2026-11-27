import { Code2, Mic2, Trophy, Wrench, Presentation, Rocket, PartyPopper, Sparkles } from 'lucide-react';

// Category styling for events without an uploaded poster: a brand gradient plus an icon,
// so the catalogue looks designed even before clubs upload artwork.
export const CATEGORY_STYLE = {
  Tech: ['from-primary-600 to-accent-600', Code2],
  Hackathon: ['from-primary-700 to-fuchsia-600', Rocket],
  Workshop: ['from-accent-700 to-primary-600', Wrench],
  Seminar: ['from-slate-700 to-primary-600', Presentation],
  Cultural: ['from-fuchsia-600 to-orange-500', Mic2],
  Sports: ['from-emerald-600 to-accent-600', Trophy],
  Social: ['from-orange-500 to-pink-600', PartyPopper],
  Other: ['from-primary-600 to-slate-700', Sparkles],
};
