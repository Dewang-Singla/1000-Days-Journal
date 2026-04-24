import {
  format,
  differenceInCalendarDays,
  addDays,
  isWithinInterval,
  endOfMonth,
  getDay,
  subDays,
} from "date-fns";

/** May 1 2026 starts the trial month. */
export const TRIAL_START = new Date(2026, 4, 1); // months are 0-indexed

/** June 1 2026 = Day 1 of the main journey. */
export const JOURNEY_START = new Date(2026, 5, 1);

/** Backward-compatible alias for the main journey start. */
export const ORIGIN = JOURNEY_START;

/** Main journey ends on December 30 2035. */
export const JOURNAL_END = new Date(2035, 11, 30);

/** The 10-year golden reflection day. */
export const GOLDEN_REFLECTION_DAY = new Date(2035, 11, 31);

/** Trial month ends on May 31 2026. */
export const TRIAL_END = new Date(2026, 4, 31);

/** Legacy cycle setting kept for backward compatibility with older helpers. */
export const REFLECTION_CYCLE_DAYS = 101;

/** Total days in the main journey (June 1 2026 - December 30 2035, inclusive). */
export const TOTAL_JOURNAL_DAYS =
  differenceInCalendarDays(JOURNAL_END, JOURNEY_START) + 1;

/** Total trial days in May 2026. */
export const TOTAL_TRIAL_DAYS =
  differenceInCalendarDays(TRIAL_END, TRIAL_START) + 1;

function isSameDate(left: Date, right: Date): boolean {
  return dateToId(left) === dateToId(right);
}

/**
 * Returns the day number for the given date.
 * May 1 2026 -> Day 1 of the trial month.
 * June 1 2026 -> Day 1 of the main journey.
 */
export function getDayNumber(date: Date): number {
  if (isTrialMonth(date)) {
    return differenceInCalendarDays(date, TRIAL_START) + 1;
  }
  if (isMainJourneyDate(date)) {
    return differenceInCalendarDays(date, JOURNEY_START) + 1;
  }
  if (isGoldenReflectionDay(date)) {
    return TOTAL_JOURNAL_DAYS + 1;
  }
  return 0;
}

/**
 * Returns the day number within the main journey only.
 * June 1 2026 -> Day 1.
 */
export function getJourneyDayNumber(date: Date): number {
  if (!isMainJourneyDate(date)) {
    return isGoldenReflectionDay(date) ? TOTAL_JOURNAL_DAYS + 1 : 0;
  }
  return differenceInCalendarDays(date, JOURNEY_START) + 1;
}

/**
 * Returns the day number within the May trial month.
 */
export function getTrialDayNumber(date: Date): number {
  return isTrialMonth(date) ? differenceInCalendarDays(date, TRIAL_START) + 1 : 0;
}

/**
 * Returns the Date corresponding to a day number.
 * Day 1 -> June 1 2026.
 */
export function getDateFromDayNumber(n: number): Date {
  return addDays(JOURNEY_START, n - 1);
}

/**
 * True if the date falls within the journal window
 * (May 1 2026 - December 31 2035, inclusive).
 */
export function isValidJournalDate(date: Date): boolean {
  return isWithinInterval(date, { start: TRIAL_START, end: GOLDEN_REFLECTION_DAY });
}

/** True when the date is in the May 2026 trial month. */
export function isTrialMonth(date: Date): boolean {
  return date.getFullYear() === 2026 && date.getMonth() === 4;
}

/** True when the date is in the main June 2026 - December 2035 journey. */
export function isMainJourneyDate(date: Date): boolean {
  return isWithinInterval(date, { start: JOURNEY_START, end: JOURNAL_END });
}

/** True when the date is the final golden reflection day. */
export function isGoldenReflectionDay(date: Date): boolean {
  return isSameDate(date, GOLDEN_REFLECTION_DAY);
}

/** True when the date is the last Sunday of a month from Jun 2026 onward. */
export function isMonthlyReflectionDay(date: Date): boolean {
  if (!isMainJourneyDate(date)) return false;
  const monthEnd = endOfMonth(date);
  const offset = getDay(monthEnd);
  const lastSunday = subDays(monthEnd, offset);
  return isSameDate(date, lastSunday);
}

export type JourneyDateType = "trial" | "common" | "monthly-reflection" | "golden" | "out-of-range";

export type JourneyTheme = {
  accent: string;
  accentSoft: string;
  border: string;
  surface: string;
  surfaceSoft: string;
  glow: string;
};

export function getJourneyDateType(date: Date): JourneyDateType {
  if (!isValidJournalDate(date)) return "out-of-range";
  if (isGoldenReflectionDay(date)) return "golden";
  if (isTrialMonth(date)) return "trial";
  if (isMonthlyReflectionDay(date)) return "monthly-reflection";
  return "common";
}

export function getJourneyTheme(date: Date): JourneyTheme {
  const type = getJourneyDateType(date);
  if (type === "trial") {
    return {
      accent: "#38BDF8",
      accentSoft: "rgba(56,189,248,0.18)",
      border: "rgba(56,189,248,0.35)",
      surface: "rgba(8,47,73,0.92)",
      surfaceSoft: "rgba(12,74,110,0.12)",
      glow: "drop-shadow(0 0 24px rgba(56,189,248,0.28))",
    };
  }
  if (type === "monthly-reflection") {
    return {
      accent: "#A78BFA",
      accentSoft: "rgba(167,139,250,0.18)",
      border: "rgba(167,139,250,0.35)",
      surface: "rgba(49,46,129,0.92)",
      surfaceSoft: "rgba(99,102,241,0.12)",
      glow: "drop-shadow(0 0 24px rgba(167,139,250,0.26))",
    };
  }
  if (type === "golden") {
    return {
      accent: "#FBBF24",
      accentSoft: "rgba(251,191,36,0.2)",
      border: "rgba(251,191,36,0.42)",
      surface: "rgba(120,53,15,0.94)",
      surfaceSoft: "rgba(217,119,6,0.12)",
      glow: "drop-shadow(0 0 28px rgba(251,191,36,0.34))",
    };
  }
  return {
    accent: "#F59E0B",
    accentSoft: "rgba(245,158,11,0.18)",
    border: "rgba(245,158,11,0.28)",
    surface: "rgba(28,25,23,0.96)",
    surfaceSoft: "rgba(245,158,11,0.08)",
    glow: "drop-shadow(0 0 20px rgba(245,158,11,0.24))",
  };
}

/**
 * Legacy helper for the older 101-day cadence.
 * The current app uses monthly last-Sunday reflections plus the golden day.
 */
export function isReflectionDay(date: Date): boolean {
  const day = getDayNumber(date);
  return day > 0 && day % REFLECTION_CYCLE_DAYS === 0 && isValidJournalDate(date);
}

/**
 * Formats a date as a day header string.
 * e.g. "Day 47 · June 17, 2026"
 */
export function formatDayHeader(date: Date): string {
  const day = getDayNumber(date);
  const formatted = format(date, "MMMM d, yyyy");
  if (isGoldenReflectionDay(date)) return `Golden Reflection Day · ${formatted}`;
  if (isTrialMonth(date)) return `Try Day ${day} · ${formatted}`;
  if (isMonthlyReflectionDay(date)) return `Reflection Day · ${formatted}`;
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
