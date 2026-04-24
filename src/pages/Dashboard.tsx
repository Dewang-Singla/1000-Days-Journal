import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInCalendarDays, parseISO, addDays, subDays, isBefore } from "date-fns";
import { ChevronRight } from "lucide-react";

import storage from "../storage";
import { useFreezeStore } from "../store/freezeStore";
import {
  getJourneyDayNumber,
  getTrialDayNumber,
  getTodayDateId,
  getDateFromDayNumber,
  isTrialMonth,
  isMainJourneyDate,
  isGoldenReflectionDay,
  TRIAL_START,
  dateToId,
  TOTAL_JOURNAL_DAYS,
  TOTAL_TRIAL_DAYS,
} from "../utils/dates";
import { hasEntryContent, stripHtml } from "../utils/html";
import type { DayEntry } from "../db";
import { InstallBanner } from "../components/PWAInstallPrompt";

const ACTION_MESSAGES = [
  "Do not just dream - act. Constantly thinking about your goals can create a false sense of productivity. Progress comes from execution.",
  "Do not fear failure. Fear of failing and perfectionism keep you stuck in planning. Imperfect action beats perfect inaction.",
  "Do not wait for the right moment. Readiness does not come before action - it comes because of action.",
  "Do not let overthinking drain you. Analysis paralysis kills momentum. Clarity often comes after movement.",
  "Align your identity with your goals. Do not force discipline - become someone who is disciplined.",
  "Get addicted to effort, not potential. Real growth is repetitive, slow, and uncomfortable. Love the process.",
];

/* ── Helpers ──────────────────────────────────────────────── */

/** Truncate string to max chars, adding "…" if cut */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/** Pad a day number to 3 digits (e.g. 7 → "007") */
function padDay(n: number): string {
  return String(n).padStart(3, "0");
}

/** Mood color CSS var for a rating 1-10 */
function moodColor(rating: number): string {
  if (rating < 0) return "var(--text-muted)";
  const clamped = Math.min(10, Math.max(0, Math.round(rating)));
  if (clamped === 0) return "#4B5563";
  return `var(--mood-${clamped})`;
}

/* ── Stats computation ────────────────────────────────────── */

function computeCurrentStreak(
  entries: DayEntry[],
  todayId: string,
  freezeDateIds: Set<string>,
): number {
  const entryIds = new Set(entries.filter(hasEntryContent).map((e) => e.id));
  let streak = 0;
  let d = parseISO(todayId);
  let safety = 0;
  while (safety < 1100) {
    const id = dateToId(d);
    if (!entryIds.has(id) && !freezeDateIds.has(id)) break;
    streak++;
    d = addDays(d, -1);
    safety++;
  }
  return streak;
}

function computeLongestStreak(entries: DayEntry[], freezeDateIds: Set<string>): number {
  const covered = new Set<string>([
    ...entries.filter(hasEntryContent).map((e) => e.id),
    ...freezeDateIds,
  ]);
  const sorted = Array.from(covered).sort();
  if (sorted.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1]);
    const curr = parseISO(sorted[i]);
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

const PHASES = [
  { name: "Checkpoint 1", start: 1, end: 350, emoji: "①" },
  { name: "Checkpoint 2", start: 351, end: 700, emoji: "②" },
  { name: "Checkpoint 3", start: 701, end: 1050, emoji: "③" },
  { name: "Checkpoint 4", start: 1051, end: 1400, emoji: "④" },
  { name: "Checkpoint 5", start: 1401, end: 1750, emoji: "⑤" },
  { name: "Checkpoint 6", start: 1751, end: 2100, emoji: "⑥" },
  { name: "Checkpoint 7", start: 2101, end: 2450, emoji: "⑦" },
  { name: "Checkpoint 8", start: 2451, end: 2800, emoji: "⑧" },
  { name: "Checkpoint 9", start: 2801, end: 3150, emoji: "⑨" },
  { name: "Checkpoint 10", start: 3151, end: TOTAL_JOURNAL_DAYS, emoji: "⑩" },
];

function getCurrentPhase(dayNumber: number) {
  return PHASES.find((p) => dayNumber >= p.start && dayNumber <= p.end)
    ?? PHASES[0];
}

function getPhaseProgress(dayNumber: number, phase: typeof PHASES[0]) {
  const daysIntoPhase = dayNumber - phase.start + 1;
  const totalDays = phase.end - phase.start + 1;
  return Math.min(Math.round((daysIntoPhase / totalDays) * 100), 100);
}

/* ── Component ────────────────────────────────────────────── */

export default function Dashboard() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { freezes, remaining, loadFreezes } = useFreezeStore();

  const today = useMemo(() => new Date(), []);
  const todayId = getTodayDateId();
  const trialDayNumber = getTrialDayNumber(today);
  const journeyDayNumber = getJourneyDayNumber(today);
  const trialUnlocked = useMemo(() => {
    if (loading) return false;

    const trialEntries = entries.filter((entry) => {
      const entryDate = parseISO(entry.id);
      return isTrialMonth(entryDate);
    });

    return trialEntries.length === TOTAL_TRIAL_DAYS
      && trialEntries.every((entry) => hasEntryContent(entry) && entry.ratingChecks.length === 10 && entry.ratingChecks.some(Boolean));
  }, [entries, loading]);
  const trialMonthActive = isTrialMonth(today);
  const mainJourneyActive = isMainJourneyDate(today) && trialUnlocked;
  const goldenReflectionDay = isGoldenReflectionDay(today);
  const showTodayCard = !isBefore(today, TRIAL_START) && !goldenReflectionDay && (trialMonthActive || mainJourneyActive);

  useEffect(() => {
    storage.getAllEntries().then((all) => {
      setEntries(all);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadFreezes();
  }, [loadFreezes]);

  /* ── Derived data ──────────────────────────────────────── */
  const validEntries = entries;

  const todayEntry = useMemo(
    () => entries.find((e) => e.id === todayId) ?? null,
    [entries, todayId],
  );

  const freezeDateIds = useMemo(
    () => new Set(freezes.map((f) => f.forDateId)),
    [freezes],
  );

  const currentStreak = useMemo(
    () => computeCurrentStreak(validEntries, todayId, freezeDateIds),
    [validEntries, todayId, freezeDateIds],
  );
  const longestStreak = useMemo(
    () => computeLongestStreak(validEntries, freezeDateIds),
    [validEntries, freezeDateIds],
  );
  const avgMood = useMemo(() => computeAverageMood(validEntries), [validEntries]);
  const totalEntries = useMemo(
    () => validEntries.filter(hasEntryContent).length,
    [validEntries],
  );

  const recentEntries = useMemo(
    () =>
      validEntries
        .filter(hasEntryContent)
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, 7),
    [validEntries],
  );

  const onThisDayEntries = useMemo(() => {
    const m = today.getMonth();
    const d = today.getDate();
    return validEntries.filter((e) => {
      const ed = parseISO(e.id);
      return (
        ed.getMonth() === m &&
        ed.getDate() === d &&
        ed.getFullYear() !== today.getFullYear() &&
        hasEntryContent(e)
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

  const starredQuotes = useMemo(
    () =>
      validEntries
        .filter((entry) => entry.isQuoteStarred && entry.quoteOfDay.trim().length > 0)
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, 12),
    [validEntries],
  );

  const contentEntries = useMemo(
    () => validEntries.filter(hasEntryContent),
    [validEntries],
  );

  const goRandom = () => {
    if (contentEntries.length === 0) return;
    const pick =
      contentEntries[Math.floor(Math.random() * contentEntries.length)];
    navigate(`/entry/${pick.id}`);
  };

  const displayDayNumber = mainJourneyActive ? journeyDayNumber : trialDayNumber;
  const currentPhase = getCurrentPhase(Math.max(journeyDayNumber, 1));
  const phaseProgress = mainJourneyActive ? getPhaseProgress(journeyDayNumber, currentPhase) : 0;
  const nextPhase = PHASES[PHASES.indexOf(currentPhase) + 1] ?? null;
  const daysUntilNext = nextPhase ? nextPhase.start - journeyDayNumber : 0;
  const journeyComplete = journeyDayNumber > TOTAL_JOURNAL_DAYS && !goldenReflectionDay;
  const progress = mainJourneyActive
    ? Math.min(Math.max(journeyDayNumber / TOTAL_JOURNAL_DAYS, 0), 1)
    : Math.min(Math.max(trialDayNumber / TOTAL_TRIAL_DAYS, 0), 1);
  const milestones = [350, 700, 1050, 1400, 1750, 2100, 2450, 2800, 3150, TOTAL_JOURNAL_DAYS]
    .map((day) => ({ day, date: format(getDateFromDayNumber(day), "MMM d, yyyy") }));

  const taskStats = useMemo(() => {
    const last7 = Array.from({ length: 7 }, (_, i) => dateToId(subDays(new Date(), i)));

    const weekEntries = entries.filter((e) => last7.includes(e.id) && e.todos.length > 0);

    const totalTasks = weekEntries.reduce((sum, e) => sum + e.todos.length, 0);
    const completedTasks = weekEntries.reduce(
      (sum, e) => sum + e.todos.filter((t) => t.completed).length,
      0,
    );
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const perfectDays = weekEntries.filter(
      (e) => e.todos.length > 0 && e.todos.every((t) => t.completed),
    ).length;

    return { totalTasks, completedTasks, completionRate, perfectDays };
  }, [entries]);

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
        {isBefore(today, TRIAL_START) ? (
          <>
            <h1
              className="text-5xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Journey Begins Soon
            </h1>
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
              Trial month starts {format(TRIAL_START, "MMMM d, yyyy")}
            </p>
            <p className="text-sm" style={{ color: "var(--accent)" }}>
              {(() => {
                const d = Math.abs(differenceInCalendarDays(TRIAL_START, new Date()));
                if (d === 0) return "Journey starts today!";
                return `${d} ${d === 1 ? "day" : "days"} to go`;
              })()}
            </p>
          </>
        ) : trialMonthActive && !trialUnlocked ? (
          <>
            <h1
              className="text-5xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Trial Month
            </h1>
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
              May 1 - 31, 2026
            </p>
            <p className="text-sm" style={{ color: "var(--accent)" }}>
              Complete May to unlock June 1, 2026
            </p>
          </>
        ) : goldenReflectionDay ? (
          <>
            <h1
              className="text-5xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Golden Reflection Day
            </h1>
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
              December 31, 2035
            </p>
            <p className="text-sm" style={{ color: "var(--accent)" }}>
              The final reflection of the 10-year journey
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-5xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Day {displayDayNumber}
            </h1>
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
              of your {TOTAL_JOURNAL_DAYS}-day journey
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
            {isBefore(today, TRIAL_START)
              ? `0 / ${TOTAL_TRIAL_DAYS} trial days`
              : mainJourneyActive
                ? <>{displayDayNumber} {displayDayNumber === 1 ? 'day' : 'days'} in &nbsp;·&nbsp; {(() => { const r = Math.max(TOTAL_JOURNAL_DAYS - displayDayNumber, 0); return `${r} ${r === 1 ? 'day' : 'days'} remaining`; })()}</>
                : <>{displayDayNumber} {displayDayNumber === 1 ? 'trial day' : 'trial days'} in &nbsp;·&nbsp; unlocks June 1</>}
          </p>
        </div>

        {/* Pre-journey countdown */}
        {!isBefore(today, TRIAL_START) && trialMonthActive && !trialUnlocked && (
          <div
            className="card p-6 max-w-md mx-auto text-center space-y-2"
            style={{ borderTop: "3px solid var(--accent)" }}
          >
            <p
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Complete the May trial to unlock June 1
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Need all {TOTAL_TRIAL_DAYS} trial days completed
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
      {showTodayCard && !journeyComplete && (
        <TodayCard entry={todayEntry} todayId={todayId} navigate={navigate} />
      )}

      {/* ── Stats Strip ──────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard icon="🔥" value={currentStreak} label="day streak" highlight={currentStreak > 0} />
        <StatCard icon="⚡" value={longestStreak} label="best streak" />
        <StatCard
          icon=""
          value={avgMood > 0 ? avgMood.toFixed(1) : "—"}
          label="/ 10 avg mood"
          valueColor={avgMood > 0 ? moodColor(avgMood) : undefined}
        />
        <StatCard icon="📖" value={totalEntries} label="days documented" />
        <StatCard
          icon="❄️"
          value={remaining}
          label="streak freezes left"
          valueColor={remaining === 0
            ? "rgba(239,68,68,0.9)"
            : "rgba(96,165,250,0.9)"}
        />
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="section-title">Execution Reminders</h2>
        <div className="space-y-2">
          {ACTION_MESSAGES.map((message) => (
            <p key={message} className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {message}
            </p>
          ))}
        </div>
      </section>

      {mainJourneyActive && (
        <section className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentPhase.emoji}</span>
              <div>
                <p className="font-serif font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                  {currentPhase.name} Phase
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Day {currentPhase.start} - {currentPhase.end}
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold font-mono" style={{ color: "var(--accent)" }}>
              {journeyDayNumber <= 0 ? 0 : phaseProgress}%
            </p>
          </div>

          <div className="w-full rounded-full h-2" style={{ background: "var(--bg-secondary)" }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${journeyDayNumber <= 0 ? 0 : phaseProgress}%`,
                background: "var(--accent)",
              }}
            />
          </div>

          <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
            <span>
              {journeyDayNumber <= 0
                ? `Phase begins ${format(TRIAL_START, "MMMM d, yyyy")}`
                : `Day ${journeyDayNumber - currentPhase.start + 1} of ${currentPhase.end - currentPhase.start + 1} in this phase`}
            </span>
            {journeyDayNumber > 0 && nextPhase && (
              <span>
                {daysUntilNext} days until {nextPhase.emoji} {nextPhase.name}
              </span>
            )}
            {journeyDayNumber > 0 && !nextPhase && (
              <span style={{ color: "var(--accent)" }}>
                Final phase 👑
              </span>
            )}
          </div>

          <div className="flex gap-1 pt-1">
            {PHASES.map((p) => (
              <div
                key={p.name}
                className="flex-1 text-center py-1 rounded text-xs"
                style={{
                  background: journeyDayNumber >= p.start
                    ? "var(--accent-subtle)"
                    : "var(--bg-secondary)",
                  color: journeyDayNumber >= p.start
                    ? "var(--accent)"
                    : "var(--text-muted)",
                  fontSize: 9,
                  opacity: currentPhase.name === p.name ? 1 : 0.6,
                  border: currentPhase.name === p.name
                    ? "1px solid var(--accent)"
                    : "1px solid transparent",
                }}
                title={`${p.name}: Day ${p.start}-${p.end}`}
              >
                {p.emoji}
              </div>
            ))}
          </div>
        </section>
      )}

      {taskStats.totalTasks > 0 && (
        <section className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-serif font-bold text-lg" style={{ color: "var(--text-primary)" }}>
              ☑ This Week&apos;s Tasks
            </p>
            <p
              className="text-2xl font-bold font-mono"
              style={{
                color: taskStats.completionRate === 100
                  ? "rgba(74,222,128,0.9)"
                  : taskStats.completionRate >= 70
                    ? "var(--accent)"
                    : "rgba(239,68,68,0.9)",
              }}
            >
              {taskStats.completionRate}%
            </p>
          </div>

          <div className="w-full rounded-full h-2" style={{ background: "var(--bg-secondary)" }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${taskStats.completionRate}%`,
                background: taskStats.completionRate === 100
                  ? "rgba(74,222,128,0.9)"
                  : taskStats.completionRate >= 70
                    ? "var(--accent)"
                    : "rgba(239,68,68,0.6)",
              }}
            />
          </div>

          <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
            <span>
              {taskStats.completedTasks} of {taskStats.totalTasks} tasks done
            </span>
            {taskStats.perfectDays > 0 && (
              <span style={{ color: "rgba(74,222,128,0.9)" }}>
                ✓ {taskStats.perfectDays} perfect {taskStats.perfectDays === 1 ? "day" : "days"} this week
              </span>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="section-title">Journey Milestones</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {milestones.map((m) => (
            <div
              key={m.day}
              className="card p-3 text-center"
              style={
                journeyDayNumber >= m.day
                  ? { border: "1px solid rgba(245,158,11,0.45)" }
                  : undefined
              }
            >
              <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                Day {m.day}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {m.date}
              </p>
            </div>
          ))}
        </div>
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
              const ed = parseISO(entry.id);
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

      <section className="space-y-4">
        <h2 className="section-title">Starred Quotes</h2>
        {starredQuotes.length === 0 ? (
          <div className="card p-5 text-sm" style={{ color: "var(--text-muted)" }}>
            Star quotes in Day Entry to see them here.
          </div>
        ) : (
          <div className="space-y-2">
            {starredQuotes.map((entry) => (
              <button
                key={`${entry.id}-quote`}
                onClick={() => navigate(`/entry/${entry.id}`)}
                className="card p-4 w-full text-left cursor-pointer space-y-1"
                style={{ border: "1px solid var(--border-subtle)" }}
              >
                <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>{format(parseISO(entry.id), "MMM d, yyyy")}</span>
                  <span>⭐</span>
                </div>
                <p className="text-sm italic" style={{ color: "var(--text-primary)" }}>
                  "{truncate(entry.quoteOfDay.trim(), 200)}"
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

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
  const ed = parseISO(entry.id);
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
