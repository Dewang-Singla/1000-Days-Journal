import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, isAfter, startOfDay, parseISO } from "date-fns";

import storage from "../storage";
import { getTodayDateId } from "../utils/dates";
import type { DayEntry } from "../db";

/* ── Helpers ──────────────────────────────────────────────── */

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max).trimEnd() + "…";
}

function padDay(n: number): string {
  return String(n).padStart(3, "0");
}

function hasContent(e: DayEntry): boolean {
  return (
    stripHtml(e.journal).trim().length > 0 ||
    e.todos.length > 0 ||
    e.memories.length > 0
  );
}

function moodColor(r: number): string {
  return `var(--mood-${Math.min(10, Math.max(1, Math.round(r)))})`;
}

const PAGE_SIZE = 20;

/* ── Component ────────────────────────────────────────────── */

export default function Timeline() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [allEntries, setAllEntries] = useState<DayEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "highlights" | string>(
    searchParams.get("filter") || "all",
  );
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  /* ── Load entries ─────────────────────────────────────── */
  useEffect(() => {
    setIsLoading(true);
    storage.getAllEntries().then((entries) => {
      const today = startOfDay(new Date());
      const withContent = entries
        .filter((e) => !e.isRedeemed)
        .filter(hasContent)
        .filter((e) => !isAfter(startOfDay(parseISO(e.id)), today))
        .sort((a, b) => b.id.localeCompare(a.id));
      setAllEntries(withContent);
      setIsLoading(false);
    });
  }, []);

  /* ── Unique tags ──────────────────────────────────────── */
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) for (const t of e.tags) set.add(t);
    return Array.from(set).sort();
  }, [allEntries]);

  /* ── Filtered entries ─────────────────────────────────── */
  const filtered = useMemo(() => {
    if (filter === "all") return allEntries;
    if (filter === "highlights") return allEntries.filter((e) => e.isHighlight);
    return allEntries.filter((e) => e.tags.includes(filter));
  }, [allEntries, filter]);

  const displayed = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = displayed.length < filtered.length;

  /* ── Filter change ────────────────────────────────────── */
  const applyFilter = (f: string) => {
    setFilter(f);
    setPage(1);
    if (f === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ filter: f });
    }
  };

  /* ── Render ───────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="page-transition max-w-3xl mx-auto space-y-6 pb-20">
      {/* ── Filter Bar ───────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 py-3 -mx-2 px-2 overflow-x-auto flex gap-2"
        style={{ background: "var(--bg-primary)" }}
      >
        <FilterPill active={filter === "all"} onClick={() => applyFilter("all")}>
          All
        </FilterPill>
        <FilterPill active={filter === "highlights"} onClick={() => applyFilter("highlights")}>
          ★ Highlights
        </FilterPill>
        {allTags.map((tag) => (
          <FilterPill key={tag} active={filter === tag} onClick={() => applyFilter(tag)}>
            #{tag}
          </FilterPill>
        ))}
      </div>

      {/* ── Entries ──────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState filter={filter} navigate={navigate} />
      ) : (
        <>
          <div className="space-y-0">
            {displayed.map((entry, idx) => (
              <TimelineCard
                key={entry.id}
                entry={entry}
                isLast={idx === displayed.length - 1}
                navigate={navigate}
              />
            ))}
          </div>

          {/* Load more */}
          <div className="text-center space-y-2">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Showing {displayed.length} of {filtered.length} entries
            </p>
            {hasMore && (
              <button
                className="btn-ghost"
                onClick={() => setPage((p) => p + 1)}
              >
                Load more entries
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

/* ── Filter Pill ───────────────────────────────────────────── */

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap"
      style={
        active
          ? { background: "var(--accent)", color: "#000", border: "none" }
          : {
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }
      }
    >
      {children}
    </button>
  );
}

/* ── Timeline Card ─────────────────────────────────────────── */

function TimelineCard({
  entry,
  isLast,
  navigate,
}: {
  entry: DayEntry;
  isLast: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const ed = new Date(entry.id + "T00:00:00");
  const dateStr = format(ed, "MMMM d, yyyy");
  const journal = truncate(stripHtml(entry.journal), 200);
  const completedTodos = entry.todos.filter((t) => t.completed).length;
  const shownTags = entry.tags.slice(0, 4);
  const extraTags = entry.tags.length - 4;

  return (
    <div className="flex gap-0">
      {/* Left: day number + connecting line */}
      <div className="w-[60px] shrink-0 flex flex-col items-center">
        <span
          className="text-lg font-bold font-mono pt-4"
          style={{ color: "var(--text-muted)" }}
        >
          {padDay(entry.dayNumber)}
        </span>
        {!isLast && (
          <div
            className="flex-1 w-px mt-2"
            style={{ background: "var(--border)" }}
          />
        )}
      </div>

      {/* Right: card */}
      <button
        onClick={() => navigate(`/entry/${entry.id}`)}
        className="card flex-1 p-5 mb-3 text-left cursor-pointer space-y-2"
      >
        {/* Top row */}
        <div className="flex items-center justify-between gap-2">
          <h3
            className="text-base font-serif font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {dateStr}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {entry.isHighlight && (
              <span style={{ color: "var(--accent)", fontSize: 14 }}>★</span>
            )}
            {entry.moodEmoji && <span className="text-base">{entry.moodEmoji}</span>}
            {entry.moodRating > 0 && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: moodColor(entry.moodRating),
                  color: "#000",
                }}
              >
                {entry.moodRating}
              </span>
            )}
          </div>
        </div>

        {/* Journal preview */}
        {journal && (
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {journal}
          </p>
        )}

        {/* Badges + Tags row */}
        <div className="flex items-center gap-2 flex-wrap">
          {entry.memories.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
              📎 {entry.memories.length} memor{entry.memories.length === 1 ? "y" : "ies"}
            </span>
          )}
          {entry.todos.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
              ☑ {completedTodos}/{entry.todos.length} tasks
            </span>
          )}
          {shownTags.map((t) => (
            <span key={t} className="tag-chip">#{t}</span>
          ))}
          {extraTags > 0 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              +{extraTags} more
            </span>
          )}
        </div>

        {/* Word count */}
        {entry.wordCount > 0 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {entry.wordCount} words
          </p>
        )}
      </button>
    </div>
  );
}

/* ── Empty State ───────────────────────────────────────────── */

function EmptyState({
  filter,
  navigate,
}: {
  filter: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  let message = "No entries yet";
  if (filter === "highlights") message = "No highlights yet";
  else if (filter !== "all") message = `No entries tagged #${filter}`;

  return (
    <div className="text-center py-16 space-y-4">
      <p className="text-5xl">🌱</p>
      <p style={{ color: "var(--text-muted)" }}>{message}</p>
      <button
        className="btn-primary"
        onClick={() => navigate(`/entry/${getTodayDateId()}`)}
      >
        Write Today's Entry
      </button>
    </div>
  );
}
