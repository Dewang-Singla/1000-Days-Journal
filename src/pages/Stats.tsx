import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
  eachMonthOfInterval,
  subDays,
} from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import storage from "../storage";
import { getDayNumber, dateToId } from "../utils/dates";
import type { DayEntry } from "../db";

/* ── Helpers ──────────────────────────────────────────────── */

function stripHtml(html: string): string {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent || d.innerText || "";
}

function hasContent(e: DayEntry): boolean {
  return stripHtml(e.journal).trim().length > 0 || e.todos.length > 0 || e.memories.length > 0;
}

function moodCssVar(r: number): string {
  return `var(--mood-${Math.min(10, Math.max(1, Math.round(r)))})`;
}

const MOOD_HEX: Record<number, string> = {
  1: "#EF4444", 2: "#F97316", 3: "#FB923C", 4: "#FBBF24", 5: "#FCD34D",
  6: "#A3E635", 7: "#4ADE80", 8: "#34D399", 9: "#2DD4BF", 10: "#F59E0B",
};

function moodHex(r: number): string {
  return MOOD_HEX[Math.min(10, Math.max(1, Math.round(r)))] ?? "#F59E0B";
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LINE_COLORS = ["#F59E0B", "#3B82F6", "#10B981", "#EF4444", "#A855F7"];
const JOURNEY_START = new Date(2026, 2, 1);
const JOURNEY_END = new Date(2028, 11, 3);

const MILESTONES = [1, 100, 250, 500, 750, 1000];

/* ── Custom tooltip wrapper ───────────────────────────────── */

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || "var(--text-secondary)" }}>
          {formatter ? formatter(p) : `${p.name ?? ""}: ${p.value}`}
        </p>
      ))}
    </div>
  );
}

/* ── Component ────────────────────────────────────────────── */

type Tab = "overview" | "mood" | "habits" | "tags";
type MoodRange = "30" | "90" | "all";

export default function Stats() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [moodRange, setMoodRange] = useState<MoodRange>("all");

  useEffect(() => {
    storage.getAllEntries().then((all) => {
      setEntries(all.sort((a, b) => a.id.localeCompare(b.id)));
      setIsLoading(false);
    });
  }, []);

  /* ── Core stats ───────────────────────────────────────── */
  const validEntries = useMemo(() => entries.filter((e) => !e.isRedeemed), [entries]);
  const redeemedCount = useMemo(() => entries.filter((e) => e.isRedeemed).length, [entries]);
  const contentEntries = useMemo(() => validEntries.filter(hasContent), [validEntries]);
  const totalEntries = contentEntries.length;
  const totalWords = useMemo(() => validEntries.reduce((s, e) => s + e.wordCount, 0), [validEntries]);

  const rated = useMemo(() => validEntries.filter((e) => e.moodRating >= 0), [validEntries]);
  const avgMood = useMemo(() => (rated.length ? rated.reduce((s, e) => s + e.moodRating, 0) / rated.length : 0), [rated]);

  const bestDay = useMemo(() => (rated.length ? rated.reduce((a, b) => (b.moodRating > a.moodRating ? b : a)) : null), [rated]);
  const worstDay = useMemo(() => (rated.length ? rated.reduce((a, b) => (b.moodRating < a.moodRating ? b : a)) : null), [rated]);

  /* ── Streaks ──────────────────────────────────────────── */
  const { currentStreak } = useMemo(() => {
    const idSet = new Set(contentEntries.map((e) => e.id));
    const todayId = dateToId(new Date());
    let cur = 0;
    const d = new Date(todayId + "T00:00:00");
    while (idSet.has(dateToId(d))) { cur++; d.setDate(d.getDate() - 1); }

    const sorted = Array.from(idSet).sort();
    let longest = sorted.length ? 1 : 0;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + "T00:00:00");
      const curr = new Date(sorted[i] + "T00:00:00");
      if ((curr.getTime() - prev.getTime()) / 86400000 === 1) { run++; if (run > longest) longest = run; }
      else run = 1;
    }
    return { currentStreak: cur, longestStreak: longest };
  }, [contentEntries]);

  /* ── Tags ─────────────────────────────────────────────── */
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of validEntries) for (const t of e.tags) m.set(t, (m.get(t) || 0) + 1);
    return m;
  }, [validEntries]);

  const tagData = useMemo(() =>
    Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, count]) => ({ tag, count })),
    [tagCounts],
  );

  /* ── Monthly data ─────────────────────────────────────── */
  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({ start: JOURNEY_START, end: JOURNEY_END });
    return months.map((m) => {
      const key = format(m, "yyyy-MM");
      const inMonth = contentEntries.filter((e) => e.id.startsWith(key));
      const ratedInMonth = inMonth.filter((e) => e.moodRating >= 0);
      const avg = ratedInMonth.length ? ratedInMonth.reduce((s, e) => s + e.moodRating, 0) / ratedInMonth.length : 0;
      return { month: format(m, "MMM yy"), count: inMonth.length, avgMood: +avg.toFixed(1) };
    });
  }, [contentEntries]);


  /* ── Mood chart data ──────────────────────────────────── */
  const moodData = useMemo(() => {
    let src = rated;
    if (moodRange === "30") { const cutoff = dateToId(subDays(new Date(), 30)); src = src.filter((e) => e.id >= cutoff); }
    else if (moodRange === "90") { const cutoff = dateToId(subDays(new Date(), 90)); src = src.filter((e) => e.id >= cutoff); }
    return src.map((e) => {
      const d = new Date(e.id + "T00:00:00");
      return { date: format(d, "MMM d"), rating: e.moodRating, dayNumber: e.dayNumber, hex: moodHex(e.moodRating) };
    });
  }, [rated, moodRange]);

  /* ── Mood distribution ────────────────────────────────── */
  const moodDistribution = useMemo(() => {
    const counts = Array.from({ length: 10 }, (_, i) => ({ rating: i + 1, count: 0 }));
    for (const e of rated) { const idx = Math.min(9, Math.max(0, e.moodRating - 1)); counts[idx].count++; }
    return counts;
  }, [rated]);

  /* ── Mood by weekday ──────────────────────────────────── */
  const moodByWeekday = useMemo(() => {
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    for (const e of rated) {
      const d = new Date(e.id + "T00:00:00");
      let wd = d.getDay() - 1; // Mon=0
      if (wd < 0) wd = 6;
      sums[wd] += e.moodRating;
      counts[wd]++;
    }
    return WEEKDAY_NAMES.map((name, i) => ({ day: name, avg: counts[i] ? +(sums[i] / counts[i]).toFixed(1) : 0 }));
  }, [rated]);

  /* ── Habit data ───────────────────────────────────────── */
  const habitData = useMemo(() => {
    const map = new Map<string, { name: string; completed: number; total: number }>();
    for (const e of validEntries) {
      for (const log of e.habitLogs) {
        if (!map.has(log.habitId)) map.set(log.habitId, { name: log.habitId, completed: 0, total: 0 });
        const h = map.get(log.habitId)!;
        h.total++;
        if (log.completed) h.completed++;
      }
    }
    return Array.from(map.values()).map((h) => ({
      ...h,
      pct: h.total > 0 ? Math.round((h.completed / h.total) * 100) : 0,
    }));
  }, [validEntries]);

  /* ── Tag usage over time (top 5) ──────────────────────── */
  const tagTimeData = useMemo(() => {
    const top5 = tagData.slice(0, 5).map((t) => t.tag);
    if (!top5.length) return { months: [] as any[], tags: top5 };
    const months = eachMonthOfInterval({ start: JOURNEY_START, end: JOURNEY_END });
    const data = months.map((m) => {
      const key = format(m, "yyyy-MM");
      const label = format(m, "MMM yy");
      const row: any = { month: label };
      for (const tag of top5) {
        row[tag] = validEntries.filter((e) => e.id.startsWith(key) && e.tags.includes(tag)).length;
      }
      return row;
    });
    return { months: data, tags: top5 };
  }, [validEntries, tagData]);

  /* ── Reached milestones ───────────────────────────────── */
  const reachedDays = useMemo(() => new Set(contentEntries.map((e) => e.dayNumber)), [contentEntries]);
  const todayDayNum = getDayNumber(new Date());

  /* ── Loading ──────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────── */
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "mood", label: "Mood" },
    { key: "habits", label: "Habits" },
    { key: "tags", label: "Tags" },
  ];

  return (
    <div className="page-transition max-w-4xl mx-auto space-y-8 pb-20">
      <h1 className="text-3xl font-serif font-bold" style={{ color: "var(--text-primary)" }}>
        Stats
      </h1>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="flex gap-6" style={{ borderBottom: "1px solid var(--border)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="pb-2 text-sm font-medium transition-colors cursor-pointer"
            style={{
              color: activeTab === t.key ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: activeTab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
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
        <OverviewTab
          totalWords={totalWords}
          totalEntries={totalEntries}
          redeemedCount={redeemedCount}
          currentStreak={currentStreak}
          avgMood={avgMood}
          bestDay={bestDay}
          worstDay={worstDay}
          milestones={MILESTONES}
          reachedDays={reachedDays}
          todayDayNum={todayDayNum}
          monthlyData={monthlyData}
          navigate={navigate}
        />
      )}
      {activeTab === "mood" && (
        <MoodTab
          moodRange={moodRange}
          setMoodRange={setMoodRange}
          moodData={moodData}
          moodDistribution={moodDistribution}
          moodByWeekday={moodByWeekday}
        />
      )}
      {activeTab === "habits" && <HabitsTab habitData={habitData} />}
      {activeTab === "tags" && (
        <TagsTab tagData={tagData} tagTimeData={tagTimeData} navigate={navigate} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB: OVERVIEW
   ═══════════════════════════════════════════════════════════ */

function OverviewTab({
  totalWords, totalEntries, redeemedCount, currentStreak, avgMood,
  bestDay, worstDay, milestones, reachedDays, todayDayNum,
  monthlyData, navigate,
}: {
  totalWords: number;
  totalEntries: number;
  redeemedCount: number;
  currentStreak: number;
  avgMood: number;
  bestDay: DayEntry | null;
  worstDay: DayEntry | null;
  milestones: number[];
  reachedDays: Set<number>;
  todayDayNum: number;
  monthlyData: { month: string; count: number; avgMood: number }[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="words" value={totalWords.toLocaleString()} />
        <StatCard label={`of 1000 documented · ${Math.round((totalEntries / 1000) * 100)}%`} value={totalEntries} />
        <StatCard label="day streak 🔥" value={currentStreak} />
        <StatCard
          label="/10 avg mood"
          value={avgMood > 0 ? avgMood.toFixed(1) : "—"}
          valueColor={avgMood > 0 ? moodCssVar(avgMood) : undefined}
        />
      </div>

      {redeemedCount > 0 && (
        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
          {redeemedCount} day{redeemedCount !== 1 ? "s" : ""} redeemed, replaced by Dec 2028 days
        </p>
      )}

      {/* Best & Worst */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bestDay && (
          <DayCard
            label="Best Day"
            entry={bestDay}
            tint="rgba(16,185,129,0.1)"
            borderColor="rgba(16,185,129,0.3)"
            navigate={navigate}
          />
        )}
        {worstDay && (
          <DayCard
            label="Worst Day"
            entry={worstDay}
            tint="rgba(239,68,68,0.1)"
            borderColor="rgba(239,68,68,0.3)"
            navigate={navigate}
          />
        )}
      </div>

      {/* Milestones */}
      <section className="space-y-3">
        <h3 className="section-title">Milestones</h3>
        <div className="flex flex-wrap gap-3">
          {milestones.map((m) => {
            const reached = reachedDays.has(m) || (m === 1 && totalEntries > 0);
            const future = m > todayDayNum;
            return (
              <div
                key={m}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                style={{
                  background: reached ? "var(--accent-subtle)" : "transparent",
                  border: reached ? "1px solid var(--accent)" : "1px solid var(--border)",
                  color: reached ? "var(--accent)" : future ? "var(--text-muted)" : "var(--text-secondary)",
                  opacity: future && !reached ? 0.5 : 1,
                }}
              >
                {reached ? "✓" : "○"} Day {m}
              </div>
            );
          })}
        </div>
      </section>

      {/* Monthly bar chart */}
      <section className="space-y-3">
        <h3 className="section-title">Monthly Entries</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <Tooltip content={<ChartTooltip formatter={(p: any) => `${p.value} entries`} />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {monthlyData.map((_, i) => (
                <Cell key={i} fill="#F59E0B" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB: MOOD
   ═══════════════════════════════════════════════════════════ */

function MoodTab({
  moodRange, setMoodRange, moodData, moodDistribution, moodByWeekday,
}: {
  moodRange: MoodRange;
  setMoodRange: (r: MoodRange) => void;
  moodData: { date: string; rating: number; dayNumber: number; hex: string }[];
  moodDistribution: { rating: number; count: number }[];
  moodByWeekday: { day: string; avg: number }[];
}) {
  const ranges: { key: MoodRange; label: string }[] = [
    { key: "30", label: "30 days" },
    { key: "90", label: "90 days" },
    { key: "all", label: "All time" },
  ];

  return (
    <div className="space-y-8">
      {/* Range toggle */}
      <div className="flex gap-2">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => setMoodRange(r.key)}
            className="px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all"
            style={
              moodRange === r.key
                ? { background: "var(--accent)", color: "#000", border: "none" }
                : { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)" }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Mood over time */}
      <section className="space-y-3">
        <h3 className="section-title">Mood Over Time</h3>
        {moodData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={moodData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis domain={[1, 10]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(p: any) => {
                      const d = moodData[p.payload?.index] ?? p.payload;
                      return `Day ${d.dayNumber} · ${d.date}: ${d.rating}/10`;
                    }}
                  />
                }
              />
              {/* Neutral reference line */}
              <CartesianGrid horizontal={false} />
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      key={`${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill={payload.hex}
                      stroke="none"
                    />
                  );
                }}
                activeDot={{ r: 5, stroke: "#F59E0B", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>No mood data for this range</p>
        )}
      </section>

      {/* Mood distribution */}
      <section className="space-y-3">
        <h3 className="section-title">Mood Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={moodDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="rating" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <Tooltip content={<ChartTooltip formatter={(p: any) => `${p.value} entries`} />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {moodDistribution.map((d) => (
                <Cell key={d.rating} fill={moodHex(d.rating)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Mood by weekday */}
      <section className="space-y-3">
        <h3 className="section-title">Mood by Day of Week</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={moodByWeekday}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <YAxis domain={[0, 10]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <Tooltip content={<ChartTooltip formatter={(p: any) => `Avg: ${p.value}`} />} />
            <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
              {moodByWeekday.map((_, i) => (
                <Cell key={i} fill="#F59E0B" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB: HABITS
   ═══════════════════════════════════════════════════════════ */

function HabitsTab({ habitData }: { habitData: { name: string; completed: number; total: number; pct: number }[] }) {
  if (habitData.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-4xl">🔄</p>
        <p style={{ color: "var(--text-muted)" }}>No habits tracked yet</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Add habits and they will appear here as you log them
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Habit cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {habitData.map((h) => (
          <div key={h.name} className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {h.name}
              </span>
              <span
                className="text-2xl font-bold"
                style={{ color: h.pct >= 70 ? "var(--success)" : h.pct >= 40 ? "var(--accent)" : "var(--danger)" }}
              >
                {h.pct}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${h.pct}%`,
                  background: h.pct >= 70 ? "var(--success)" : h.pct >= 40 ? "var(--accent)" : "var(--danger)",
                }}
              />
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {h.completed} out of {h.total} days completed
            </p>
          </div>
        ))}
      </div>

      {/* Overall bar chart */}
      <section className="space-y-3">
        <h3 className="section-title">Habit Completion</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={habitData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<ChartTooltip formatter={(p: any) => `${p.value}%`} />} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
              {habitData.map((h, i) => (
                <Cell key={i} fill={h.pct >= 70 ? "#10B981" : h.pct >= 40 ? "#F59E0B" : "#EF4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB: TAGS
   ═══════════════════════════════════════════════════════════ */

function TagsTab({
  tagData,
  tagTimeData,
  navigate,
}: {
  tagData: { tag: string; count: number }[];
  tagTimeData: { months: any[]; tags: string[] };
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (tagData.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-4xl">🏷️</p>
        <p style={{ color: "var(--text-muted)" }}>No tags used yet</p>
      </div>
    );
  }

  const chartHeight = Math.max(200, tagData.length * 40);

  return (
    <div className="space-y-8">
      {/* Top tags horizontal bar chart */}
      <section className="space-y-3">
        <h3 className="section-title">Top Tags</h3>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={tagData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="tag"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              width={100}
              tickFormatter={(v) => `#${v}`}
            />
            <Tooltip content={<ChartTooltip formatter={(p: any) => `${p.value} entries`} />} />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(data: any) => navigate(`/timeline?filter=${data.tag}`)}
            >
              {tagData.map((_, i) => (
                <Cell key={i} fill="#F59E0B" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Tag usage over time */}
      {tagTimeData.tags.length > 0 && (
        <section className="space-y-3">
          <h3 className="section-title">Tag Usage Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={tagTimeData.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              {tagTimeData.tags.map((tag, i) => (
                <Line
                  key={tag}
                  type="monotone"
                  dataKey={tag}
                  name={`#${tag}`}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-4 justify-center">
            {tagTimeData.tags.map((tag, i) => (
              <div key={tag} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                #{tag}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function StatCard({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div className="card p-5 text-center space-y-1">
      <p className="text-3xl font-bold" style={{ color: valueColor ?? "var(--text-primary)" }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

function DayCard({
  label, entry, tint, borderColor, navigate,
}: {
  label: string;
  entry: DayEntry;
  tint: string;
  borderColor: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const d = new Date(entry.id + "T00:00:00");
  const dateStr = format(d, "MMMM d, yyyy");
  const journal = stripHtml(entry.journal);
  const preview = journal.length > 80 ? journal.slice(0, 80).trimEnd() + "…" : journal;

  return (
    <button
      onClick={() => navigate(`/entry/${entry.id}`)}
      className="card p-5 text-left cursor-pointer space-y-2 w-full"
      style={{ background: tint, border: `1px solid ${borderColor}` }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <div className="flex items-center gap-2">
        {entry.moodEmoji && <span className="text-xl">{entry.moodEmoji}</span>}
        <span className="text-lg font-bold" style={{ color: moodCssVar(entry.moodRating) }}>
          {entry.moodRating}/10
        </span>
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Day {entry.dayNumber} · {dateStr}
      </p>
      {preview && (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{preview}</p>
      )}
    </button>
  );
}
