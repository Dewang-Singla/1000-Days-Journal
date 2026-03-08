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
  getDayNumber,
  isValidJournalDate,
  isReflectionMonth,
  dateToId,
} from "../utils/dates";
import type { DayEntry, RedemptionDay } from "../db";

/* ── Constants ────────────────────────────────────────────── */

const JOURNEY_START = new Date(2026, 2, 10);
const MIN_MONTH = new Date(2026, 2, 1); // Mar 2026
const MAX_MONTH = new Date(2028, 11, 1); // Dec 2028
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function hasContent(e: DayEntry): boolean {
  return (
    stripHtml(e.journal).trim().length > 0 ||
    e.todos.length > 0 ||
    e.memories.length > 0
  );
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
  { color: "rgba(239,68,68,0.35)", border: "transparent", label: "⚠ Redeemed" },
  { color: "rgba(245,158,11,0.25)", border: "transparent", label: "Redemption Day" },
];

/* ── Component ────────────────────────────────────────────── */

export default function Calendar() {
  const navigate = useNavigate();
  const today = new Date();

  const initialMonth = isBefore(today, JOURNEY_START)
    ? new Date(2026, 2, 1)
    : startOfMonth(today);

  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [entriesMap, setEntriesMap] = useState<Map<string, DayEntry>>(new Map());
  const [, setAllEntries] = useState<DayEntry[]>([]);
  const [redemptionsMap, setRedemptionsMap] = useState<Map<string, RedemptionDay>>(new Map());
  const [, setRedemptionsByAssigned] = useState<Map<string, RedemptionDay>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  /* ── Load entries ─────────────────────────────────────── */
  useEffect(() => {
    setIsLoading(true);
    Promise.all([storage.getAllEntries(), storage.getRedemptions()]).then(([all, redemptions]) => {
      setAllEntries(all);
      const map = new Map<string, DayEntry>();
      for (const e of all) {
        map.set(e.id, e);
      }
      setEntriesMap(map);

      const rMap = new Map<string, RedemptionDay>();
      const rByAssigned = new Map<string, RedemptionDay>();
      for (const r of redemptions) {
        rMap.set(r.id, r);
        rByAssigned.set(r.assignedToDateId, r);
      }
      setRedemptionsMap(rMap);
      setRedemptionsByAssigned(rByAssigned);

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
  }, []);

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
      .filter((e): e is DayEntry => e != null && hasContent(e));

    const possibleDays = validDays.length;
    const writtenDays = monthEntries.length;

    const rated = monthEntries.filter((e) => e.moodRating >= 0 && !e.isRedeemed);
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
          <button className="btn-ghost text-xs px-3 py-1" onClick={goToday}>
            Today
          </button>
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
          const isReflection = isReflectionMonth(day);
          const beforeStart = isBefore(day, JOURNEY_START);
          const dayNum = getDayNumber(day);

          const isFuture = isAfter(startOfDay(day), startOfDay(today));

          // Redemption data
          const isRedeemed = entry?.isRedeemed ?? false;
          const redemptionAsReplacement = redemptionsMap.get(id) ?? null; // this Dec day is a replacement
          const isRedemptionDay = id >= "2028-12-04" && id <= "2028-12-24";
          const isReflectionDay = id >= "2028-12-25" && id <= "2028-12-31";

          return (
            <CalendarCell
              key={id}
              day={day}
              dayNum={dayNum}
              entry={entry ?? null}
              inMonth={inMonth}
              isToday={isCurrentDay}
              isValid={isValid}
              isReflection={isReflection}
              beforeStart={beforeStart}
              isFuture={isFuture}
              isRedeemed={isRedeemed}
              redemptionAsReplacement={redemptionAsReplacement}
              isRedemptionDay={isRedemptionDay}
              isReflectionDay={isReflectionDay}
              onClick={() => {
                if (isFuture) return;
                if (isRedeemed) return;
                if (isReflectionDay) navigate("/reflection");
                else if (isReflection && !isRedemptionDay) navigate("/reflection");
                else if (isValid && inMonth) navigate(`/entry/${id}`);
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
  isReflection,
  beforeStart,
  isFuture,
  isRedeemed,
  redemptionAsReplacement,
  isRedemptionDay,
  isReflectionDay,
  onClick,
}: {
  day: Date;
  dayNum: number;
  entry: DayEntry | null;
  inMonth: boolean;
  isToday: boolean;
  isValid: boolean;
  isReflection: boolean;
  beforeStart: boolean;
  isFuture: boolean;
  isRedeemed: boolean;
  redemptionAsReplacement: RedemptionDay | null;
  isRedemptionDay: boolean;
  isReflectionDay: boolean;
  onClick: () => void;
}) {
  const dayOfMonth = day.getDate();

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

  /* Before journey start */
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

  /* Dec 25-31: Reflection Days (purple tint) */
  if (isReflectionDay) {
    return (
      <button
        onClick={onClick}
        className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 text-xs cursor-pointer transition-all flex flex-col items-center justify-center gap-1"
        style={{
          background: "rgba(129,140,248,0.12)",
          border: isToday ? "2px solid var(--accent)" : "1px solid rgba(129,140,248,0.2)",
          color: "var(--text-secondary)",
        }}
      >
        <span className="text-xs">{dayOfMonth}</span>
        <span style={{ color: "rgba(129,140,248,0.8)", fontSize: 16 }}>✦</span>
      </button>
    );
  }

  /* Dec 4-24: Redemption Days */
  if (isRedemptionDay) {
    const isAssigned = !!redemptionAsReplacement;
    return (
      <button
        onClick={onClick}
        className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 text-xs cursor-pointer transition-all flex flex-col items-center justify-center gap-1"
        style={{
          background: isAssigned ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.08)",
          border: isToday ? "2px solid var(--accent)" : `1px solid ${isAssigned ? "rgba(245,158,11,0.4)" : "rgba(245,158,11,0.15)"}`,
          color: "var(--text-secondary)",
        }}
      >
        <span className="text-xs font-medium">{dayOfMonth}</span>
        {isAssigned ? (
          <span
            className="text-center leading-tight"
            style={{ color: "rgba(245,158,11,0.9)", fontSize: 8 }}
          >
            ↔ {format(new Date(redemptionAsReplacement.assignedToDateId + "T00:00:00"), "MMM d, yyyy")}
          </span>
        ) : (
          <span
            className="text-center leading-tight"
            style={{ color: "rgba(245,158,11,0.5)", fontSize: 8 }}
          >
            Redemption
          </span>
        )}
      </button>
    );
  }

  /* Reflection month (fallback for non-Dec-split logic) */
  if (isReflection) {
    return (
      <button
        onClick={onClick}
        className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 text-xs cursor-pointer transition-all flex flex-col items-center justify-center gap-1"
        style={{
          background: "rgba(129,140,248,0.12)",
          border: isToday ? "2px solid var(--accent)" : "1px solid rgba(129,140,248,0.2)",
          color: "var(--text-secondary)",
        }}
      >
        <span className="text-xs">{dayOfMonth}</span>
        <span style={{ color: "rgba(129,140,248,0.8)", fontSize: 16 }}>✦</span>
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
  const bg = isRedeemed
    ? "rgba(239,68,68,0.35)"
    : entry && entry.moodRating > 0
      ? moodBg(entry.moodRating)
      : "var(--bg-card)";
  const hasEntry = entry != null && (
    stripHtml(entry.journal).trim().length > 0 ||
    entry.todos.length > 0 ||
    entry.memories.length > 0
  );
  const memoryDots = entry ? Math.min(entry.memories.length, 3) : 0;

  /* Redeemed: unclickable, tooltip, no navigation */
  if (isRedeemed) {
    return (
      <div
        className="min-h-[60px] lg:min-h-[80px] rounded-lg p-1.5 relative flex flex-col cursor-not-allowed"
        style={{
          background: bg,
          border: "1px solid rgba(239,68,68,0.3)",
        }}
        title="This day was redeemed"
      >
        <div className="flex justify-between items-start w-full">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--text-muted)", textDecoration: "line-through" }}
          >
            {dayOfMonth}
          </span>
          <span style={{ fontSize: 10, lineHeight: 1 }}>⚠</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span style={{ color: "rgba(239,68,68,0.6)", fontSize: 14 }}>🚫</span>
        </div>
      </div>
    );
  }

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
            textDecoration: isRedeemed ? "line-through" : "none",
          }}
        >
          {dayOfMonth}
        </span>
        {isRedeemed && (
          <span style={{ fontSize: 10, lineHeight: 1 }}>⚠</span>
        )}
        {!isRedeemed && isValid && (
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
