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

import { isAfter, startOfDay, parseISO, addDays, format, differenceInCalendarDays } from "date-fns";

import { useEntryStore } from "../store/entryStore";
import { useHabitStore } from "../store/habitStore";
import { useRedemptionStore } from "../store/redemptionStore";
import {
  formatDayHeader,
  isValidJournalDate,
  dateToId,
  getTodayDateId,
} from "../utils/dates";
import type { Todo, Memory, HabitLog, DayEntry as DayEntryType } from "../db";

/* ── Mood config ──────────────────────────────────────────── */

const moodColors = [
  "#4B5563",        // 0 - dark grey (wasted)
  "var(--mood-1)",
  "var(--mood-2)",
  "var(--mood-3)",
  "var(--mood-4)",
  "var(--mood-5)",
  "var(--mood-6)",
  "var(--mood-7)",
  "var(--mood-8)",
  "var(--mood-9)",
  "var(--mood-10)",
];

const ratingMoodMap: Record<number, { emoji: string; label: string }> = {
  0:  { emoji: "💀", label: "Lost" },
  1:  { emoji: "😔", label: "Terrible" },
  2:  { emoji: "😞", label: "Rough" },
  3:  { emoji: "😕", label: "Bad" },
  4:  { emoji: "😐", label: "Meh" },
  5:  { emoji: "🙂", label: "Okay" },
  6:  { emoji: "😊", label: "Good" },
  7:  { emoji: "😄", label: "Great" },
  8:  { emoji: "🌟", label: "Excellent" },
  9:  { emoji: "🔥", label: "Amazing" },
  10: { emoji: "✨", label: "Legendary" },
};

/* ── Helpers ──────────────────────────────────────────────── */

function addDaysToId(dateId: string, days: number): string {
  const d = new Date(dateId + "T00:00:00");
  d.setDate(d.getDate() + days);
  return dateToId(d);
}

function dateFromId(dateId: string): Date {
  return new Date(dateId + "T00:00:00");
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
    isSaving,
    lastSaved,
    loadEntry,
    saveEntry,
    updateField,
    clearCurrentEntry,
  } = useEntryStore();

  const { habits, loadHabits } = useHabitStore();
  const {
    lastRedemptionDate,
    loadRedemptions,
    claimRedemption,
    remaining: redemptionsRemaining,
  } = useRedemptionStore();

  const [redemptionMsg, setRedemptionMsg] = useState<string | null>(null);

  /* ── Refs for auto-save ───────────────────────────────── */
  const hasModified = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  /* ── Load entry + habits on mount / dateId change ─────── */
  useEffect(() => {
    isInitialLoad.current = true;
    hasModified.current = false;
    loadEntry(dateId);
    loadHabits();
    loadRedemptions();
    setRedemptionMsg(null);
    return () => {
      clearCurrentEntry();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateId]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEntry]);

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

  if (!isValidJournalDate(date)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
          This date is outside your 1000-day journey
        </p>
        <button
          className="btn-primary"
          onClick={() => navigate(`/entry/${getTodayDateId()}`)}
        >
          Back to Today
        </button>
      </div>
    );
  }

  if (isLoading || !currentEntry) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  const isToday = dateId === getTodayDateId();
  const currentHour = new Date().getHours();
  const isTooEarly = isToday && currentHour < 20;

  const yesterdayId = dateToId(addDays(new Date(), -1));
  const isYesterday = dateId === yesterdayId;
  const graceExpired = isYesterday && currentHour >= 12;

  /* ── Countdown for "too early" lock ───────────────────── */
  const [countdown, setCountdown] = useState(() => getCountdownToHour(20));
  useEffect(() => {
    if (!isTooEarly) return;
    const id = setInterval(() => setCountdown(getCountdownToHour(20)), 60_000);
    return () => clearInterval(id);
  }, [isTooEarly]);

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
        moodEmoji: "😕",
        updatedAt: new Date().toISOString(),
      };
      saveEntry(updated);
      setWasAutoRated(true);
    }
  }, [graceExpired, currentEntry, saveEntry]);

  /* ── Today too early locked state ────────────────────── */
  if (isTooEarly) {
    return (
      <div className="page-transition max-w-3xl mx-auto pb-20 space-y-8">
        <Header
          dateId={dateId}
          date={date}
          isToday={true}
          isHighlight={currentEntry.isHighlight}
          savingText=""
          onToggleHighlight={() => {}}
          onNavigate={(dir) => navigate(`/entry/${addDaysToId(dateId, dir)}`)}
          nextDisabled={true}
        />

        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="card p-10 flex flex-col items-center gap-5 text-center max-w-md w-full">
            <span className="text-5xl" style={{ color: "var(--accent)" }}>🕗</span>
            <h2
              className="text-2xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              A little early...
            </h2>
            <p style={{ color: "var(--text-muted)" }}>
              Today&apos;s entry unlocks at 8:00 PM.{" "}
              Live your day first, then reflect on it.
            </p>
            {countdown && (
              <p className="text-lg font-semibold" style={{ color: "var(--accent)" }}>
                Unlocks in {countdown}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Yesterday grace expired — read-only state ───────── */
  if (graceExpired) {
    const mood = ratingMoodMap[wasAutoRated ? 3 : currentEntry.moodRating];
    const displayRating = wasAutoRated ? 3 : currentEntry.moodRating;
    return (
      <div className="page-transition max-w-3xl mx-auto pb-20 space-y-8">
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

        {/* Lock notice */}
        <div className="card p-6 flex flex-col items-center gap-4 text-center">
          <span className="text-4xl">🔒</span>
          <h2
            className="text-xl font-serif font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Yesterday&apos;s entry is now locked
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            The grace period ended at noon.
          </p>
          {wasAutoRated && (
            <p
              className="text-sm font-medium px-4 py-2 rounded-lg"
              style={{ color: "rgba(245,158,11,0.9)", background: "rgba(245,158,11,0.08)" }}
            >
              ⚡ This day was automatically rated 3/10 since it wasn&apos;t rated before noon.
            </p>
          )}
        </div>

        {/* Read-only mood */}
        <section className="card p-5 space-y-4">
          <h3 className="section-title">How was your day?</h3>
          <div className="flex gap-2 flex-wrap">
            {moodColors.map((color, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: color,
                  opacity: displayRating === i ? 1 : 0.2,
                  color: i === 0 ? "#fff" : "#000",
                }}
              >
                {i}
              </div>
            ))}
          </div>
          {mood && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl">{mood.emoji}</span>
              <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                {mood.label}
              </span>
            </div>
          )}
        </section>

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

  /* ── Redeemed date locked state ──────────────────────── */
  if (currentEntry.isRedeemed) {
    const replacementDate = currentEntry.redemptionDayId
      ? format(new Date(currentEntry.redemptionDayId + "T00:00:00"), "MMMM d, yyyy")
      : "a December 2028 day";
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
          nextDisabled={nextIsFuture}
          strikethrough
        />

        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div
            className="card p-10 flex flex-col items-center gap-5 text-center max-w-md w-full"
          >
            <span className="text-5xl" style={{ color: "var(--danger, #EF4444)" }}>🚫</span>
            <h2
              className="text-2xl font-serif font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              This day was redeemed
            </h2>
            <p style={{ color: "var(--text-muted)" }}>
              It has been replaced by{" "}
              <span style={{ color: "var(--text-secondary)" }}>
                {replacementDate}
              </span>{" "}
              and no longer counts toward your 1000-day journey
            </p>
            {currentEntry.redemptionDayId && (
              <button
                className="btn-primary mt-2"
                onClick={() => navigate(`/entry/${currentEntry.redemptionDayId}`)}
              >
                Go to replacement day →
              </button>
            )}
          </div>
        </div>
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

      {/* ── Mood ───────────────────────────────────────── */}
      <MoodSection
        rating={currentEntry.moodRating}
        onRate={(r) => {
          if (r === currentEntry.moodRating) {
            updateField("moodRating", -1);
            updateField("moodEmoji", "");
          } else {
            updateField("moodRating", r);
            updateField("moodEmoji", ratingMoodMap[r]?.emoji ?? "");
          }
        }}
      />

      {/* ── Redemption Prompt ──────────────────────────── */}
      <RedemptionPrompt
        entry={currentEntry}
        redemptionsRemaining={redemptionsRemaining()}
        lastRedemptionDate={lastRedemptionDate}
        redemptionMsg={redemptionMsg}
        onClaim={async () => {
          const result = await claimRedemption(dateId);
          if (result.ok) {
            const r = result.redemption;
            updateField("isRedeemed", true);
            updateField("redemptionDayId", r.id);
            // Force immediate save
            const updated = {
              ...currentEntry,
              isRedeemed: true,
              redemptionDayId: r.id,
              updatedAt: new Date().toISOString(),
            };
            await saveEntry(updated);
            const decDay = parseInt(r.id.slice(-2), 10);
            setRedemptionMsg(
              `Redemption Day Dec ${decDay} has been assigned. This day will not count toward your 1000 days.`,
            );
          } else if (result.reason === "cooldown") {
            const d = new Date(result.availableDate + "T00:00:00");
            setRedemptionMsg(
              `Cooldown active. Next redemption available: ${format(d, "MMMM d, yyyy")}`,
            );
          } else {
            setRedemptionMsg("All 21 redemption days have been used.");
          }
        }}
        onDismiss={() => setRedemptionMsg(null)}
      />

      {/* ── Journal ────────────────────────────────────── */}
      <JournalSection
        content={currentEntry.journal}
        onChange={(html, wc) => {
          updateField("journal", html);
          updateField("wordCount", wc);
        }}
      />

      {/* ── Habits ─────────────────────────────────────── */}
      <HabitsSection
        habits={habits}
        logs={currentEntry.habitLogs}
        onChange={(logs) => updateField("habitLogs", logs)}
      />

      {/* ── Todos ──────────────────────────────────────── */}
      <TodosSection
        todos={currentEntry.todos}
        onChange={(t) => updateField("todos", t)}
      />

      {/* ── Tags ───────────────────────────────────────── */}
      <TagsSection
        tags={currentEntry.tags}
        onChange={(t) => updateField("tags", t)}
      />

      {/* ── Memories ───────────────────────────────────── */}
      <MemoriesSection
        memories={currentEntry.memories}
        onChange={(m) => updateField("memories", m)}
      />
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

/* ── Mood Section ──────────────────────────────────────────── */

function MoodSection({
  rating,
  onRate,
}: {
  rating: number;
  onRate: (r: number) => void;
}) {
  const mood = ratingMoodMap[rating];

  return (
    <section className="card p-5 space-y-4">
      <h3 className="section-title">How was your day?</h3>
      {/* Number buttons 0-10 */}
      <div className="flex gap-2 flex-wrap">
        {moodColors.map((color, i) => {
          const n = i; // 0 through 10
          const selected = rating === n;
          return (
            <button
              key={n}
              onClick={() => onRate(n)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
              style={{
                background: color,
                opacity: selected ? 1 : 0.2,
                color: n === 0 ? "#fff" : "#000",
                border: "none",
                boxShadow: selected ? `0 0 0 3px ${color}44` : "none",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {/* Auto-mapped emoji display */}
      {mood && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">{mood.emoji}</span>
          <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            {mood.label}
          </span>
        </div>
      )}
    </section>
  );
}

/* ── Redemption Prompt ─────────────────────────────────────── */

function RedemptionPrompt({
  entry,
  redemptionsRemaining,
  lastRedemptionDate,
  redemptionMsg,
  onClaim,
  onDismiss,
}: {
  entry: DayEntryType;
  redemptionsRemaining: number;
  lastRedemptionDate: string | null;
  redemptionMsg: string | null;
  onClaim: () => void;
  onDismiss: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when entry changes
  useEffect(() => {
    setDismissed(false);
  }, [entry.id]);

  // Show redemption result message
  if (redemptionMsg) {
    return (
      <section
        className="card p-5 space-y-3"
        style={{ border: "1px solid rgba(245,158,11,0.4)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {redemptionMsg}
        </p>
        <button className="btn-ghost text-sm" onClick={onDismiss}>
          Dismiss
        </button>
      </section>
    );
  }

  // Already redeemed
  if (entry.isRedeemed) {
    const decDay = entry.redemptionDayId
      ? parseInt(entry.redemptionDayId.slice(-2), 10)
      : "?";
    return (
      <section
        className="card p-5"
        style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          ⚠ This day has been redeemed → replaced by Redemption Day Dec {decDay}
        </p>
      </section>
    );
  }

  // Only show prompt for ratings 0, 1, or 2 (explicit check to handle 0 being falsy)
  if (dismissed) return null;
  if (!(entry.moodRating === 0 || entry.moodRating === 1 || entry.moodRating === 2)) return null;

  // Calculate cooldown
  let cooldownMsg: string | null = null;
  let isCooldown = false;
  if (lastRedemptionDate) {
    const daysSince = differenceInCalendarDays(
      new Date(),
      new Date(lastRedemptionDate + "T00:00:00"),
    );
    if (daysSince < 10) {
      isCooldown = true;
      const availDate = addDays(new Date(lastRedemptionDate + "T00:00:00"), 10);
      cooldownMsg = `Next redemption available: ${format(availDate, "MMMM d, yyyy")}`;
    }
  }

  return (
    <section
      className="card p-5 space-y-3"
      style={{ border: "2px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.03)" }}
    >
      <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
        ⚠ This day is marked as difficult
      </p>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Would you like to use a Redemption Day to replace it?
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {redemptionsRemaining} redemption day{redemptionsRemaining !== 1 ? "s" : ""} remaining (of 21)
      </p>
      {cooldownMsg && (
        <p className="text-xs font-medium" style={{ color: "var(--mood-3)" }}>
          {cooldownMsg}
        </p>
      )}
      <div className="flex gap-3">
        <button
          className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
          style={{
            background: isCooldown || redemptionsRemaining === 0 ? "var(--bg-secondary)" : "rgba(239,68,68,0.8)",
            color: isCooldown || redemptionsRemaining === 0 ? "var(--text-muted)" : "#fff",
            border: "none",
            opacity: isCooldown || redemptionsRemaining === 0 ? 0.5 : 1,
            cursor: isCooldown || redemptionsRemaining === 0 ? "not-allowed" : "pointer",
          }}
          disabled={isCooldown || redemptionsRemaining === 0}
          onClick={onClaim}
        >
          Use Redemption Day
        </button>
        <button
          className="btn-ghost text-sm"
          onClick={() => setDismissed(true)}
        >
          Keep as is
        </button>
      </div>
    </section>
  );
}

/* ── Journal Section ───────────────────────────────────────── */

function JournalSection({
  content,
  onChange,
}: {
  content: string;
  onChange: (html: string, wordCount: number) => void;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Placeholder.configure({ placeholder: "Write about your day..." }),
      ImageExt,
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const text = ed.state.doc.textContent;
      const wc = text.trim() ? text.trim().split(/\s+/).length : 0;
      onChangeRef.current(html, wc);
    },
  });

  /* Sync editor content when navigating to a different day */
  const prevContent = useRef(content);
  useEffect(() => {
    if (editor && content !== prevContent.current) {
      const cursorPos = editor.state.selection.anchor;
      editor.commands.setContent(content, { emitUpdate: false });
      /* Restore cursor if within range */
      const maxPos = editor.state.doc.content.size;
      editor.commands.focus();
      if (cursorPos <= maxPos) {
        editor.commands.setTextSelection(cursorPos);
      }
      prevContent.current = content;
    }
  }, [content, editor]);

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
      <div
        className="flex gap-1 flex-wrap rounded-t-xl px-3 py-2"
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
      {/* Editor */}
      <div
        className="rounded-b-xl min-h-[300px] p-4 prose prose-invert max-w-none cursor-text"
        style={{
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderTop: "none",
        }}
        onClick={() => editor.commands.focus()}
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
  onChange,
}: {
  habits: { id: string; name: string; icon: string; color: string }[];
  logs: HabitLog[];
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
      <h3 className="section-title">Habits</h3>
      <div className="grid grid-cols-2 gap-2">
        {habits.map((h) => {
          const done = isCompleted(h.id);
          return (
            <button
              key={h.id}
              onClick={() => toggle(h.id)}
              className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all cursor-pointer text-left"
              style={{
                background: done
                  ? "rgba(16,185,129,0.1)"
                  : "var(--bg-secondary)",
                border: done
                  ? "1px solid rgba(16,185,129,0.3)"
                  : "1px solid var(--border)",
                color: "var(--text-primary)",
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
  onChange,
}: {
  todos: Todo[];
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
        rolledOver: false,
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
        />
        <button className="btn-primary" onClick={addTodo}>
          <Plus size={16} />
        </button>
      </div>

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
  onChange,
}: {
  tags: string[];
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
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="tag-chip flex items-center gap-1">
              #{tag}
              <button
                onClick={() => removeTag(tag)}
                className="cursor-pointer"
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

/* ── Memories Section ──────────────────────────────────────── */

function MemoriesSection({
  memories,
  onChange,
}: {
  memories: Memory[];
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
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={14} /> Add Memory
        </button>
      </div>

      {/* Add form */}
      {showForm && (
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
            <MemoryCard key={m.id} memory={m} onDelete={deleteMemory} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Single Memory Card ────────────────────────────────────── */

function MemoryCard({
  memory,
  onDelete,
}: {
  memory: Memory;
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
      <button
        onClick={() => onDelete(memory.id)}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        style={{ color: "var(--text-muted)", background: "none", border: "none" }}
      >
        <Trash2 size={14} />
      </button>

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
