import { DateRangeOption } from '../types/telemetry';

export const SUPPORTED_DATE_RANGES: readonly DateRangeOption[] = [
  '15m',
  '1h',
  '24h',
  '7d',
  '30d',
  'ALL'
] as const;

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Calculates the lower timestamp bound (in ms) relative to reference time (defaults to Date.now()).
 * For 'ALL', returns null (unbounded query).
 */
export function calculateLowerBoundMs(range: DateRangeOption, relativeTo: number = Date.now()): number | null {
  switch (range) {
    case '15m':
      return relativeTo - 15 * 60 * 1000;
    case '1h':
      return relativeTo - 60 * 60 * 1000;
    case '24h':
      return relativeTo - 24 * 60 * 60 * 1000;
    case '7d':
      return relativeTo - SEVEN_DAYS_MS;
    case '30d':
      return relativeTo - THIRTY_DAYS_MS;
    case 'ALL':
      return null;
    default:
      return null;
  }
}

/**
 * Returns true if the transaction timestamp is older than 7 days relative to the reference time.
 */
export function isOlderThan7Days(timestamp: string | number, relativeTo: number = Date.now()): boolean {
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(time)) return false;
  return relativeTo - time > SEVEN_DAYS_MS;
}

/**
 * Checks whether an array of records contains zero transactions older than 7 days.
 */
export function hasZeroTransactionsOlderThan7Days<T extends { timestamp?: string; lastHeartbeat?: string; startedAt?: string }>(
  items: T[],
  relativeTo: number = Date.now()
): boolean {
  if (!items || items.length === 0) return true;
  return !items.some((item) => {
    const ts = item.timestamp || item.lastHeartbeat || item.startedAt;
    return ts ? isOlderThan7Days(ts, relativeTo) : false;
  });
}
