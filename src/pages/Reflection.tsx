import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExt from "@tiptap/extension-image";
import {
  format,
  differenceInCalendarDays,
  getYear,
  eachMonthOfInterval,
  parseISO,
} from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Minus,
  ChevronDown,
  ChevronUp,
  X,
  Upload,
  Plus,
} from "lucide-react";

import storage from "../storage";
import { ORIGIN, JOURNAL_END, TOTAL_JOURNAL_DAYS } from "../utils/dates";
import { stripHtml } from "../utils/html";
import type { DayEntry, ReflectionEntry } from "../db";

/* ── Constants ──────────────────────────────────────────────── */

const REFLECTION_UNLOCK = JOURNAL_END;
const JOURNEY_START = ORIGIN;
const TOTAL_DAYS = TOTAL_JOURNAL_DAYS;

const PROMPTS = [
  "What were the 10 most important moments of this journey?",
  "What did you learn about yourself that surprised you?",
  "Which habits served you? Which ones hurt you?",
  "What relationships grew, and which ones faded?",
  "What do you want to leave behind as you move forward?",
  "What are your intentions for the next chapter of your life?",
];

type YearTabKey = `year-${number}`;
type Tab = "overview" | "prompts" | "vision" | YearTabKey;

const YEAR_TABS = Array.from(
  { length: JOURNAL_END.getFullYear() - ORIGIN.getFullYear() + 1 },
  (_, i) => ORIGIN.getFullYear() + i,
);

function toYearTabKey(year: number): YearTabKey {
  return `year-${year}`;
}

function isYearTab(tab: Tab): tab is YearTabKey {
  return tab.startsWith("year-");
}

function yearFromTab(tab: YearTabKey): number {
  return Number(tab.slice(5));
}

interface VisionItem {
  id: string;
  type: "text" | "image" | "goal";
  content: string;
  title?: string;
  targetDate?: string;
}

/* ── Helpers ────────────────────────────────────────────────── */

function wordCount(html: string): number {
  const t = stripHtml(html).trim();
  return t ? t.split(/\s+/).length : 0;
}

function moodCssVar(r: number): string {
  return `var(--mood-${Math.min(10, Math.max(1, Math.round(r)))})`;
}

type ChartTooltipPayload = {
  color?: string;
  name?: string;
  value?: string | number;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string | number;
};

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "var(--text-secondary)" }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function Reflection() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [reflections, setReflections] = useState<Map<string, string>>(new Map());
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [visionItems, setVisionItems] = useState<VisionItem[]>([]);

  const isUnlocked = useMemo(() => new Date() >= REFLECTION_UNLOCK, []);
  const daysRemaining = useMemo(
    () => Math.max(0, differenceInCalendarDays(REFLECTION_UNLOCK, new Date())),
    [],
  );
  const journeyProgress = useMemo(() => {
    const elapsed = differenceInCalendarDays(new Date(), JOURNEY_START);
    return Math.min(100, Math.max(0, (elapsed / TOTAL_DAYS) * 100));
  }, []);

  /* ── Load data on mount ─────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const [allEntries, allReflections] = await Promise.all([
        storage.getAllEntries(),
        storage.getAllReflections(),
      ]);

      setEntries(allEntries.sort((a, b) => a.id.localeCompare(b.id)));

      const refMap = new Map<string, string>();
      for (const r of allReflections) {
        refMap.set(r.promptId, r.content);
      }
      setReflections(refMap);

      // Load vision items
      const visionEntry = allReflections.find((r) => r.promptId === "vision-board");
      if (visionEntry) {
        try {
          setVisionItems(JSON.parse(visionEntry.content));
        } catch { /* empty */ }
      }

      setIsLoading(false);
    })();
  }, []);

  /* ── Save reflection helper ─────────────────────────────── */
  const saveReflection = useCallback(
    async (promptId: string, content: string) => {
      const entry: ReflectionEntry = {
        id: promptId,
        promptId,
        content,
        updatedAt: new Date().toISOString(),
      };
      await storage.saveReflection(entry);
      setReflections((prev) => {
        const next = new Map(prev);
        next.set(promptId, content);
        return next;
      });
    },
    [],
  );

  /* ── Loading ────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  /* ── LOCKED STATE ───────────────────────────────────────── */
  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-20 max-w-xl mx-auto space-y-6">
        {/* Lock icon with amber glow */}
        <div
          className="text-7xl"
          style={{
            filter: "drop-shadow(0 0 24px rgba(245,158,11,0.35))",
          }}
        >
          🔒
        </div>

        <h1
          className="text-3xl font-serif font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          The Reflection Chamber
        </h1>

        <p style={{ color: "var(--text-secondary)" }}>
          This space unlocks on <strong>{format(REFLECTION_UNLOCK, "MMMM d, yyyy")}</strong> — when your
          {TOTAL_DAYS}-day journey is complete.
        </p>

        <p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
          {daysRemaining} days remaining
        </p>

        {/* Progress bar */}
        <div className="w-full space-y-1">
          <div
            className="w-full h-2.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-secondary)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${journeyProgress}%`,
                background: "var(--accent)",
              }}
            />
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {journeyProgress.toFixed(0)}% of journey completed
          </p>
        </div>

        {/* Preview prompts */}
        <div className="w-full pt-6 space-y-3 text-left">
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            Preview upcoming prompts
          </p>
          <ol className="space-y-2 list-decimal list-inside">
            {PROMPTS.map((p, i) => (
              <li
                key={i}
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {p}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  /* ── UNLOCKED: TABBED VIEW ──────────────────────────────── */
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    ...YEAR_TABS.map((year) => ({ key: toYearTabKey(year) as Tab, label: String(year) })),
    { key: "prompts", label: "Prompts" },
    { key: "vision", label: "Vision" },
  ];

  return (
    <div className="page-transition max-w-4xl mx-auto space-y-8 pb-20">
      <h1
        className="text-3xl font-serif font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        Reflection
      </h1>

      {/* Tabs */}
      <div
        className="flex gap-6 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="pb-2 text-sm font-medium transition-colors cursor-pointer shrink-0"
            style={{
              color: activeTab === t.key ? "var(--text-primary)" : "var(--text-muted)",
              background: "none",
              border: "none",
              borderBottomWidth: 2,
              borderBottomStyle: "solid",
              borderBottomColor: activeTab === t.key ? "var(--accent)" : "transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab entries={entries} navigate={navigate} />
      )}
      {isYearTab(activeTab) && (
        <YearTab
          year={yearFromTab(activeTab)}
          entries={entries}
          reflections={reflections}
          saveReflection={saveReflection}
          navigate={navigate}
        />
      )}
      {activeTab === "prompts" && (
        <PromptsTab reflections={reflections} saveReflection={saveReflection} />
      )}
      {activeTab === "vision" && (
        <VisionTab
          visionItems={visionItems}
          setVisionItems={setVisionItems}
          saveReflection={saveReflection}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB: OVERVIEW
   ═══════════════════════════════════════════════════════════════ */

function OverviewTab({
  entries,
  navigate,
}: {
  entries: DayEntry[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const totalEntries = entries.length;
  const totalWords = useMemo(
    () => entries.reduce((s, e) => s + e.wordCount, 0),
    [entries],
  );
  const totalMemories = useMemo(
    () => entries.reduce((s, e) => s + e.memories.length, 0),
    [entries],
  );
  const rated = useMemo(
    () => entries.filter((e) => e.moodRating > 0),
    [entries],
  );
  const avgMood = useMemo(
    () => (rated.length ? rated.reduce((s, e) => s + e.moodRating, 0) / rated.length : 0),
    [rated],
  );

  const highlights = useMemo(
    () =>
      entries
        .filter((e) => e.isHighlight)
        .sort((a, b) => b.moodRating - a.moodRating)
        .slice(0, 5),
    [entries],
  );

  const moodChartData = useMemo(
    () =>
      rated.map((e) => {
        const d = parseISO(e.id);
        return { date: format(d, "MMM yy"), rating: e.moodRating };
      }),
    [rated],
  );

  return (
    <div className="space-y-8">
      <h2
        className="text-2xl font-serif font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        Your {TOTAL_DAYS}-Day Journey
      </h2>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="entries written" value={totalEntries} />
        <StatCard label="total words" value={totalWords.toLocaleString()} />
        <StatCard
          label="avg mood"
          value={avgMood > 0 ? avgMood.toFixed(1) : "—"}
          color={avgMood > 0 ? moodCssVar(avgMood) : undefined}
        />
        <StatCard label="memories stored" value={totalMemories} />
      </div>

      {/* Best moments */}
      {highlights.length > 0 && (
        <section className="space-y-3">
          <h3 className="section-title">Best Moments</h3>
          <div className="space-y-3">
            {highlights.map((e) => (
              <EntryCard key={e.id} entry={e} navigate={navigate} />
            ))}
          </div>
        </section>
      )}

      {/* Mood journey chart */}
      {moodChartData.length > 0 && (
        <section className="space-y-3">
          <h3 className="section-title">Mood Journey</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis domain={[1, 10]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                name="Mood"
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
  TAB: YEAR
  ═══════════════════════════════════════════════════════════════ */

function YearTab({
  year,
  entries,
  reflections,
  saveReflection,
  navigate,
}: {
  year: number;
  entries: DayEntry[];
  reflections: Map<string, string>;
  saveReflection: (pid: string, content: string) => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const yearEntries = useMemo(
    () => entries.filter((e) => getYear(parseISO(e.id)) === year),
    [entries, year],
  );

  const totalWords = useMemo(
    () => yearEntries.reduce((s, e) => s + e.wordCount, 0),
    [yearEntries],
  );

  const rated = useMemo(
    () => yearEntries.filter((e) => e.moodRating > 0),
    [yearEntries],
  );
  const avgMood = useMemo(
    () => (rated.length ? rated.reduce((s, e) => s + e.moodRating, 0) / rated.length : 0),
    [rated],
  );

  const topTag = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of yearEntries) for (const t of e.tags) m.set(t, (m.get(t) || 0) + 1);
    let best = ""; let max = 0;
    for (const [t, c] of m) { if (c > max) { best = t; max = c; } }
    return best || "—";
  }, [yearEntries]);

  const highlights = useMemo(
    () =>
      yearEntries
        .filter((e) => e.isHighlight)
        .sort((a, b) => b.moodRating - a.moodRating)
        .slice(0, 5),
    [yearEntries],
  );

  const moodChartData = useMemo(
    () =>
      rated.map((e) => {
        const d = parseISO(e.id);
        return { date: format(d, "MMM d"), rating: e.moodRating };
      }),
    [rated],
  );

  /* Monthly breakdown */
  const monthlyBreakdown = useMemo(() => {
    const yearStart = year === ORIGIN.getFullYear()
      ? new Date(ORIGIN)
      : new Date(year, 0, 1);
    const yearEnd = year === JOURNAL_END.getFullYear()
      ? new Date(JOURNAL_END)
      : new Date(year, 11, 31);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    return months.map((m) => {
      const key = format(m, "yyyy-MM");
      const inMonth = yearEntries.filter((e) => e.id.startsWith(key));
      const ratedInMonth = inMonth.filter((e) => e.moodRating > 0);
      const avg = ratedInMonth.length
        ? ratedInMonth.reduce((s, e) => s + e.moodRating, 0) / ratedInMonth.length
        : 0;
      return { label: format(m, "MMM"), count: inMonth.length, avg };
    });
  }, [yearEntries, year]);

  /* Year summary editor content */
  const promptId = `year-summary-${year}`;
  const initialContent = reflections.get(promptId) ?? "";

  return (
    <div className="space-y-8">
      {/* Year stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="entries" value={yearEntries.length} />
        <StatCard
          label="avg mood"
          value={avgMood > 0 ? avgMood.toFixed(1) : "—"}
          color={avgMood > 0 ? moodCssVar(avgMood) : undefined}
        />
        <StatCard label="words" value={totalWords.toLocaleString()} />
        <StatCard label="top tag" value={topTag} />
      </div>

      {/* Mood chart */}
      {moodChartData.length > 0 && (
        <section className="space-y-3">
          <h3 className="section-title">{year} Mood</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={moodChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis domain={[1, 10]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="rating" stroke="#F59E0B" strokeWidth={2} dot={false} name="Mood" />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <section className="space-y-3">
          <h3 className="section-title">{year} Highlights</h3>
          <div className="space-y-3">
            {highlights.map((e) => (
              <EntryCard key={e.id} entry={e} navigate={navigate} />
            ))}
          </div>
        </section>
      )}

      {/* Monthly breakdown */}
      <section className="space-y-3">
        <h3 className="section-title">Monthly Breakdown</h3>
        <div className="flex flex-wrap gap-2">
          {monthlyBreakdown.map((m) => (
            <div
              key={m.label}
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                background: m.avg > 0 ? moodCssVar(m.avg) : "var(--bg-secondary)",
                color: m.avg >= 6 ? "#000" : "var(--text-primary)",
                opacity: m.count === 0 ? 0.4 : 1,
              }}
            >
              {m.label}: {m.count}
            </div>
          ))}
        </div>
      </section>

      {/* Year summary editor */}
      <section className="space-y-3">
        <h3 className="section-title">My {year} in my own words</h3>
        <ReflectionEditor
          key={promptId}
          promptId={promptId}
          initialContent={initialContent}
          placeholder={`Write your reflection on ${year}…`}
          onSave={saveReflection}
        />
      </section>

      <section className="space-y-6">
        <div
          className="rounded-lg p-3"
          style={{
            background: "rgba(129,140,248,0.08)",
            border: "1px solid rgba(129,140,248,0.2)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Reflections happen on the last Sunday of each month, with a final golden reflection on December 31, 2035.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB: PROMPTS
   ═══════════════════════════════════════════════════════════════ */

function PromptsTab({
  reflections,
  saveReflection,
}: {
  reflections: Map<string, string>;
  saveReflection: (pid: string, content: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const answeredCount = useMemo(() => {
    let c = 0;
    for (let i = 0; i < PROMPTS.length; i++) {
      const content = reflections.get(`prompt-${i}`) ?? "";
      if (stripHtml(content).trim().length > 0) c++;
    }
    return c;
  }, [reflections]);

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {answeredCount} of {PROMPTS.length} prompts answered
        </p>
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: "var(--bg-secondary)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(answeredCount / PROMPTS.length) * 100}%`,
              background: "var(--accent)",
            }}
          />
        </div>
      </div>

      {/* Prompt accordions */}
      {PROMPTS.map((prompt, i) => {
        const pid = `prompt-${i}`;
        const content = reflections.get(pid) ?? "";
        const hasAnswer = stripHtml(content).trim().length > 0;
        const isOpen = expanded === i;

        return (
          <div key={i} className="card overflow-hidden">
            {/* Header — clickable */}
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className="w-full flex items-start justify-between p-5 text-left cursor-pointer"
              style={{ background: "none", border: "none" }}
            >
              <div className="space-y-1 flex-1 pr-4">
                <p
                  className="font-serif italic text-base"
                  style={{ color: "var(--text-primary)" }}
                >
                  {i + 1}. {prompt}
                </p>
                <span
                  className="inline-block text-xs rounded-full px-2.5 py-0.5 font-medium"
                  style={
                    hasAnswer
                      ? { background: "var(--accent-subtle)", color: "var(--accent)" }
                      : { background: "var(--bg-secondary)", color: "var(--text-muted)" }
                  }
                >
                  {hasAnswer ? "Answered ✓" : "Not yet written"}
                </span>
              </div>
              {isOpen ? (
                <ChevronUp size={18} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }} />
              ) : (
                <ChevronDown size={18} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }} />
              )}
            </button>

            {/* Expandable body */}
            <div
              style={{
                maxHeight: isOpen ? "2000px" : "0px",
                overflow: "hidden",
                transition: "max-height 0.35s ease-in-out",
              }}
            >
              <div className="px-5 pb-5 space-y-2">
                {isOpen && hasAnswer && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {wordCount(content)} words
                  </p>
                )}
                {isOpen && (
                  <ReflectionEditor
                    key={pid}
                    promptId={pid}
                    initialContent={content}
                    placeholder="Write your answer…"
                    onSave={saveReflection}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB: VISION
   ═══════════════════════════════════════════════════════════════ */

function VisionTab({
  visionItems,
  setVisionItems,
  saveReflection,
}: {
  visionItems: VisionItem[];
  setVisionItems: React.Dispatch<React.SetStateAction<VisionItem[]>>;
  saveReflection: (pid: string, content: string) => Promise<void>;
}) {
  const [addingType, setAddingType] = useState<"text" | "image" | "goal" | null>(null);

  /* ── Debounced save for vision items ───────────────────── */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const persistVision = useCallback(
    (items: VisionItem[]) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveReflection("vision-board", JSON.stringify(items));
      }, 1000);
    },
    [saveReflection],
  );

  const addItem = useCallback(
    (item: VisionItem) => {
      setVisionItems((prev) => {
        const next = [...prev, item];
        persistVision(next);
        return next;
      });
      setAddingType(null);
    },
    [persistVision, setVisionItems],
  );

  const removeItem = useCallback(
    (id: string) => {
      setVisionItems((prev) => {
        const next = prev.filter((v) => v.id !== id);
        persistVision(next);
        return next;
      });
    },
    [persistVision, setVisionItems],
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-serif font-bold" style={{ color: "var(--text-primary)" }}>
          Vision Board — The Next Chapter
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          What does your life look like beyond Day {TOTAL_DAYS}?
        </p>
      </div>

      {/* Add buttons */}
      <div className="flex gap-3 flex-wrap">
        {(["text", "image", "goal"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setAddingType(addingType === type ? null : type)}
            className="btn-ghost px-4 py-2 text-sm cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} />
            {type === "text" && "Text Block"}
            {type === "image" && "Image"}
            {type === "goal" && "Goal Card"}
          </button>
        ))}
      </div>

      {/* Inline forms */}
      {addingType === "text" && <TextBlockForm onAdd={addItem} onCancel={() => setAddingType(null)} />}
      {addingType === "image" && <ImageForm onAdd={addItem} onCancel={() => setAddingType(null)} />}
      {addingType === "goal" && <GoalForm onAdd={addItem} onCancel={() => setAddingType(null)} />}

      {/* Vision board grid */}
      {visionItems.length > 0 ? (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
          {visionItems.map((item) => (
            <VisionCard key={item.id} item={item} onRemove={removeItem} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-3">
          <p className="text-4xl">🌟</p>
          <p style={{ color: "var(--text-muted)" }}>
            Your vision board is empty. Add your first item above.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Vision inline forms ──────────────────────────────────── */

function TextBlockForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: VisionItem) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState("");

  return (
    <div className="card p-5 space-y-3">
      <textarea
        className="input-base w-full min-h-[100px] resize-y"
        placeholder="A vision, a dream, a reminder..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost px-3 py-1.5 text-sm cursor-pointer" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-primary px-4 py-1.5 text-sm cursor-pointer"
          disabled={!content.trim()}
          onClick={() =>
            onAdd({ id: crypto.randomUUID(), type: "text", content: content.trim() })
          }
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ImageForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: VisionItem) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [base64, setBase64] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBase64(reader.result as string);
      setUrl("");
    };
    reader.readAsDataURL(file);
  };

  const imgSrc = base64 || url;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex gap-3">
        <input
          className="input-base flex-1"
          placeholder="Image URL"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setBase64(""); }}
        />
        <button
          className="btn-ghost px-3 py-1.5 text-sm cursor-pointer flex items-center gap-1"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={14} /> Upload
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      <input
        className="input-base w-full"
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      {imgSrc && (
        <img
          src={imgSrc}
          alt="Preview"
          className="rounded-lg max-h-48 object-cover"
        />
      )}
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost px-3 py-1.5 text-sm cursor-pointer" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-primary px-4 py-1.5 text-sm cursor-pointer"
          disabled={!imgSrc}
          onClick={() =>
            onAdd({
              id: crypto.randomUUID(),
              type: "image",
              content: imgSrc,
              title: caption.trim() || undefined,
            })
          }
        >
          Add
        </button>
      </div>
    </div>
  );
}

function GoalForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: VisionItem) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");

  return (
    <div className="card p-5 space-y-3">
      <input
        className="input-base w-full"
        placeholder="The goal"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="input-base w-full min-h-[80px] resize-y"
        placeholder="Description"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <input
        className="input-base"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost px-3 py-1.5 text-sm cursor-pointer" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-primary px-4 py-1.5 text-sm cursor-pointer"
          disabled={!title.trim()}
          onClick={() =>
            onAdd({
              id: crypto.randomUUID(),
              type: "goal",
              content: desc.trim(),
              title: title.trim(),
              targetDate: date || undefined,
            })
          }
        >
          Add
        </button>
      </div>
    </div>
  );
}

/* ── Vision card ──────────────────────────────────────────── */

function VisionCard({
  item,
  onRemove,
}: {
  item: VisionItem;
  onRemove: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="card relative break-inside-avoid"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Delete button on hover */}
      {hovered && (
        <button
          onClick={() => onRemove(item.id)}
          className="absolute top-2 right-2 rounded-full p-1 cursor-pointer z-10"
          style={{ background: "var(--bg-secondary)" }}
        >
          <X size={14} style={{ color: "var(--text-muted)" }} />
        </button>
      )}

      {item.type === "text" && (
        <div className="p-5" style={{ borderLeft: "3px solid var(--accent)" }}>
          <p className="font-serif italic" style={{ color: "var(--text-primary)" }}>
            {item.content}
          </p>
        </div>
      )}

      {item.type === "image" && (
        <div>
          <img
            src={item.content}
            alt={item.title || "Vision"}
            className="w-full rounded-t-xl object-cover"
            style={{ maxHeight: 280 }}
          />
          {item.title && (
            <p
              className="p-3 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              {item.title}
            </p>
          )}
        </div>
      )}

      {item.type === "goal" && (
        <div className="p-5 space-y-2" style={{ borderTop: "3px solid var(--accent)" }}>
          <p className="font-bold" style={{ color: "var(--text-primary)" }}>
            {item.title}
          </p>
          {item.content && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {item.content}
            </p>
          )}
          {item.targetDate && (
            <div className="flex justify-end">
              <span
                className="text-xs rounded-full px-2.5 py-0.5 font-medium"
                style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
              >
                {format(parseISO(item.targetDate), "MMM d, yyyy")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARED: REFLECTION EDITOR (TipTap with auto-save)
   ═══════════════════════════════════════════════════════════════ */

function ReflectionEditor({
  promptId,
  initialContent,
  placeholder,
  onSave,
}: {
  promptId: string;
  initialContent: string;
  placeholder: string;
  onSave: (promptId: string, content: string) => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSaveRef = useRef(onSave);
  const pidRef = useRef(promptId);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    pidRef.current = promptId;
  }, [promptId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Placeholder.configure({ placeholder }),
      ImageExt,
    ],
    content: initialContent,
    onUpdate: ({ editor: ed }) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setIsSaving(true);
        await onSaveRef.current(pidRef.current, ed.getHTML());
        setIsSaving(false);
      }, 2000);
    },
  });

  useEffect(() => () => clearTimeout(saveTimer.current), []);

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
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex gap-1 flex-wrap items-center">
        {tb(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), Bold, "Bold")}
        {tb(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), Italic, "Italic")}
        {tb(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1, "Heading 1")}
        {tb(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, "Heading 2")}
        {tb(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), List, "Bullet List")}
        {tb(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered, "Ordered List")}
        {tb(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), Quote, "Quote")}
        {tb(false, () => editor.chain().focus().setHorizontalRule().run(), Minus, "Divider")}
        {isSaving && (
          <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
            Saving…
          </span>
        )}
      </div>

      {/* Editor */}
      <div
        className="rounded-xl min-h-[150px] p-4 prose prose-invert max-w-none"
        style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARED: STAT CARD & ENTRY CARD
   ═══════════════════════════════════════════════════════════════ */

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="card p-5 text-center space-y-1">
      <p
        className="text-3xl font-bold"
        style={{ color: color ?? "var(--text-primary)" }}
      >
        {value}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function EntryCard({
  entry,
  navigate,
}: {
  entry: DayEntry;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const d = parseISO(entry.id);
  const dateStr = format(d, "MMMM d, yyyy");
  const journal = stripHtml(entry.journal);
  const preview = journal.length > 80 ? journal.slice(0, 80).trimEnd() + "…" : journal;

  return (
    <button
      onClick={() => navigate(`/entry/${entry.id}`)}
      className="card p-4 flex items-start gap-4 w-full text-left cursor-pointer"
      style={{ background: "none", border: "1px solid var(--border)" }}
    >
      <div className="shrink-0 text-center" style={{ minWidth: 48 }}>
        <p className="text-xl font-bold" style={{ color: "var(--accent)" }}>
          {entry.dayNumber}
        </p>
        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          day
        </p>
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {entry.moodEmoji && <span>{entry.moodEmoji}</span>}
          <span className="text-sm font-bold" style={{ color: moodCssVar(entry.moodRating) }}>
            {entry.moodRating}/10
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {dateStr}
          </span>
        </div>
        {preview && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {preview}
          </p>
        )}
      </div>
    </button>
  );
}
