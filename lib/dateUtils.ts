/**
 * Local-timezone calendar date utilities (`YYYY-MM-DD`).
 * Prevents midnight UTC drift (e.g. 00:30 in Kyiv UTC+2/+3 logging onto yesterday's UTC date)
 * and prevents `new Date('YYYY-MM-DD')` UTC-midnight shifts (-1 day in Americas UTC-5..-8).
 */

export function toLocalDateKey(input?: Date | string | number | null): string {
  const d =
    input instanceof Date
      ? input
      : typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())
        ? parseLocalDateKey(input.trim())
        : input !== undefined && input !== null
          ? new Date(input)
          : new Date();

  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = safe.getFullYear();
  const month = String(safe.getMonth() + 1).padStart(2, '0');
  const day = String(safe.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(value: string): Date {
  const trimmed = (value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    // Use local noon (12:00) so DST transitions never shift the calendar date
    return new Date(year, month, day, 12, 0, 0, 0);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function isSameLocalDay(
  a?: Date | string | number | null,
  b?: Date | string | number | null
): boolean {
  if (!a || !b) return false;
  return toLocalDateKey(a) === toLocalDateKey(b);
}
