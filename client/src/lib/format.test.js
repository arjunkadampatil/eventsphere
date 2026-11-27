import { describe, expect, it, vi } from 'vitest';
import { formatFee, formatRange, relativeTime, toLocalInput } from './format';
import { ApiError, qs } from './api';

describe('format helpers', () => {
  it('formats fees in rupees', () => {
    expect(formatFee(0)).toBe('Free');
    expect(formatFee(1500)).toBe('₹1,500');
  });

  it('collapses same-day ranges into one date', () => {
    const s = '2026-12-01T12:30:00Z'; // 6:00 PM IST
    const e = '2026-12-01T14:30:00Z';
    expect(formatRange(s, e)).toMatch(/1 Dec · 6:00 PM – 8:00 PM/);
  });

  it('describes relative times', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-01T12:00:00Z'));
    expect(relativeTime('2026-12-01T11:00:00Z')).toBe('1 hour ago');
    expect(relativeTime('2026-12-03T12:00:00Z')).toBe('in 2 days');
    expect(relativeTime('2026-12-01T11:59:50Z')).toBe('10 seconds ago');
    vi.useRealTimers();
  });

  it('produces datetime-local values', () => {
    expect(toLocalInput('')).toBe('');
    expect(toLocalInput(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });
});

describe('api helpers', () => {
  it('builds query strings without empty values', () => {
    expect(qs({ q: 'rust', category: '', page: 2, club: undefined })).toBe('?q=rust&page=2');
    expect(qs({})).toBe('');
  });

  it('maps validation details to field errors', () => {
    const err = new ApiError(400, 'Validation failed.', [
      { path: 'email', message: 'Enter a valid email address.' },
      { path: 'email', message: 'second message is ignored' },
      { path: 'password', message: 'Too short' },
    ]);
    expect(err.fieldErrors()).toEqual({ email: 'Enter a valid email address.', password: 'Too short' });
  });
});
