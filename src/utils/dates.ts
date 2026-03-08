import { format, differenceInCalendarDays, addDays, isWithinInterval } from "date-fns";

/** March 10 2026 = Day 1 */
const ORIGIN = new Date(2026, 2, 10); // months are 0-indexed

/** Last valid journal date: December 3 2028 */
const JOURNAL_END = new Date(2028, 11, 3);

/** Reflection month starts December 4 2028 */
const REFLECTION_START = new Date(2028, 11, 4);
const REFLECTION_END = new Date(2028, 11, 31);

export const REDEMPTION_START = new Date(2028, 11, 4);  // Dec 4
export const REDEMPTION_END = new Date(2028, 11, 24);   // Dec 24
export const REFLECTION_ZONE_START = new Date(2028, 11, 25); // Dec 25
export const REFLECTION_ZONE_END = new Date(2028, 11, 31);   // Dec 31

/**
 * Returns the day number for the given date.
 * March 10 2026 → Day 1.
 */
export function getDayNumber(date: Date): number {
  return differenceInCalendarDays(date, ORIGIN) + 1;
}

/**
 * Returns the Date corresponding to a day number.
 * Day 1 → March 10 2026.
 */
export function getDateFromDayNumber(n: number): Date {
  return addDays(ORIGIN, n - 1);
}

/**
 * True if the date falls within the 1000-day journal window
 * (March 10 2026 – December 3 2028, inclusive).
 */
export function isValidJournalDate(date: Date): boolean {
  return isWithinInterval(date, { start: ORIGIN, end: JOURNAL_END });
}

/**
 * True if the date falls in December 2028 (the reflection month).
 */
export function isReflectionMonth(date: Date): boolean {
  return isWithinInterval(date, { start: REFLECTION_START, end: REFLECTION_END });
}

/**
 * Formats a date as a day header string.
 * e.g. "Day 47 · April 22, 2026"
 */
export function formatDayHeader(date: Date): string {
  const day = getDayNumber(date);
  const formatted = format(date, "MMMM d, yyyy");
  return `Day ${day} · ${formatted}`;
}

/**
 * Returns today's date as an ISO date string "YYYY-MM-DD".
 */
export function getTodayDateId(): string {
  return dateToId(new Date());
}

/**
 * Converts a Date to a "YYYY-MM-DD" string.
 */
export function dateToId(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
