import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExt from "@tiptap/extension-image";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Plus,
  X,
  ExternalLink,
  Upload,
  Trash2,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
} from "lucide-react";

import { isAfter, startOfDay, parseISO, addDays, format } from "date-fns";

import storage from "../storage";
import { useEntryStore } from "../store/entryStore";
import { useFreezeStore } from "../store/freezeStore";
import { useHabitStore } from "../store/habitStore";
import {
  formatDayHeader,
  getJourneyDateType,
  getJourneyTheme,
  isMainJourneyDate,
  isTrialMonth,
  isValidJournalDate,
  dateToId,
  getTodayDateId,
  JOURNAL_END,
  GOLDEN_REFLECTION_DAY,
  TOTAL_TRIAL_DAYS,
  TRIAL_START,
} from "../utils/dates";
import { DEFAULT_CHECKPOINTS, normalizeCheckpointPrompts } from "../utils/checkpoints";
import { hasEntryContent } from "../utils/html";
import type { Todo, Memory, HabitLog } from "../db";

/* ── Date picker constants ──────────────────────────────── */
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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

function addDaysToId(dateId: string, days: number): string {
  return dateToId(addDays(parseISO(dateId), days));
}

function dateFromId(dateId: string): Date {
  return parseISO(dateId);
}

/** Countdown string from now until a target hour today */
function getCountdownToHour(hour: number): string {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return "";
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Strip HTML to plain text */
function stripHtmlDayEntry(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

/* ── Component ────────────────────────────────────────────── */

export default function DayEntry() {
  const { dateId: paramDateId } = useParams<{ dateId: string }>();
  const navigate = useNavigate();

  const dateId = paramDateId || getTodayDateId();
  const date = dateFromId(dateId);

  /* ── Store hooks ──────────────────────────────────────── */
  const {
    currentEntry,
    isLoading,
    loadError,
    isSaving,
    saveError,
    lastSaved,
    loadEntry,
    saveEntry,
    updateField,
    clearLoadError,
    clearSaveError,
    clearCurrentEntry,
  } = useEntryStore();

  const { habits, loadHabits } = useHabitStore();
  const {
    freezes,
    remaining: freezesRemaining,
    loadFreezes,
    useFreeze,
  } = useFreezeStore();
  const applyFreeze = useFreeze;

  const [freezeMsg, setFreezeMsg] = useState<string | null>(null);
  const [trialUnlocked, setTrialUnlocked] = useState<boolean | null>(null);

  /* ── Refs for auto-save ───────────────────────────────── */
  const hasModified = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  /* ── Load entry + habits on mount / dateId change ─────── */
  useEffect(() => {
    isInitialLoad.current = true;
    hasModified.current = false;
    autoRatedRef.current = false;
    setWasAutoRated(false);
    loadEntry(dateId);
    loadHabits();
    loadFreezes();
    setFreezeMsg(null);
    return () => {
      clearCurrentEntry();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dateId, loadEntry, loadHabits, loadFreezes, clearCurrentEntry]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isMainJourneyDate(date)) {
        if (!cancelled) setTrialUnlocked(true);
        return;
      }

      const allEntries = await storage.getAllEntries();
      const trialEntries = allEntries.filter((entry) => isTrialMonth(parseISO(entry.date)));
      const complete =
        trialEntries.length === TOTAL_TRIAL_DAYS &&
        trialEntries.every((entry) => hasEntryContent(entry) && entry.moodRating >= 0);

      if (!cancelled) setTrialUnlocked(complete);
    })();

    return () => {
      cancelled = true;
    };
  }, [dateId, date]);

  /* ── Auto-save debounce ───────────────────────────────── */
  useEffect(() => {
    if (!currentEntry) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    hasModified.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveEntry(currentEntry);
    }, 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentEntry, saveEntry]);

  /* ── Saving indicator text ────────────────────────────── */
  const savingText = isSaving
    ? "Saving..."
    : lastSaved
      ? "Saved ✓"
      : "";

  /* ── Future & out-of-range guards ─────────────────────── */
  const isFutureDate = isAfter(
    startOfDay(parseISO(dateId)),
    startOfDay(new Date()),
  );

  const nextIsFuture = isAfter(
    startOfDay(addDays(parseISO(dateId), 1)),
    startOfDay(new Date()),
  );

  /* ── Derived date flags (must be before hooks below) ──── */
  const isToday = dateId === getTodayDateId();
  const now = new Date();

  const reflectionStart = parseISO(dateId);
  reflectionStart.setHours(20, 0, 0, 0);

  const reflectionEnd = addDays(parseISO(dateId), 1);
  reflectionEnd.setHours(12, 0, 0, 0);

  const canManageTodos = !isFutureDate && now < reflectionStart;
  const canToggleTodos = !isFutureDate && now < reflectionEnd;
  const isReflectionEditable = !isFutureDate && now >= reflectionStart && now < reflectionEnd;
  const isEntryClosed = !isFutureDate && now >= reflectionEnd;
  const isBeforeReflectionWindow = !isFutureDate && now < reflectionStart;

  const yesterdayId = dateToId(addDays(new Date(), -1));
  const isYesterday = dateId === yesterdayId;
  const graceExpired = isYesterday && isEntryClosed;

  /* ── Countdown for "too early" lock ───────────────────── */
  const [countdown, setCountdown] = useState(() => getCountdownToHour(20));
  useEffect(() => {
    if (!(isToday && isBeforeReflectionWindow)) return;
    const id = setInterval(() => setCountdown(getCountdownToHour(20)), 60_000);
    return () => clearInterval(id);
  }, [isBeforeReflectionWindow, isToday]);

  /* ── Auto-rate yesterday if grace expired & unrated ───── */
  const autoRatedRef = useRef(false);
  const [wasAutoRated, setWasAutoRated] = useState(false);
  useEffect(() => {
    if (
      graceExpired &&
      currentEntry &&
      currentEntry.moodRating === -1 &&
      !autoRatedRef.current
    ) {
      autoRatedRef.current = true;
      const updated = {
        ...currentEntry,
        moodRating: 3,
        moodEmoji: "",
        ratingChecks: [true, true, true, false, false, false, false, false, false, false],
        updatedAt: new Date().toISOString(),
      };
      saveEntry(updated);
      setWasAutoRated(true);
    }
  }, [graceExpired, currentEntry, saveEntry]);

  const journeyType = getJourneyDateType(date);
  const journeyTheme = getJourneyTheme(date);
  const displayChecks = currentEntry?.ratingChecks?.length === 10
    ? currentEntry.ratingChecks
    : Array.from({ length: 10 }, () => false);
  const displayPrompts = normalizeCheckpointPrompts(currentEntry?.checkpointPrompts);

  if (!isValidJournalDate(date)) {
    const isBeforeJourneyStart = new Date() < TRIAL_START;
    const todayOrStart = isBeforeJourneyStart
      ? dateToId(TRIAL_START)
      : getTodayDateId();

    return (
      <div className="page-transition max-w-3xl mx-auto pb-20">
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="card p-10 flex flex-col items-center gap-5 text-center max-w-md w-full">
            <span className="text-5xl">📅</span>
            <h2
              className="text-2xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Outside your journey
            </h2>
            <p style={{ color: "var(--text-muted)" }}>
              This date is outside your journey window ({format(TRIAL_START, "MMM d, yyyy")} - {format(GOLDEN_REFLECTION_DAY, "MMM d, yyyy")})
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate(`/entry/${todayOrStart}`)}
            >
              {isBeforeJourneyStart ? "← Go to Trial Start" : "← Go to Today"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (trialUnlocked === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (isMainJourneyDate(date) && !trialUnlocked) {
    return (
      <div className="page-transition max-w-3xl mx-auto pb-20">
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="card p-10 flex flex-col items-center gap-5 text-center max-w-md w-full" style={{ borderTop: "4px solid #38BDF8" }}>
            <span className="text-5xl">🔒</span>
            <h2
              className="text-2xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Main journey is locked
            </h2>
            <p style={{ color: "var(--text-muted)" }}>
              Complete every day in the May 2026 trial month to unlock June 1, 2026.
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate(`/entry/${dateToId(TRIAL_START)}`)}
            >
              Go to Trial Month
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !currentEntry) {
    if (loadError) {
      return (
        <div className="page-transition max-w-3xl mx-auto pb-20">
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="card p-10 flex flex-col items-center gap-5 text-center max-w-md w-full">
              <span className="text-5xl">⚠️</span>
              <h2
                className="text-2xl font-serif font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                Could not load this entry
              </h2>
              <p style={{ color: "var(--text-muted)" }}>{loadError}</p>
              <button
                className="btn-primary"
                onClick={() => {
                  clearLoadError();
                  loadEntry(dateId);
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  /* ── Entry window closed — read-only state ───────────── */
  if (isEntryClosed) {
    const completedChecks = displayChecks.filter(Boolean).length;
    const isUnwritten =
      stripHtmlDayEntry(currentEntry.journal).trim().length === 0 &&
      currentEntry.todos.length === 0 &&
      currentEntry.memories.length === 0;
    const hasFreezeForDate = freezes.some((f) => f.forDateId === dateId);
    return (
      <div className="page-transition max-w-3xl mx-auto pb-20 space-y-8" style={{ ["--accent" as string]: journeyTheme.accent }}>
        <Header
          dateId={dateId}
          date={date}
          isToday={false}
          isHighlight={currentEntry.isHighlight}
          savingText=""
          onToggleHighlight={() => {}}
          onNavigate={(dir) => navigate(`/entry/${addDaysToId(dateId, dir)}`)}
          nextDisabled={nextIsFuture}
        />

        <div className="card p-4" style={{ background: journeyTheme.surfaceSoft, border: `1px solid ${journeyTheme.border}`, color: "var(--text-secondary)" }}>
          {journeyType === "trial" && "Trial month: build the habit, write every day, and eliminate distractions."}
          {journeyType === "common" && "Common journey day."}
          {journeyType === "monthly-reflection" && "Monthly reflection day: last Sunday of the month."}
          {journeyType === "golden" && "Golden reflection day: the 10-year closing reflection."}
        </div>

        {/* Lock notice */}
        <div className="card p-6 flex flex-col items-center gap-4 text-center">
          <span className="text-4xl">🔒</span>
          <h2
            className="text-xl font-serif font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            This entry is now locked
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            The reflection window ended at noon the next day.
          </p>
          {wasAutoRated && (
            <p
              className="text-sm font-medium px-4 py-2 rounded-lg"
              style={{ color: "rgba(245,158,11,0.9)", background: "rgba(245,158,11,0.08)" }}
            >
              ⚡ This day was automatically rated 3/10 since it wasn&apos;t rated before noon.
            </p>
          )}
          {isYesterday && isUnwritten && (
            <div className="w-full max-w-md space-y-2">
              {freezeMsg && (
                <p
                  className="text-sm font-medium px-4 py-2 rounded-lg"
                  style={{ color: "rgba(96,165,250,0.95)", background: "rgba(96,165,250,0.1)" }}
                >
                  {freezeMsg}
                </p>
              )}
              {!freezeMsg && hasFreezeForDate && (
                <p
                  className="text-sm font-medium px-4 py-2 rounded-lg"
                  style={{ color: "rgba(96,165,250,0.95)", background: "rgba(96,165,250,0.1)" }}
                >
                  A freeze already covers this missed day.
                </p>
              )}
              {!freezeMsg && !hasFreezeForDate && freezesRemaining > 0 && (
                <button
                  className="btn-primary"
                  onClick={async () => {
                    await applyFreeze(dateId);
                    await loadFreezes();
                    setFreezeMsg("Freeze used. Your streak is protected.");
                  }}
                >
                  ❄️ Use Streak Freeze
                </button>
              )}
              {!freezeMsg && !hasFreezeForDate && freezesRemaining === 0 && (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No freezes left this cycle
                </p>
              )}
            </div>
          )}
          <button
            className="btn-ghost mt-4"
            onClick={() => navigate('/')}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Read-only checkpoints */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="section-title" style={{ marginBottom: 0 }}>Daily Checkpoints</h3>
            <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
              {completedChecks}/10
            </span>
          </div>
          <div className="grid gap-2">
            {displayChecks.map((checked, index) => (
              <div
                key={`${displayPrompts[index]}-${index}`}
                className="flex items-start gap-3 rounded-xl p-3"
                style={{
                  background: checked ? "rgba(16,185,129,0.08)" : "var(--bg-secondary)",
                  border: checked ? "1px solid rgba(16,185,129,0.35)" : "1px solid var(--border)",
                }}
              >
                <span
                  className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border"
                  style={{
                    background: checked ? "var(--accent)" : "transparent",
                    borderColor: checked ? "var(--accent)" : "var(--border)",
                    color: checked ? "#000" : "var(--text-muted)",
                  }}
                >
                  {checked ? "✓" : String(index + 1)}
                </span>
                <span className="flex-1 text-sm" style={{ color: "var(--text-primary)" }}>
                  {displayPrompts[index] || "Checkpoint removed"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {!!currentEntry.quoteOfDay.trim() && (
          <section className="card p-5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="section-title" style={{ marginBottom: 0 }}>Quote of the Day</h3>
              {currentEntry.isQuoteStarred && <span title="Starred quote">⭐</span>}
            </div>
            <p className="text-sm italic" style={{ color: "var(--text-secondary)" }}>
              "{currentEntry.quoteOfDay.trim()}"
            </p>
          </section>
        )}

        {/* Read-only journal */}
        {stripHtmlDayEntry(currentEntry.journal).trim().length > 0 && (
          <section className="space-y-3">
            <h3 className="section-title">Journal</h3>
            <div
              className="rounded-xl p-4 prose prose-invert max-w-none"
              style={{
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              dangerouslySetInnerHTML={{ __html: currentEntry.journal }}
            />
          </section>
        )}

        {/* Read-only todos */}
        {currentEntry.todos.length > 0 && (
          <section className="card p-5 space-y-3">
            <h3 className="section-title">To-Do</h3>
            <ul className="space-y-1">
              {currentEntry.todos.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ background: "var(--bg-secondary)" }}
                >
                  <input type="checkbox" checked={t.completed} disabled className="accent-amber-500 w-4 h-4" />
                  <span
                    className="flex-1 text-sm"
                    style={{
                      textDecoration: t.completed ? "line-through" : "none",
                      color: t.completed ? "var(--text-muted)" : "var(--text-primary)",
                    }}
                  >
                    {t.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Read-only tags */}
        {currentEntry.tags.length > 0 && (
          <section className="card p-5 space-y-3">
            <h3 className="section-title">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {currentEntry.tags.map((tag) => (
                <span key={tag} className="tag-chip">#{tag}</span>
              ))}
            </div>
          </section>
        )}

        {/* Read-only memories */}
        {currentEntry.memories.length > 0 && (
          <section className="card p-5 space-y-3">
            <h3 className="section-title">Memories</h3>
            <div className="space-y-3">
              {currentEntry.memories.map((m) => (
                <MemoryCard key={m.id} memory={m} onDelete={() => {}} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  /* ── Future date locked state ─────────────────────────── */
  if (isFutureDate) {
    return (
      <div className="page-transition max-w-3xl mx-auto pb-20 space-y-8">
        <Header
          dateId={dateId}
          date={date}
          isToday={false}
          isHighlight={false}
          savingText=""
          onToggleHighlight={() => {}}
          onNavigate={(dir) => navigate(`/entry/${addDaysToId(dateId, dir)}`)}
          nextDisabled={true}
        />

        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div
            className="card p-10 flex flex-col items-center gap-5 text-center max-w-md w-full"
          >
            <span className="text-5xl" style={{ color: "var(--accent)" }}>🔒</span>
            <h2
              className="text-2xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              This day hasn&apos;t arrived yet
            </h2>
            <p style={{ color: "var(--text-muted)" }}>
              Come back on{" "}
              <span style={{ color: "var(--text-secondary)" }}>
                {format(date, "MMMM d, yyyy")}
              </span>{" "}
              to write this entry
            </p>
            <button
              className="btn-primary mt-2"
              onClick={() => navigate(`/entry/${getTodayDateId()}`)}
            >
              ← Go to Today
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition max-w-3xl mx-auto pb-20 space-y-8">
      {/* ── Header ─────────────────────────────────────── */}
      <Header
        dateId={dateId}
        date={date}
        isToday={isToday}
        isHighlight={currentEntry.isHighlight}
        savingText={savingText}
        onToggleHighlight={() =>
          updateField("isHighlight", !currentEntry.isHighlight)
        }
        onNavigate={(dir) => navigate(`/entry/${addDaysToId(dateId, dir)}`)}
        nextDisabled={nextIsFuture}
      />

      {/* ── Date Jumper ────────────────────────────────── */}
      <DateJumper
        currentDate={date}
        onJump={(newDate) => navigate(`/entry/${dateToId(newDate)}`)}
      />

      {isToday && isBeforeReflectionWindow && (
        <div
          className="card p-4 text-sm"
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.25)",
            color: "var(--text-secondary)",
          }}
        >
          Reflection sections (checkpoints, journal, habits, tags, gratitude, memories, quote) unlock at 8:00 PM.
          {countdown ? ` Unlocks in ${countdown}.` : ""} To-dos stay editable until 8:00 PM.
        </div>
      )}

      {isReflectionEditable && (
        <div
          className="card p-4 text-sm"
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.25)",
            color: "var(--text-secondary)",
          }}
        >
          Reflection window is open for this day until 12:00 PM next day. To-dos are closed.
        </div>
      )}

      {/* ── Mood ───────────────────────────────────────── */}
      <CheckpointSection
        checks={displayChecks}
        prompts={displayPrompts}
        readOnly={!isReflectionEditable}
        onToggle={(index) => {
          const nextChecks = [...displayChecks];
          nextChecks[index] = !nextChecks[index];
          const nextScore = nextChecks.filter(Boolean).length;
          updateField("ratingChecks", nextChecks);
          updateField("moodRating", nextScore);
          updateField("moodEmoji", "");
        }}
        onPromptChange={(index, value) => {
          const nextPrompts = [...displayPrompts];
          nextPrompts[index] = value;
          updateField("checkpointPrompts", normalizeCheckpointPrompts(nextPrompts));
        }}
        onRemovePrompt={(index) => {
          const nextPrompts = [...displayPrompts];
          nextPrompts[index] = "";
          const nextChecks = [...displayChecks];
          nextChecks[index] = false;
          updateField("checkpointPrompts", normalizeCheckpointPrompts(nextPrompts));
          updateField("ratingChecks", nextChecks);
          updateField("moodRating", nextChecks.filter(Boolean).length);
          updateField("moodEmoji", "");
        }}
        onAddPrompt={() => {
          const emptyIndex = displayPrompts.findIndex((item) => item.trim().length === 0);
          if (emptyIndex === -1) return;
          const nextPrompts = [...displayPrompts];
          nextPrompts[emptyIndex] = `New checkpoint ${emptyIndex + 1}`;
          updateField("checkpointPrompts", normalizeCheckpointPrompts(nextPrompts));
        }}
        onResetPrompts={() => updateField("checkpointPrompts", normalizeCheckpointPrompts(DEFAULT_CHECKPOINTS))}
      />

      <QuoteSection
        quote={currentEntry.quoteOfDay}
        starred={currentEntry.isQuoteStarred}
        editable={isReflectionEditable}
        onChange={(quote) => {
          updateField("quoteOfDay", quote);
          if (quote.trim().length === 0 && currentEntry.isQuoteStarred) {
            updateField("isQuoteStarred", false);
          }
        }}
        onToggleStar={() => updateField("isQuoteStarred", !currentEntry.isQuoteStarred)}
      />

      {/* ── Journal ────────────────────────────────────── */}
      <JournalSection
        key={dateId}
        content={currentEntry.journal}
        editable={isReflectionEditable}
        onChange={(html, wc) => {
          updateField("journal", html);
          updateField("wordCount", wc);
        }}
      />

      {/* ── Habits ─────────────────────────────────────── */}
      <HabitsSection
        habits={habits}
        logs={currentEntry.habitLogs}
        canToggle={isReflectionEditable}
        onChange={(logs) => updateField("habitLogs", logs)}
      />

      {/* ── Todos ──────────────────────────────────────── */}
      <TodosSection
        todos={currentEntry.todos}
        canManage={canManageTodos}
        canToggle={canToggleTodos}
        onChange={(t) => updateField("todos", t)}
      />

      {/* ── Tags ───────────────────────────────────────── */}
      <TagsSection
        tags={currentEntry.tags}
        editable={isReflectionEditable}
        onChange={(t) => updateField("tags", t)}
      />

      <GratitudeSection
        items={currentEntry.gratitude}
        editable={isReflectionEditable}
        onChange={(items) => updateField("gratitude", items)}
      />

      {/* ── Memories ───────────────────────────────────── */}
      <MemoriesSection
        memories={currentEntry.memories}
        editable={isReflectionEditable}
        onChange={(m) => updateField("memories", m)}
      />

      {saveError && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium z-50"
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "rgba(239,68,68,0.9)",
          }}
          onClick={clearSaveError}
        >
          ⚠ Save failed - tap to dismiss
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

/* ── Header ────────────────────────────────────────────────── */

function Header({
  date,
  isToday,
  isHighlight,
  savingText,
  onToggleHighlight,
  onNavigate,
  nextDisabled = false,
  strikethrough = false,
}: {
  dateId: string;
  date: Date;
  isToday: boolean;
  isHighlight: boolean;
  savingText: string;
  onToggleHighlight: () => void;
  onNavigate: (dir: number) => void;
  nextDisabled?: boolean;
  strikethrough?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      {/* Left */}
      <button
        className="btn-ghost p-2"
        onClick={() => onNavigate(-1)}
        title="Previous day"
      >
        <ChevronLeft size={20} />
      </button>

      {/* Center */}
      <div className="flex items-center gap-3 text-center">
        <h1
          className="text-2xl font-serif font-bold"
          style={{
            color: "var(--text-primary)",
            textDecoration: strikethrough ? "line-through" : "none",
            opacity: strikethrough ? 0.6 : 1,
          }}
        >
          {formatDayHeader(date)}
        </h1>
        {isToday && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            Today
          </span>
        )}
        <button
          onClick={onToggleHighlight}
          title="Toggle highlight"
          className="cursor-pointer"
          style={{ background: "none", border: "none" }}
        >
          <Star
            size={20}
            fill={isHighlight ? "var(--accent)" : "none"}
            stroke={isHighlight ? "var(--accent)" : "var(--text-muted)"}
          />
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <span className="saving-indicator">{savingText}</span>
        <button
          className={`btn-ghost p-2${nextDisabled ? " opacity-30 cursor-not-allowed" : ""}`}
          onClick={() => { if (!nextDisabled) onNavigate(1); }}
          disabled={nextDisabled}
          title={nextDisabled ? "Tomorrow hasn't arrived yet" : "Next day"}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

/* ── Date Jumper ──────────────────────────────────────────── */

function DateJumper({
  currentDate,
  onJump,
}: {
  currentDate: Date;
  onJump: (date: Date) => void;
}) {
  const today = new Date();
  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth();
  const monthBounds = getMonthBoundsForYear(selectedYear);
  const availableMonths = MONTH_NAMES
    .map((name, idx) => ({ name, idx }))
    .filter((m) => m.idx >= monthBounds.min && m.idx <= monthBounds.max);

  const handleYearChange = (year: number) => {
    const { min, max } = getMonthBoundsForYear(year);
    const clampedMonth = Math.min(max, Math.max(min, currentDate.getMonth()));
    onJump(new Date(year, clampedMonth, currentDate.getDate()));
  };

  const handleMonthChange = (month: number) => {
    onJump(new Date(currentDate.getFullYear(), month, currentDate.getDate()));
  };

  const jumpToToday = () => {
    onJump(today);
  };

  const jumpToTrialStart = () => {
    onJump(TRIAL_START);
  };

  const jumpToEnd = () => {
    onJump(JOURNAL_END);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      <span style={{ color: "var(--text-muted)" }}>Jump to</span>
      <button
        className="btn-ghost px-3 py-1 text-xs"
        onClick={jumpToToday}
      >
        Today
      </button>
      <button
        className="btn-ghost px-3 py-1 text-xs"
        onClick={jumpToTrialStart}
      >
        {format(TRIAL_START, "MMM yyyy")}
      </button>
      <button
        className="btn-ghost px-3 py-1 text-xs"
        onClick={jumpToEnd}
      >
        {format(JOURNAL_END, "MMM yyyy")}
      </button>
      <select
        value={selectedMonth}
        onChange={(e) => handleMonthChange(Number(e.target.value))}
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
        onChange={(e) => handleYearChange(Number(e.target.value))}
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
  );
}

/* ── Checkpoint Section ───────────────────────────────────── */

function CheckpointSection({
  checks,
  prompts,
  readOnly,
  onToggle,
  onPromptChange,
  onRemovePrompt,
  onAddPrompt,
  onResetPrompts,
}: {
  checks: boolean[];
  prompts: string[];
  readOnly: boolean;
  onToggle: (index: number) => void;
  onPromptChange: (index: number, value: string) => void;
  onRemovePrompt: (index: number) => void;
  onAddPrompt: () => void;
  onResetPrompts: () => void;
}) {
  const score = checks.filter(Boolean).length;
  const hasEmptySlot = prompts.some((prompt) => prompt.trim().length === 0);

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="section-title" style={{ marginBottom: 0 }}>Daily Checkpoints</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            {score}/10
          </span>
          {!readOnly && (
            <>
              <button
                type="button"
                className="btn-ghost text-xs px-2 py-1"
                onClick={onAddPrompt}
                disabled={!hasEmptySlot}
                title={hasEmptySlot ? "Add prompt to an empty slot" : "All 10 prompts already filled"}
              >
                + Add
              </button>
              <button
                type="button"
                className="btn-ghost text-xs px-2 py-1"
                onClick={onResetPrompts}
              >
                Reset Default 10
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        {prompts.map((question, index) => {
          const checked = checks[index] ?? false;
          return (
            <div
              key={`${index}-${question}`}
              className="rounded-xl p-3 transition-all"
              style={{
                background: checked ? "rgba(16,185,129,0.08)" : "var(--bg-secondary)",
                border: checked ? "1px solid rgba(16,185,129,0.35)" : "1px solid var(--border)",
                opacity: readOnly ? 0.9 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    if (!readOnly) onToggle(index);
                  }}
                  className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border"
                  style={{
                    background: checked ? "var(--accent)" : "transparent",
                    borderColor: checked ? "var(--accent)" : "var(--border)",
                    color: checked ? "#000" : "var(--text-muted)",
                  }}
                  title={`Toggle checkpoint ${index + 1}`}
                >
                  {checked ? "✓" : String(index + 1)}
                </button>
                <div className="flex-1">
                  {readOnly ? (
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {question || "Checkpoint removed"}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => onPromptChange(index, e.target.value.slice(0, 180))}
                      placeholder={`Checkpoint ${index + 1}`}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => onRemovePrompt(index)}
                    title={`Remove checkpoint ${index + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        You always have 10 checkpoints. Remove clears a slot, Add refills an empty slot.
      </p>
    </section>
  );
}

function QuoteSection({
  quote,
  starred,
  editable,
  onChange,
  onToggleStar,
}: {
  quote: string;
  starred: boolean;
  editable: boolean;
  onChange: (value: string) => void;
  onToggleStar: () => void;
}) {
  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="section-title" style={{ marginBottom: 0 }}>Quote of the Day</h3>
        <button
          type="button"
          disabled={!editable || quote.trim().length === 0}
          onClick={onToggleStar}
          className="btn-ghost text-xs px-2 py-1"
          title={starred ? "Unstar quote" : "Star quote"}
        >
          {starred ? "★ Starred" : "☆ Star"}
        </button>
      </div>
      {editable ? (
        <textarea
          value={quote}
          onChange={(e) => onChange(e.target.value.slice(0, 400))}
          placeholder="Write a quote you want to remember from today..."
          className="w-full min-h-[92px] rounded-xl px-3 py-2 text-sm"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        />
      ) : (
        <p className="text-sm italic" style={{ color: "var(--text-secondary)" }}>
          {quote.trim().length > 0 ? `"${quote.trim()}"` : "No quote added for this day."}
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Starred quotes appear on the dashboard.
      </p>
    </section>
  );
}

/* ── Journal Section ───────────────────────────────────────── */

function JournalSection({
  content,
  editable,
  onChange,
}: {
  content: string;
  editable: boolean;
  onChange: (html: string, wordCount: number) => void;
}) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Placeholder.configure({ placeholder: "Write about your day..." }),
      ImageExt,
    ],
    content,
    editorProps: {
      attributes: {
        class: "journal-editor-content",
        spellcheck: "true",
        autocapitalize: "sentences",
        autocomplete: "on",
        autocorrect: "on",
      },
    },
    editable,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const text = ed.state.doc.textContent;
      const wc = text.trim() ? text.trim().split(/\s+/).length : 0;
      onChangeRef.current(html, wc);
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;

  const tb = (
    active: boolean,
    onClick: () => void,
    Icon: React.ComponentType<{ size?: number }>,
    title: string,
  ) => (
    <button
      onClick={onClick}
      title={title}
      className="btn-ghost p-1.5"
      style={active ? { color: "var(--accent)", borderColor: "var(--accent)" } : {}}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <section className="space-y-3">
      <h3 className="section-title">Journal</h3>
      {/* Toolbar */}
      {editable && (
        <div
          className="journal-toolbar flex gap-1 overflow-x-auto rounded-t-xl px-2 py-2"
          style={{
            background: "var(--bg-card)",
            borderTop: "1px solid var(--border)",
            borderLeft: "1px solid var(--border)",
            borderRight: "1px solid var(--border)",
          }}
        >
          {tb(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), Bold, "Bold")}
          {tb(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), Italic, "Italic")}
          {tb(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1, "Heading 1")}
          {tb(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, "Heading 2")}
          {tb(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), List, "Bullet List")}
          {tb(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered, "Ordered List")}
          {tb(editor.isActive("taskList"), () => editor.chain().focus().toggleTaskList().run(), CheckSquare, "Checklist")}
          {tb(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), Quote, "Quote")}
          {tb(false, () => editor.chain().focus().setHorizontalRule().run(), Minus, "Divider")}
        </div>
      )}
      {/* Editor */}
      <div
        className={`journal-editor-shell min-h-[320px] p-4 max-w-none ${editable ? "rounded-b-xl cursor-text" : "rounded-xl"}`}
        style={{
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderTop: editable ? "none" : "1px solid var(--border)",
        }}
        onClick={() => {
          if (editable) editor.commands.focus();
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}



/* ── Habits Section ────────────────────────────────────────── */

function HabitsSection({
  habits,
  logs,
  canToggle,
  onChange,
}: {
  habits: { id: string; name: string; icon: string; color: string }[];
  logs: HabitLog[];
  canToggle: boolean;
  onChange: (logs: HabitLog[]) => void;
}) {
  if (habits.length === 0) {
    return (
      <section className="card p-5">
        <h3 className="section-title">Habits</h3>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No habits yet — add some in Settings
        </p>
      </section>
    );
  }

  const isCompleted = (habitId: string) =>
    logs.find((l) => l.habitId === habitId)?.completed ?? false;

  const toggle = (habitId: string) => {
    const existing = logs.find((l) => l.habitId === habitId);
    if (existing) {
      onChange(
        logs.map((l) =>
          l.habitId === habitId ? { ...l, completed: !l.completed } : l,
        ),
      );
    } else {
      onChange([...logs, { habitId, completed: true }]);
    }
  };

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title" style={{ marginBottom: 0 }}>Habits</h3>
        {!canToggle && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Toggle opens at 8:00 PM
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {habits.map((h) => {
          const done = isCompleted(h.id);
          return (
            <button
              key={h.id}
              onClick={() => {
                if (canToggle) toggle(h.id);
              }}
              className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all cursor-pointer text-left"
              disabled={!canToggle}
              style={{
                background: done
                  ? "rgba(16,185,129,0.1)"
                  : "var(--bg-secondary)",
                border: done
                  ? "1px solid rgba(16,185,129,0.3)"
                  : "1px solid var(--border)",
                color: "var(--text-primary)",
                opacity: canToggle ? 1 : 0.7,
                cursor: canToggle ? "pointer" : "not-allowed",
              }}
            >
              <span className="text-lg">{h.icon}</span>
              <span className="flex-1 text-sm font-medium">{h.name}</span>
              {done && (
                <span style={{ color: "var(--accent)" }} className="text-lg">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ── Todos Section ─────────────────────────────────────────── */

function TodosSection({
  todos,
  canManage,
  canToggle,
  onChange,
}: {
  todos: Todo[];
  canManage: boolean;
  canToggle: boolean;
  onChange: (todos: Todo[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    onChange([
      ...todos,
      {
        id: crypto.randomUUID(),
        text,
        completed: false,
      },
    ]);
    setInput("");
  };

  const toggleTodo = (id: string) =>
    onChange(
      todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );

  const deleteTodo = (id: string) => onChange(todos.filter((t) => t.id !== id));

  const completed = todos.filter((t) => t.completed).length;

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          To-Do
        </h3>
        {todos.length > 0 && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {completed}/{todos.length} complete
          </span>
        )}
      </div>

      {/* Add input */}
      <div className="flex gap-2">
        <input
          className="input-base flex-1"
          placeholder="Add a to-do..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          disabled={!canManage}
        />
        <button className="btn-primary" onClick={addTodo} disabled={!canManage}>
          <Plus size={16} />
        </button>
      </div>
      {!canManage && canToggle && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Add/delete is locked after 8:00 PM. You can still mark done/undone until 12:00 PM next day.
        </p>
      )}
      {!canToggle && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          This to-do list is now locked.
        </p>
      )}

      {/* List */}
      <ul className="space-y-1">
        {todos.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 group rounded-lg px-3 py-2 transition-colors"
            style={{ background: "var(--bg-secondary)" }}
          >
            <input
              type="checkbox"
              checked={t.completed}
              onChange={() => toggleTodo(t.id)}
              className="accent-amber-500 w-4 h-4 cursor-pointer"
              disabled={!canToggle}
            />
            <span
              className="flex-1 text-sm"
              style={{
                textDecoration: t.completed ? "line-through" : "none",
                color: t.completed
                  ? "var(--text-muted)"
                  : "var(--text-primary)",
              }}
            >
              {t.text}
            </span>
            <button
              onClick={() => deleteTodo(t.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              disabled={!canManage}
              style={{
                color: "var(--text-muted)",
                background: "none",
                border: "none",
              }}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Tags Section ──────────────────────────────────────────── */

function TagsSection({
  tags,
  editable,
  onChange,
}: {
  tags: string[];
  editable: boolean;
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const tag = input.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      setInput("");
      return;
    }
    onChange([...tags, tag]);
    setInput("");
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <section className="card p-5 space-y-3">
      <h3 className="section-title">Tags</h3>
      <input
        className="input-base"
        placeholder="Type a tag and press Enter..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && addTag()}
        disabled={!editable}
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="tag-chip flex items-center gap-1">
              #{tag}
              <button
                onClick={() => removeTag(tag)}
                className="cursor-pointer"
                disabled={!editable}
                style={{ background: "none", border: "none", color: "inherit" }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function GratitudeSection({
  items,
  editable,
  onChange,
}: {
  items: string[];
  editable: boolean;
  onChange: (items: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const val = input.trim();
    if (!val || items.length >= 3) return;
    onChange([...items, val]);
    setInput("");
  };

  const remove = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
  };

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          🙏 Gratitude
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {items.length}/3
        </span>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        What are 3 things you're grateful for today?
      </p>

      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "var(--bg-secondary)" }}
        >
          <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>
            {i + 1}. {item}
          </span>
          <button
            onClick={() => remove(i)}
            disabled={!editable}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}

      {items.length < 3 && (
        <div className="flex gap-2">
          <input
            className="input-base flex-1"
            placeholder={`Grateful for #${items.length + 1}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            disabled={!editable}
          />
          <button className="btn-primary" onClick={add} disabled={!editable}>
            <Plus size={16} />
          </button>
        </div>
      )}
    </section>
  );
}

/* ── Memories Section ──────────────────────────────────────── */

function MemoriesSection({
  memories,
  editable,
  onChange,
}: {
  memories: Memory[];
  editable: boolean;
  onChange: (memories: Memory[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [memType, setMemType] = useState<Memory["type"]>("text");
  const [content, setContent] = useState("");
  const [caption, setCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const addMemory = () => {
    if (!content.trim()) return;
    onChange([
      ...memories,
      {
        id: crypto.randomUUID(),
        type: memType,
        content: content.trim(),
        caption: caption.trim(),
        createdAt: new Date().toISOString(),
      },
    ]);
    setContent("");
    setCaption("");
    setShowForm(false);
  };

  const deleteMemory = (id: string) =>
    onChange(memories.filter((m) => m.id !== id));

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setContent(reader.result);
        }
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const types: Memory["type"][] = ["text", "image", "video", "link"];

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          Memories
        </h3>
        <button
          className="btn-ghost text-sm flex items-center gap-1"
          disabled={!editable}
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={14} /> Add Memory
        </button>
      </div>

      {/* Add form */}
      {editable && showForm && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Type selector */}
          <div className="flex gap-2">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setMemType(t);
                  setContent("");
                }}
                className="px-3 py-1 rounded-full text-xs font-medium capitalize cursor-pointer transition-all"
                style={{
                  background: memType === t ? "var(--accent-subtle)" : "transparent",
                  color: memType === t ? "var(--accent)" : "var(--text-secondary)",
                  border:
                    memType === t
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border)",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Content input */}
          {memType === "text" ? (
            <textarea
              className="input-base min-h-[80px] resize-y"
              placeholder="Write your memory..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          ) : (
            <div className="space-y-2">
              <input
                className="input-base"
                placeholder={
                  memType === "image"
                    ? "Image URL or upload below"
                    : memType === "video"
                      ? "YouTube or video URL"
                      : "Paste a link URL"
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              {memType === "image" && (
                <>
                  <button
                    className="btn-ghost text-xs flex items-center gap-1"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload size={12} /> Upload Image
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </>
              )}
            </div>
          )}

          {/* Caption */}
          <input
            className="input-base"
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />

          <div className="flex gap-2">
            <button className="btn-primary text-sm" onClick={addMemory}>
              Save Memory
            </button>
            <button
              className="btn-ghost text-sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Memory list */}
      {memories.length > 0 && (
        <div className="space-y-3">
          {memories.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              canDelete={editable}
              onDelete={deleteMemory}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Single Memory Card ────────────────────────────────────── */

function MemoryCard({
  memory,
  canDelete,
  onDelete,
}: {
  memory: Memory;
  canDelete?: boolean;
  onDelete: (id: string) => void;
}) {
  const isYouTube =
    memory.type === "video" &&
    (memory.content.includes("youtube.com") ||
      memory.content.includes("youtu.be"));

  const youtubeId = isYouTube
    ? memory.content.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?/]+)/,
      )?.[1]
    : null;

  return (
    <div className="card p-4 relative group">
      {/* Delete button */}
      {canDelete && (
        <button
          onClick={() => onDelete(memory.id)}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          style={{ color: "var(--text-muted)", background: "none", border: "none" }}
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Content */}
      {memory.type === "text" && (
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {memory.content}
        </p>
      )}

      {memory.type === "image" && (
        <img
          src={memory.content}
          alt={memory.caption || "Memory"}
          className="rounded-lg max-h-64 object-cover w-full"
        />
      )}

      {memory.type === "video" && youtubeId && (
        <div className="aspect-video rounded-lg overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={memory.caption || "Video"}
          />
        </div>
      )}

      {memory.type === "video" && !youtubeId && (
        <a
          href={memory.content}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--accent)" }}
        >
          {memory.content} <ExternalLink size={12} />
        </a>
      )}

      {memory.type === "link" && (
        <a
          href={memory.content}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--accent)" }}
        >
          {memory.content} <ExternalLink size={12} />
        </a>
      )}

      {/* Caption */}
      {memory.caption && (
        <p
          className="text-xs mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {memory.caption}
        </p>
      )}
    </div>
  );
}
