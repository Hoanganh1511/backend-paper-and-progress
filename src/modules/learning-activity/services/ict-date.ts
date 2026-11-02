/**
 * Dates of the learning calendar. A learner's day is a day in Asia/Ho_Chi_Minh,
 * which is UTC+7 all year (no daylight saving), so an instant maps to its day by
 * adding seven hours. Days travel as `YYYY-MM-DD` text, never as a Date that a
 * time zone could shift.
 */
export const TIMEZONE = 'Asia/Ho_Chi_Minh';
export const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar day an instant falls on in Asia/Ho_Chi_Minh. */
export const ictDateKey = (instant: Date): string =>
  new Date(instant.getTime() + ICT_OFFSET_MS).toISOString().slice(0, 10);

/** A `@db.Date` column value (UTC midnight) as its calendar day. */
export const dateColumnKey = (date: Date): string =>
  date.toISOString().slice(0, 10);

/** `2026-11-14T02:00:00.000Z` -> `2026-11-14T09:00:00+07:00` */
export const toIctIso = (instant: Date): string =>
  `${new Date(instant.getTime() + ICT_OFFSET_MS).toISOString().slice(0, 19)}+07:00`;

/** True for a real calendar day such as 2026-11-14 (not 2026-02-30). */
export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && dateColumnKey(date) === value;
}

export const addDays = (key: string, days: number): string =>
  dateColumnKey(
    new Date(new Date(`${key}T00:00:00.000Z`).getTime() + days * DAY_MS),
  );

export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const pad = (value: number) => String(value).padStart(2, '0');

export const monthStartKey = (year: number, month: number) =>
  `${year}-${pad(month)}-01`;

export const monthEndKey = (year: number, month: number) =>
  `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;

/** Every day key of a month, in order. */
export const monthDayKeys = (year: number, month: number): string[] =>
  Array.from(
    { length: daysInMonth(year, month) },
    (_, index) => `${year}-${pad(month)}-${pad(index + 1)}`,
  );

/**
 * The instants `[from, to)` that make up the days `firstKey` to `lastKey`
 * (inclusive) in Asia/Ho_Chi_Minh; used to read timestamped rows for those days.
 */
export function instantRange(firstKey: string, lastKey: string) {
  return {
    from: new Date(
      new Date(`${firstKey}T00:00:00.000Z`).getTime() - ICT_OFFSET_MS,
    ),
    to: new Date(
      new Date(`${lastKey}T00:00:00.000Z`).getTime() + DAY_MS - ICT_OFFSET_MS,
    ),
  };
}
