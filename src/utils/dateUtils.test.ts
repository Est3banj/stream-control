import { describe, it, expect } from 'vitest';
import { parseDate, parseDateToMs, formatDate, toFirestoreTimestamp } from './dateUtils';
import { Timestamp } from 'firebase/firestore';

describe('dateUtils', () => {
  it('handles null, undefined, and empty string', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('   ')).toBeNull();
    expect(parseDateToMs(null)).toBeNull();
    expect(formatDate(null)).toBe('—');
    expect(toFirestoreTimestamp(null)).toBeNull();
  });

  it('parses Date instances', () => {
    const d = new Date('2026-05-15T12:00:00.000Z');
    expect(parseDate(d)).toEqual(d);
    expect(parseDateToMs(d)).toBe(d.getTime());
  });

  it('parses Firestore Timestamp and objects with seconds / _seconds / toDate', () => {
    const ts = { seconds: 1778932800, nanoseconds: 0 };
    const date = parseDate(ts);
    expect(date).toBeInstanceOf(Date);
    expect(date?.getTime()).toBe(1778932800 * 1000);

    const tsUnderscore = { _seconds: 1778932800, _nanoseconds: 0 };
    expect(parseDateToMs(tsUnderscore)).toBe(1778932800 * 1000);

    const customObj = {
      toDate: () => new Date('2026-06-01T00:00:00.000Z'),
    };
    expect(parseDateToMs(customObj)).toBe(new Date('2026-06-01T00:00:00.000Z').getTime());
  });

  it('parses numeric epoch timestamps in seconds and milliseconds', () => {
    const inSeconds = 1778932800; // 10 digits
    const inMs = 1778932800000; // 13 digits

    expect(parseDateToMs(inSeconds)).toBe(1778932800000);
    expect(parseDateToMs(inMs)).toBe(1778932800000);
  });

  it('parses ISO date strings and date strings', () => {
    const iso = '2026-07-20T18:30:00.000Z';
    expect(parseDateToMs(iso)).toBe(new Date(iso).getTime());

    const simple = '2026-07-20';
    expect(parseDate(simple)).toBeInstanceOf(Date);
  });

  it('formats dates consistently', () => {
    const iso = '2026-05-10T00:00:00.000Z';
    const formatted = formatDate(iso, 'es-CO');
    expect(formatted).not.toBe('—');
  });

  it('converts valid inputs to Firestore Timestamp', () => {
    const iso = '2026-05-10T00:00:00.000Z';
    const ts = toFirestoreTimestamp(iso);
    expect(ts).toBeDefined();
    expect(ts?.seconds).toBe(Math.floor(new Date(iso).getTime() / 1000));
  });
});
