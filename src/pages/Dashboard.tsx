import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInCalendarDays } from "date-fns";
import { ChevronRight } from "lucide-react";

import storage from "../storage";
import {
  getDayNumber,
  getTodayDateId,
  isValidJournalDate,
  dateToId,
} from "../utils/dates";
import type { DayEntry, RedemptionDay } from "../db";
import { InstallBanner } from "../components/PWAInstallPrompt";

/* ── Helpers ──────────────────────────────────────────────── */

/** Strip HTML tags to plain text */
function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

/** Truncate string to max chars, adding "…" if cut */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/** Pad a day number to 3 digits (e.g. 7 → "007") */
function padDay(n: number): string {
  return String(n).padStart(3, "0");
}

/** Check if an entry has meaningful content */
function hasContent(e: DayEntry): boolean {
  return (
    stripHtml(e.journal).trim().length > 0 ||
    e.todos.length > 0 ||
    e.memories.length > 0
  );
}

/** Mood color CSS var for a rating 1-10 */
function moodColor(rating: number): string {
  if (rating < 0) return "var(--text-muted)";
  const clamped = Math.min(10, Math.max(0, Math.round(rating)));
  if (clamped === 0) return "#4B5563";
  return `var(--mood-${clamped})`;
}

/* ── Stats computation ────────────────────────────────────── */

function computeCurrentStreak(entries: DayEntry[], todayId: string): number {
  const entryIds = new Set(entries.filter(hasContent).map((e) => e.id));
  let streak = 0;
  const d = new Date(todayId + "T00:00:00");
  while (true) {
    const id = dateToId(d);
    if (!entryIds.has(id)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function computeLongestStreak(entries: DayEntry[]): number {
  const sorted = entries
    .filter(hasContent)
    .map((e) => e.id)
    .sort();
  if (sorted.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const curr = new Date(sorted[i] + "T00:00:00");
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

function computeAverageMood(entries: DayEntry[]): number {
  const rated = entries.filter((e) => e.moodRating >= 0);
  if (rated.length === 0) return 0;
  const sum = rated.reduce((a, e) => a + e.moodRating, 0);
  return sum / rated.length;
}

/* ── Component ────────────────────────────────────────────── */

export default function Dashboard() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionDay[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayId = getTodayDateId();
  const rawDayNumber = getDayNumber(today);
  const journeyStarted = isValidJournalDate(today);
  const daysUntilStart = journeyStarted ? 0 : Math.max(1 - rawDayNumber, 0);

  useEffect(() => {
    Promise.all([storage.getAllEntries(), storage.getRedemptions()]).then(([all, reds]) => {
      setEntries(all);
      setRedemptions(reds);
      setLoading(false);
    });
  }, []);

  /* ── Derived data ──────────────────────────────────────── */
  const validEntries = useMemo(
    () => entries.filter((e) => !e.isRedeemed),
    [entries],
  );
  const redeemedCount = useMemo(
    () => entries.filter((e) => e.isRedeemed).length,
    [entries],
  );

  const todayEntry = useMemo(
    () => entries.find((e) => e.id === todayId) ?? null,
    [entries, todayId],
  );

  const currentStreak = useMemo(
    () => computeCurrentStreak(validEntries, todayId),
    [validEntries, todayId],
  );
  const longestStreak = useMemo(() => computeLongestStreak(validEntries), [validEntries]);
  const avgMood = useMemo(() => computeAverageMood(validEntries), [validEntries]);
  const totalEntries = useMemo(
    () => validEntries.filter(hasContent).length,
    [validEntries],
  );

  const recentEntries = useMemo(
    () =>
      validEntries
        .filter(hasContent)
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, 7),
    [validEntries],
  );

  const onThisDayEntries = useMemo(() => {
    const m = today.getMonth();
    const d = today.getDate();
    return validEntries.filter((e) => {
      const ed = new Date(e.id + "T00:00:00");
      return (
        ed.getMonth() === m &&
        ed.getDate() === d &&
        ed.getFullYear() !== today.getFullYear() &&
        hasContent(e)
      );
    });
  }, [validEntries, today]);

  const highlights = useMemo(
    () =>
      validEntries
        .filter((e) => e.isHighlight)
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, 3),
    [validEntries],
  );

  const contentEntries = useMemo(
    () => validEntries.filter(hasContent),
    [validEntries],
  );

  const goRandom = () => {
    if (contentEntries.length === 0) return;
    const pick =
      contentEntries[Math.floor(Math.random() * contentEntries.length)];
    navigate(`/entry/${pick.id}`);
  };

  const dayNumber = Math.max(rawDayNumber - redeemedCount, 0);
  const journeyComplete = dayNumber > 1000;
  const progress = Math.min(Math.max(dayNumber / 1000, 0), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="page-transition max-w-4xl mx-auto space-y-8 pb-20">
      {/* ── Hero Section ─────────────────────────────────── */}
      <section className="text-center space-y-4">
        {dayNumber <= 0 ? (
          <>
            <h1
              className="text-5xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Journey Begins Soon
            </h1>
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
              Starting March 10, 2026
            </p>
            <p className="text-sm" style={{ color: "var(--accent)" }}>
              {(() => {
                const d = differenceInCalendarDays(new Date(2026, 2, 10), new Date());
                return `${d} ${d === 1 ? 'day' : 'days'} to go`;
              })()}
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-5xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Day {dayNumber}
            </h1>
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
              of your 1000-day journey
            </p>
          </>
        )}

        {/* Progress bar */}
        <div className="space-y-2 max-w-xl mx-auto">
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: "var(--bg-card)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress * 100}%`,
                background: "linear-gradient(90deg, #F59E0B, #D97706)",
              }}
            />
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {dayNumber <= 0
              ? "0 / 1000 days"
              : <>{dayNumber} {dayNumber === 1 ? 'day' : 'days'} in &nbsp;·&nbsp; {(() => { const r = Math.max(1000 - dayNumber, 0); return `${r} ${r === 1 ? 'day' : 'days'} remaining`; })()}</>}
          </p>
        </div>

        {/* Pre-journey countdown */}
        {!journeyStarted && !journeyComplete && (
          <div
            className="card p-6 max-w-md mx-auto text-center space-y-2"
            style={{ borderTop: "3px solid var(--accent)" }}
          >
            <p
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Your journey begins in {daysUntilStart} day
              {daysUntilStart !== 1 ? "s" : ""}
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Starting March 10, 2026
            </p>
          </div>
        )}

        {/* Journey complete */}
        {journeyComplete && (
          <div
            className="card p-6 max-w-md mx-auto text-center space-y-3"
            style={{ borderTop: "3px solid var(--accent)" }}
          >
            <p
              className="text-2xl font-serif font-bold"
              style={{ color: "var(--accent)" }}
            >
              Journey Complete 🎉
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate("/reflection")}
            >
              Go to Reflections
            </button>
          </div>
        )}
      </section>
      {/* ── PWA Install Banner ──────────────────────────── */}
      <InstallBanner />
      {/* ── Today Card ───────────────────────────────────── */}
      {journeyStarted && !journeyComplete && (
        <TodayCard entry={todayEntry} todayId={todayId} navigate={navigate} />
      )}

      {/* ── Stats Strip ──────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon="🔥" value={currentStreak} label="day streak" highlight={currentStreak > 0} />
        <StatCard icon="⚡" value={longestStreak} label="best streak" />
        <StatCard
          icon=""
          value={avgMood > 0 ? avgMood.toFixed(1) : "—"}
          label="/ 10 avg mood"
          valueColor={avgMood > 0 ? moodColor(avgMood) : undefined}
        />
        <StatCard icon="📖" value={totalEntries} label={redeemedCount > 0 ? `days documented (${redeemedCount} redeemed)` : "days documented"} />
        <StatCard
          icon="🔄"
          value={`${redemptions.length} / 21`}
          label="redemption days"
          valueColor={
            redemptions.length === 0
              ? "rgba(74,222,128,0.9)"
              : redemptions.length > 15
                ? "rgba(239,68,68,0.9)"
                : "rgba(245,158,11,0.9)"
          }
        />
      </section>

      {/* ── Recent Entries ───────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="section-title">Recent Entries</h2>
        {recentEntries.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-5xl">📔</p>
            <p style={{ color: "var(--text-muted)" }}>
              Your story begins here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentEntries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} navigate={navigate} />
            ))}
          </div>
        )}
      </section>

      {/* ── On This Day ──────────────────────────────────── */}
      {onThisDayEntries.length > 0 && (
        <section className="space-y-4">
          <h2 className="section-title">On This Day</h2>
          <div className="space-y-2">
            {onThisDayEntries.map((entry) => {
              const ed = new Date(entry.id + "T00:00:00");
              return (
                <button
                  key={entry.id}
                  onClick={() => navigate(`/entry/${entry.id}`)}
                  className="card p-4 w-full text-left cursor-pointer flex items-center gap-4"
                  style={{ border: "1px solid var(--border-subtle)" }}
                >
                  <div className="text-center shrink-0">
                    <p
                      className="text-xs font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      {ed.getFullYear()}
                    </p>
                    <p
                      className="text-sm font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Day {entry.dayNumber}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {truncate(stripHtml(entry.journal), 80)}
                    </p>
                  </div>
                  {entry.moodEmoji && (
                    <span className="text-lg shrink-0">{entry.moodEmoji}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Highlights ───────────────────────────────────── */}
      {highlights.length > 0 && (
        <section className="space-y-4">
          <h2 className="section-title">Highlights ★</h2>
          <div className="space-y-2">
            {highlights.map((entry) => (
              <EntryRow key={entry.id} entry={entry} navigate={navigate} />
            ))}
          </div>
          <button
            className="btn-ghost text-sm"
            onClick={() => navigate("/timeline?filter=highlights")}
          >
            View all highlights →
          </button>
        </section>
      )}

      {/* ── Random Entry Button ──────────────────────────── */}
      <div className="text-center pt-4">
        <button
          className="btn-ghost"
          onClick={goRandom}
          disabled={contentEntries.length === 0}
          style={
            contentEntries.length === 0 ? { opacity: 0.4, cursor: "default" } : {}
          }
        >
          ✦ Take me somewhere random
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

/* ── Today Card ────────────────────────────────────────────── */

function TodayCard({
  entry,
  todayId,
  navigate,
}: {
  entry: DayEntry | null;
  todayId: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const hasJournal =
    entry && stripHtml(entry.journal).trim().length > 0;

  return (
    <div
      className="card p-5 space-y-3"
      style={{ borderLeft: "4px solid var(--accent)" }}
    >
      {hasJournal ? (
        <>
          <div className="flex items-center gap-3">
            {entry.moodEmoji && (
              <span className="text-2xl">{entry.moodEmoji}</span>
            )}
            {entry.moodRating >= 0 && (
              <span
                className="text-lg font-bold"
                style={{ color: moodColor(entry.moodRating) }}
              >
                {entry.moodRating}/10
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {truncate(stripHtml(entry.journal), 120)}
          </p>
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.tags.map((t) => (
                <span key={t} className="tag-chip">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <button
            className="btn-ghost text-sm"
            onClick={() => navigate(`/entry/${todayId}`)}
          >
            Continue Writing →
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <p style={{ color: "var(--text-secondary)" }}>
            You haven't written today yet
          </p>
          <button
            className="btn-primary"
            onClick={() => navigate(`/entry/${todayId}`)}
          >
            Write Today's Entry →
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Stat Card ─────────────────────────────────────────────── */

function StatCard({
  icon,
  value,
  label,
  valueColor,
}: {
  icon: string;
  value: number | string;
  label: string;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="card p-5 text-center space-y-1">
      {icon && <p className="text-xl">{icon}</p>}
      <p
        className="text-3xl font-bold"
        style={{ color: valueColor ?? "var(--text-primary)" }}
      >
        {value}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

/* ── Entry Row ─────────────────────────────────────────────── */

function EntryRow({
  entry,
  navigate,
}: {
  entry: DayEntry;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const ed = new Date(entry.id + "T00:00:00");
  const dateStr = format(ed, "MMMM d, yyyy");
  const journal = truncate(stripHtml(entry.journal), 100);
  const shownTags = entry.tags.slice(0, 3);
  const extraTags = entry.tags.length - 3;

  return (
    <button
      onClick={() => navigate(`/entry/${entry.id}`)}
      className="card w-full text-left cursor-pointer flex items-center gap-4 px-5 py-4"
    >
      {/* Day number */}
      <span
        className="text-2xl font-bold shrink-0 w-14 text-center font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        {padDay(entry.dayNumber)}
      </span>

      {/* Center */}
      <div className="flex-1 min-w-0 space-y-1">
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {dateStr}
        </p>
        {journal && (
          <p
            className="text-sm truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {journal}
          </p>
        )}
        {shownTags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {shownTags.map((t) => (
              <span key={t} className="tag-chip">
                #{t}
              </span>
            ))}
            {extraTags > 0 && (
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                +{extraTags} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: mood + arrow */}
      <div className="flex items-center gap-2 shrink-0">
        {entry.moodEmoji && <span className="text-lg">{entry.moodEmoji}</span>}
        {entry.moodRating >= 0 && (
          <span
            className="text-sm font-bold"
            style={{ color: moodColor(entry.moodRating) }}
          >
            {entry.moodRating}
          </span>
        )}
        <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
      </div>
    </button>
  );
}
