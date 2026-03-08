import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, isAfter, startOfDay, parseISO } from "date-fns";
import { Search as SearchIcon, X, Loader2 } from "lucide-react";

import storage from "../storage";
import { getTodayDateId } from "../utils/dates";
import type { DayEntry } from "../db";

/* ── Helpers ──────────────────────────────────────────────── */

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

function moodColor(r: number): string {
  return `var(--mood-${Math.min(10, Math.max(1, Math.round(r)))})`;
}

/** Return a text snippet around the first match, with the term highlighted. */
function buildSnippet(entry: DayEntry, term: string): { text: string; matchIndex: number } | null {
  const lower = term.toLowerCase();
  const sources = [
    stripHtml(entry.journal),
    ...entry.tags,
    ...entry.gratitude,
    ...entry.memories.map((m) => m.content),
  ];
  for (const src of sources) {
    const idx = src.toLowerCase().indexOf(lower);
    if (idx !== -1) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(src.length, idx + term.length + 60);
      const prefix = start > 0 ? "…" : "";
      const suffix = end < src.length ? "…" : "";
      return { text: prefix + src.slice(start, end) + suffix, matchIndex: idx - start + prefix.length };
    }
  }
  return null;
}

/* ── Mood filter options ──────────────────────────────────── */

const MOOD_OPTIONS = [
  { value: 0, label: "Any mood" },
  { value: 1, label: "1-3 Rough" },
  { value: 4, label: "4-5 Okay" },
  { value: 6, label: "6-7 Good" },
  { value: 8, label: "8-9 Great" },
  { value: 10, label: "10 Legendary" },
];

function moodMatches(rating: number, filterValue: number): boolean {
  if (filterValue === 0) return true;
  if (filterValue === 1) return rating >= 1 && rating <= 3;
  if (filterValue === 4) return rating >= 4 && rating <= 5;
  if (filterValue === 6) return rating >= 6 && rating <= 7;
  if (filterValue === 8) return rating >= 8 && rating <= 9;
  if (filterValue === 10) return rating === 10;
  return true;
}

/* ── Component ────────────────────────────────────────────── */

export default function Search() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DayEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [moodFilter, setMoodFilter] = useState(0);
  const [tagFilter, setTagFilter] = useState("");
  const [allEntries, setAllEntries] = useState<DayEntry[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load all entries for recent + tags ───────────────── */
  useEffect(() => {
    storage.getAllEntries().then((entries) => {
      setAllEntries(entries.filter((e) => !e.isRedeemed && hasContent(e)).sort((a, b) => b.id.localeCompare(a.id)));
    });
    inputRef.current?.focus();
  }, []);

  /* ── All tags ─────────────────────────────────────────── */
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) for (const t of e.tags) set.add(t);
    return Array.from(set).sort();
  }, [allEntries]);

  /* ── Recent entries ───────────────────────────────────── */
  const recentEntries = useMemo(() => allEntries.slice(0, 5), [allEntries]);

  /* ── Debounced search ─────────────────────────────────── */
  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      const found = await storage.searchEntries(q);
      const today = startOfDay(new Date());
      const safe = found.filter((e) => !e.isRedeemed && !isAfter(startOfDay(parseISO(e.id)), today));
      setResults(safe.sort((a, b) => b.id.localeCompare(a.id)));
      setHasSearched(true);
      setIsSearching(false);
    },
    [],
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    timerRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, doSearch]);

  /* ── Apply mood + tag post-filter ─────────────────────── */
  const filteredResults = useMemo(() => {
    let r = results;
    if (moodFilter !== 0) r = r.filter((e) => moodMatches(e.moodRating, moodFilter));
    if (tagFilter) r = r.filter((e) => e.tags.includes(tagFilter));
    return r;
  }, [results, moodFilter, tagFilter]);

  /* ── Tag chip click → search ──────────────────────────── */
  const searchTag = (tag: string) => {
    setQuery(tag);
    setTagFilter("");
    setMoodFilter(0);
  };

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className="page-transition max-w-3xl mx-auto space-y-6 pb-20">
      {/* ── Search Bar ───────────────────────────────────── */}
      <div className="relative">
        <SearchIcon
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
        {isSearching && (
          <Loader2
            size={16}
            className="absolute right-12 top-1/2 -translate-y-1/2 animate-spin"
            style={{ color: "var(--text-muted)" }}
          />
        )}
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer"
            style={{ color: "var(--text-muted)", background: "none", border: "none" }}
          >
            <X size={16} />
          </button>
        )}
        <input
          ref={inputRef}
          className="input-base text-base"
          style={{ padding: "14px 44px 14px 44px" }}
          placeholder="Search your journey..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* ── Filter Row ───────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="input-base w-auto text-sm"
          value={moodFilter}
          onChange={(e) => setMoodFilter(Number(e.target.value))}
        >
          {MOOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="input-base w-auto text-sm"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="">Any tag</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
      </div>

      {/* ── Results / States ─────────────────────────────── */}
      {hasSearched ? (
        filteredResults.length > 0 ? (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""} for &lsquo;{query}&rsquo;
            </p>
            {filteredResults.map((entry) => (
              <ResultCard key={entry.id} entry={entry} query={query} navigate={navigate} />
            ))}
          </div>
        ) : (
          /* No results */
          <div className="text-center py-16 space-y-4">
            <p className="text-5xl">🔍</p>
            <p style={{ color: "var(--text-muted)" }}>
              Nothing found for &lsquo;{query}&rsquo;
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Try different keywords or{" "}
              <button
                onClick={() => navigate("/timeline")}
                className="underline cursor-pointer"
                style={{ color: "var(--accent)", background: "none", border: "none" }}
              >
                browse the timeline →
              </button>
            </p>
          </div>
        )
      ) : (
        /* Initial state: recent + tags */
        <div className="space-y-8">
          {/* Recent entries */}
          {recentEntries.length > 0 && (
            <section className="space-y-3">
              <h3 className="section-title">Recent Entries</h3>
              {recentEntries.map((entry) => (
                <RecentCard key={entry.id} entry={entry} navigate={navigate} />
              ))}
            </section>
          )}

          {/* Browse by tag */}
          {allTags.length > 0 && (
            <section className="space-y-3">
              <h3 className="section-title">Or browse by tag</h3>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => searchTag(tag)}
                    className="tag-chip cursor-pointer"
                    style={{ border: "1px solid rgba(245,158,11,0.2)" }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Totally empty */}
          {recentEntries.length === 0 && allTags.length === 0 && (
            <div className="text-center py-16 space-y-4">
              <p className="text-5xl">📔</p>
              <p style={{ color: "var(--text-muted)" }}>No entries yet — start writing!</p>
              <button
                className="btn-primary"
                onClick={() => navigate(`/entry/${getTodayDateId()}`)}
              >
                Write Today's Entry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

/* ── Result Card (with highlighted match) ──────────────────── */

function ResultCard({
  entry,
  query,
  navigate,
}: {
  entry: DayEntry;
  query: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const ed = new Date(entry.id + "T00:00:00");
  const dateStr = format(ed, "MMMM d, yyyy");

  const snippet = buildSnippet(entry, query);

  /* Build highlighted snippet parts */
  const renderSnippet = () => {
    if (!snippet) return null;
    const { text } = snippet;
    const lower = text.toLowerCase();
    const qLower = query.toLowerCase();
    const idx = lower.indexOf(qLower);

    if (idx === -1) {
      return <span style={{ color: "var(--text-secondary)" }}>{text}</span>;
    }

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);

    return (
      <span className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {before}
        <mark
          style={{
            background: "rgba(245,158,11,0.3)",
            color: "var(--text-primary)",
            borderRadius: 2,
            padding: "0 2px",
          }}
        >
          {match}
        </mark>
        {after}
      </span>
    );
  };

  return (
    <button
      onClick={() => navigate(`/entry/${entry.id}`)}
      className="card w-full text-left p-5 cursor-pointer space-y-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <span
            className="text-sm font-bold font-mono mr-2"
            style={{ color: "var(--text-muted)" }}
          >
            D{String(entry.dayNumber).padStart(3, "0")}
          </span>
          <span
            className="text-base font-serif font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {dateStr}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {entry.moodEmoji && <span>{entry.moodEmoji}</span>}
          {entry.moodRating > 0 && (
            <span
              className="text-xs font-bold"
              style={{ color: moodColor(entry.moodRating) }}
            >
              {entry.moodRating}
            </span>
          )}
        </div>
      </div>

      {/* Snippet */}
      {renderSnippet()}

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {entry.tags.map((t) => (
            <span key={t} className="tag-chip">#{t}</span>
          ))}
        </div>
      )}
    </button>
  );
}

/* ── Recent Card (simpler) ─────────────────────────────────── */

function RecentCard({
  entry,
  navigate,
}: {
  entry: DayEntry;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const ed = new Date(entry.id + "T00:00:00");
  const dateStr = format(ed, "MMMM d, yyyy");
  const journal = stripHtml(entry.journal);
  const preview = journal.length > 80 ? journal.slice(0, 80).trimEnd() + "…" : journal;

  return (
    <button
      onClick={() => navigate(`/entry/${entry.id}`)}
      className="card w-full text-left px-5 py-3 cursor-pointer flex items-center gap-4"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {dateStr}
        </p>
        {preview && (
          <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
            {preview}
          </p>
        )}
      </div>
      {entry.moodEmoji && <span className="text-lg shrink-0">{entry.moodEmoji}</span>}
    </button>
  );
}
