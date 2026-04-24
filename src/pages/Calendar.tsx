import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth,
  isToday as isTodayFn,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import storage from "../storage";
import {
  TRIAL_START,
  JOURNAL_END,
  getDayNumber,
  getJourneyDateType,
  getJourneyTheme,
  isValidJournalDate,
  dateToId,
} from "../utils/dates";
import { hasEntryContent } from "../utils/html";
import type { DayEntry } from "../db";

/* ── Constants ────────────────────────────────────────────── */

const MIN_MONTH = startOfMonth(TRIAL_START);
const MAX_MONTH = startOfMonth(JOURNAL_END);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const YEAR_OPTIONS = Array.from(
  { length: JOURNAL_END.getFullYear() - TRIAL_START.getFullYear() + 1 },
  (_, idx) => TRIAL_START.getFullYear() + idx,
);

function getMonthBoundsForYear(year: number): { min: number; max: number } {
  const isStartYear = year === TRIAL_START.getFullYear();
  const isEndYear = year === JOURNAL_END.getFullYear();

  return {
    min: isStartYear ? TRIAL_START.getMonth() : 0,
    max: isEndYear ? JOURNAL_END.getMonth() : 11,
  };
}

/* ── Helpers ──────────────────────────────────────────────── */

function moodBg(rating: number): string {
  if (rating < 0) return "var(--bg-card)";
  if (rating === 0) return "rgba(75,85,99,0.25)";
  if (rating <= 3) return "rgba(239,68,68,0.25)";
  if (rating <= 5) return "rgba(251,146,60,0.25)";
  if (rating <= 7) return "rgba(250,204,21,0.25)";
  if (rating <= 9) return "rgba(74,222,128,0.25)";
  return "rgba(245,158,11,0.35)";
}

/* ── Legend items ──────────────────────────────────────────── */

const legendItems = [
  { color: "var(--bg-card)", border: "var(--border)", label: "No entry" },
  { color: "rgba(239,68,68,0.5)", border: "transparent", label: "1-3 Rough" },
  { color: "rgba(251,146,60,0.5)", border: "transparent", label: "4-5 Okay" },
  { color: "rgba(250,204,21,0.5)", border: "transparent", label: "6-7 Good" },
  { color: "rgba(74,222,128,0.5)", border: "transparent", label: "8-9 Great" },
  { color: "rgba(245,158,11,0.6)", border: "transparent", label: "10 Legendary" },
  { color: "transparent", border: "transparent", label: "★ Highlight", isHighlight: true },
];

const journeyLegendItems = [
  { color: "rgba(56,189,248,0.18)", border: "rgba(56,189,248,0.35)", label: "May 2026 trial month" },
  { color: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.28)", label: "Common journey day" },
  { color: "rgba(167,139,250,0.18)", border: "rgba(167,139,250,0.35)", label: "Monthly reflection day" },
  { color: "rgba(251,191,36,0.2)", border: "rgba(251,191,36,0.42)", label: "Golden reflection day" },
];

/* ── Component ────────────────────────────────────────────── */

export default function Calendar() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = sessionStorage.getItem("calendar-month");
    if (saved) {
      const parsed = new Date(saved);
      if (!Number.isNaN(parsed.getTime())) {
        const normalized = startOfMonth(parsed);
        if (normalized >= MIN_MONTH && normalized <= MAX_MONTH) {
          return normalized;
        }
      }
    }

    if (isBefore(today, TRIAL_START)) return startOfMonth(TRIAL_START);
    if (isAfter(today, JOURNAL_END)) return startOfMonth(JOURNAL_END);
    return startOfMonth(today);
  });
  const [entriesMap, setEntriesMap] = useState<Map<string, DayEntry>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    sessionStorage.setItem("calendar-month", currentMonth.toISOString());
  }, [currentMonth]);

  /* ── Load entries ─────────────────────────────────────── */
  useEffect(() => {
    storage.getAllEntries().then((all) => {
      const map = new Map<string, DayEntry>();
      for (const e of all) {
        map.set(e.id, e);
      }
      setEntriesMap(map);
      setIsLoading(false);
    });
  }, [currentMonth]);

  /* ── Calendar days ────────────────────────────────────── */
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const rangeStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  }, [currentMonth]);

  /* ── Navigation guards ────────────────────────────────── */
  const canGoBack = !isBefore(subMonths(currentMonth, 1), MIN_MONTH);
  const canGoForward = !isAfter(addMonths(currentMonth, 1), MAX_MONTH);

  const goBack = useCallback(() => {
    if (canGoBack) setCurrentMonth((m) => subMonths(m, 1));
  }, [canGoBack]);

  const goForward = useCallback(() => {
    if (canGoForward) setCurrentMonth((m) => addMonths(m, 1));
  }, [canGoForward]);

  const goToday = useCallback(() => {
    setCurrentMonth(startOfMonth(today));
  }, [today]);

  const jumpToMonth = useCallback((year: number, month: number) => {
    setCurrentMonth(new Date(year, month, 1));
  }, []);

  const selectedYear = currentMonth.getFullYear();
  const selectedMonth = currentMonth.getMonth();
  const monthBounds = getMonthBoundsForYear(selectedYear);
  const availableMonths = MONTH_NAMES
    .map((name, idx) => ({ name, idx }))
    .filter((m) => m.idx >= monthBounds.min && m.idx <= monthBounds.max);

  const onYearChange = useCallback((year: number) => {
    const { min, max } = getMonthBoundsForYear(year);
    const clampedMonth = Math.min(max, Math.max(min, currentMonth.getMonth()));
    setCurrentMonth(new Date(year, clampedMonth, 1));
  }, [currentMonth]);

  const onMonthChange = useCallback((month: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), month, 1));
  }, [currentMonth]);

  /* ── Day number range for subtitle ────────────────────── */
  const monthDayRange = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const validDays = days.filter(isValidJournalDate);
    if (validDays.length === 0) return null;
    const first = getDayNumber(validDays[0]);
    const last = getDayNumber(validDays[validDays.length - 1]);
    return { first, last };
  }, [currentMonth]);

  /* ── Monthly summary stats ────────────────────────────── */
  const monthlySummary = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const validDays = days.filter(isValidJournalDate);

    const monthEntries = validDays
      .map((d) => entriesMap.get(dateToId(d)))
      .filter((e): e is DayEntry => e != null && hasEntryContent(e));

    const possibleDays = validDays.length;
    const writtenDays = monthEntries.length;

    const rated = monthEntries.filter((e) => e.moodRating >= 0);
    const avgMood =
      rated.length > 0
        ? rated.reduce((s, e) => s + e.moodRating, 0) / rated.length
        : 0;

    const highlightCount = monthEntries.filter((e) => e.isHighlight).length;

    // Most used tag
    const tagCounts = new Map<string, number>();
    for (const e of monthEntries) {
      for (const t of e.tags) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }
    let topTag = "";
    let topCount = 0;
    for (const [tag, count] of tagCounts) {
      if (count > topCount) {
        topTag = tag;
        topCount = count;
      }
    }

    return { possibleDays, writtenDays, avgMood, highlightCount, topTag };
  }, [currentMonth, entriesMap]);

  /* ── Render ───────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="page-transition max-w-4xl mx-auto space-y-6 pb-20">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          className="btn-ghost p-2"
          onClick={goBack}
          disabled={!canGoBack}
          style={!canGoBack ? { opacity: 0.3, cursor: "default" } : {}}
        >
          <ChevronLeft size={20} />
        </button>

        <div className="text-center">
          <h1
            className="text-2xl font-serif font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {format(currentMonth, "MMMM yyyy")}
          </h1>
          {monthDayRange && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Day {monthDayRange.first} – Day {monthDayRange.last}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn-ghost p-2"
            onClick={goForward}
            disabled={!canGoForward}
            style={!canGoForward ? { opacity: 0.3, cursor: "default" } : {}}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Jump to
        </span>
        <button className="btn-ghost text-xs px-3 py-1" onClick={goToday}>
          Today
        </button>
        <button
          className="btn-ghost text-xs px-3 py-1"
          onClick={() => jumpToMonth(TRIAL_START.getFullYear(), TRIAL_START.getMonth())}
        >
          {format(TRIAL_START, "MMM yyyy")}
        </button>
        <button
          className="btn-ghost text-xs px-3 py-1"
          onClick={() => jumpToMonth(JOURNAL_END.getFullYear(), JOURNAL_END.getMonth())}
        >
          {format(JOURNAL_END, "MMM yyyy")}
        </button>
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          className="px-2 py-1 text-xs rounded-lg"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          {availableMonths.map((m) => (
            <option key={m.idx} value={m.idx}>{m.name}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="px-2 py-1 text-xs rounded-lg"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* ── Weekday Headers ──────────────────────────────── */}
      <div
        className="grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wider pb-2"
        style={{
          color: "var(--text-muted)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar Grid ────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const id = dateToId(day);
          const entry = entriesMap.get(id);
          const inMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isTodayFn(day);
          const isValid = isValidJournalDate(day);
          const beforeStart = isBefore(day, TRIAL_START);
          const dayNum = getDayNumber(day);

          const isFuture = isAfter(startOfDay(day), startOfDay(today));

          return (
            <CalendarCell
              key={id}
              day={day}
              dayNum={dayNum}
              entry={entry ?? null}
              inMonth={inMonth}
              isToday={isCurrentDay}
              isValid={isValid}
              beforeStart={beforeStart}
              isFuture={isFuture}
              onClick={() => {
                if (isFuture) return;
                if (isValid && inMonth) navigate(`/entry/${id}`);
              }}
            />
          );
        })}
      </div>

      {/* ── Legend ────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-4 justify-center py-3"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        {journeyLegendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{
                background: item.color,
                border: item.border !== "transparent" ? `1px solid ${item.border}` : "none",
              }}
            />
            {item.label}
          </div>
        ))}
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            {item.isHighlight ? (
              <span style={{ color: "var(--accent)", fontSize: 14 }}>★</span>
            ) : (
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{
                  background: item.color,
                  border: item.border !== "transparent" ? `1px solid ${item.border}` : "none",
                }}
              />
            )}
            {item.label}
          </div>
        ))}
      </div>

      {/* ── Monthly Summary ──────────────────────────────── */}
      {monthlySummary.possibleDays > 0 && (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <MiniStat
            label="Entries written"
            value={`${monthlySummary.writtenDays} / ${monthlySummary.possibleDays}`}
          />
          <MiniStat
            label="Average mood"
            value={monthlySummary.avgMood > 0 ? monthlySummary.avgMood.toFixed(1) : "—"}
          />
          <MiniStat
            label="Highlights"
            value={String(monthlySummary.highlightCount)}
          />
          <MiniStat
            label="Top tag"
            value={monthlySummary.topTag ? `#${monthlySummary.topTag}` : "—"}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

/* ── Calendar Cell ─────────────────────────────────────────── */

function CalendarCell({
  day,
  dayNum,
  entry,
  inMonth,
  isToday,
  isValid,
  beforeStart,
  isFuture,
  onClick,
}: {
  day: Date;
  dayNum: number;
  entry: DayEntry | null;
  inMonth: boolean;
  isToday: boolean;
  isValid: boolean;
  beforeStart: boolean;
  isFuture: boolean;
  onClick: () => void;
}) {
  const dayOfMonth = day.getDate();
  const journeyType = getJourneyDateType(day);
  const journeyTheme = getJourneyTheme(day);

  /* Outside current month */
  if (!inMonth) {
    return (
      <div
        className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 text-xs"
        style={{ color: "var(--text-muted)", opacity: 0.25 }}
      >
        {dayOfMonth}
      </div>
    );
  }

  /* Before trial month start */
  if (beforeStart) {
    return (
      <div
        className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 text-xs"
        style={{ background: "var(--bg-secondary)", color: "var(--text-muted)", opacity: 0.4 }}
      >
        {dayOfMonth}
      </div>
    );
  }

  /* Golden reflection day */
  if (journeyType === "golden") {
    return (
      <button
        onClick={onClick}
        className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 text-xs cursor-pointer transition-all flex flex-col items-center justify-center gap-1"
        style={{
          background: journeyTheme.accentSoft,
          border: isToday ? `2px solid ${journeyTheme.accent}` : `1px solid ${journeyTheme.border}`,
          color: "var(--text-secondary)",
        }}
      >
        <span className="text-xs">{dayOfMonth}</span>
        <span style={{ color: journeyTheme.accent, fontSize: 16 }}>✨</span>
        <span style={{ color: journeyTheme.accent, fontSize: 8 }}>Golden</span>
      </button>
    );
  }

  /* Monthly reflection day */
  if (journeyType === "monthly-reflection") {
    return (
      <button
        onClick={onClick}
        className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 text-xs cursor-pointer transition-all flex flex-col items-center justify-center gap-1"
        style={{
          background: journeyTheme.accentSoft,
          border: isToday ? `2px solid ${journeyTheme.accent}` : `1px solid ${journeyTheme.border}`,
          color: "var(--text-secondary)",
        }}
      >
        <span className="text-xs">{dayOfMonth}</span>
        <span style={{ color: journeyTheme.accent, fontSize: 16 }}>🌓</span>
        <span style={{ color: journeyTheme.accent, fontSize: 8 }}>Reflect</span>
      </button>
    );
  }

  /* Trial month day */
  if (journeyType === "trial") {
    return (
      <button
        onClick={onClick}
        className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 text-xs cursor-pointer transition-all flex flex-col items-center justify-center gap-1"
        style={{
          background: journeyTheme.accentSoft,
          border: isToday ? `2px solid ${journeyTheme.accent}` : `1px solid ${journeyTheme.border}`,
          color: "var(--text-secondary)",
        }}
      >
        <span className="text-xs">{dayOfMonth}</span>
        <span style={{ color: journeyTheme.accent, fontSize: 16 }}>🧪</span>
        <span style={{ color: journeyTheme.accent, fontSize: 8 }}>Try</span>
      </button>
    );
  }

  /* Future day within valid range */
  if (isFuture && isValid) {
    return (
      <div
        className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 text-xs flex flex-col opacity-40 cursor-not-allowed"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex justify-between items-start w-full">
          <span style={{ color: "var(--text-muted)" }}>{dayOfMonth}</span>
          <span
            className="font-mono"
            style={{ color: "var(--accent)", fontSize: 9, lineHeight: 1, opacity: 0.5 }}
          >
            D{dayNum}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>🔒</span>
        </div>
      </div>
    );
  }

  /* Valid journal day */
  const bg = entry && entry.moodRating > 0
    ? moodBg(entry.moodRating)
    : "var(--bg-card)";
  const hasEntry = entry != null && hasEntryContent(entry);
  const memoryDots = entry ? Math.min(entry.memories.length, 3) : 0;

  return (
    <button
      onClick={onClick}
      className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 cursor-pointer transition-all relative flex flex-col"
      style={{
        background: bg,
        border: isToday
          ? "2px solid var(--accent)"
          : "1px solid var(--border-subtle)",
      }}
    >
      {/* Top row */}
      <div className="flex justify-between items-start w-full">
        <span
          className="text-xs font-medium"
          style={{
            color: hasEntry ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          {dayOfMonth}
        </span>
        {isValid && (
          <span
            className="font-mono"
            style={{ color: "var(--accent)", fontSize: 9, lineHeight: 1 }}
          >
            D{dayNum}
          </span>
        )}
      </div>

      {/* Center: mood emoji */}
      <div className="flex-1 flex items-center justify-center">
        {entry?.moodEmoji && (
          <span className="text-lg leading-none">{entry.moodEmoji}</span>
        )}
      </div>

      {/* Bottom row */}
      <div className="flex justify-between items-end w-full">
        {/* Memory dots */}
        <div className="flex gap-0.5">
          {Array.from({ length: memoryDots }).map((_, i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full inline-block"
              style={{ background: "var(--text-muted)" }}
            />
          ))}
        </div>
        {/* Highlight star */}
        {entry?.isHighlight && (
          <span style={{ color: "var(--accent)", fontSize: 10, lineHeight: 1 }}>
            ★
          </span>
        )}
      </div>
    </button>
  );
}

/* ── Mini Stat ─────────────────────────────────────────────── */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="card p-4 text-center space-y-1"
    >
      <p
        className="text-lg font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}
