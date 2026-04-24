import Dexie, { type Table } from "dexie";
import { normalizeCheckpointPrompts } from "../utils/checkpoints";

// ── Sub-document types ──────────────────────────────────────────────

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export interface Memory {
  id: string;
  type: "text" | "image" | "video" | "link";
  content: string;
  caption: string;
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface HabitLog {
  habitId: string;
  completed: boolean;
}

// ── Top-level table types ───────────────────────────────────────────

export interface DayEntry {
  id: string;
  dayNumber: number;
  date: string;
  moodRating: number;
  moodEmoji: string;
  ratingChecks: boolean[];
  checkpointPrompts: string[];
  quoteOfDay: string;
  isQuoteStarred: boolean;
  journal: string;
  todos: Todo[];
  habitLogs: HabitLog[];
  tags: string[];
  gratitude: string[];
  memories: Memory[];
  isHighlight: boolean;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReflectionEntry {
  id: string;
  promptId: string;
  content: string;
  updatedAt: string;
}

export interface StreakFreeze {
  id?: number;
  usedAt: string; // YYYY-MM-DD when freeze was claimed
  forDateId: string; // YYYY-MM-DD the missed day it covered
}

// ── Database ────────────────────────────────────────────────────────

class JournalDB extends Dexie {
  entries!: Table<DayEntry, string>;
  habits!: Table<Habit, string>;
  reflections!: Table<ReflectionEntry, string>;
  streakFreezes!: Table<StreakFreeze, number>;

  constructor() {
    super("JournalDB");

    this.version(1).stores({
      entries: "id, dayNumber, date, moodRating, isHighlight, *tags",
      habits: "id, name",
      reflections: "id, promptId",
    });

    this.version(2).stores({
      entries: "id, dayNumber, date, moodRating, isHighlight, *tags",
      habits: "id, name",
      reflections: "id, promptId",
    }).upgrade((tx) => tx.table("entries").toCollection().modify((entry: Partial<DayEntry>) => {
      entry.todos ??= [];
      entry.habitLogs ??= [];
      entry.tags ??= [];
      entry.gratitude ??= [];
      entry.memories ??= [];
      entry.moodEmoji ??= "";
      entry.isHighlight ??= false;
      entry.wordCount ??= 0;
      entry.createdAt ??= new Date().toISOString();
      entry.updatedAt ??= entry.createdAt;
    }));

    this.version(3).stores({
      entries: "id, dayNumber, date, moodRating, isHighlight, *tags",
      habits: "id, name",
      reflections: "id, promptId",
      streakFreezes: "++id, usedAt, forDateId",
    });

    this.version(4).stores({
      entries: "id, dayNumber, date, moodRating, isHighlight, *tags",
      habits: "id, name",
      reflections: "id, promptId",
      streakFreezes: "++id, usedAt, forDateId",
    });

    this.version(5).stores({
      entries: "id, dayNumber, date, moodRating, isHighlight, *tags",
      habits: "id, name",
      reflections: "id, promptId",
      streakFreezes: "++id, usedAt, forDateId",
    }).upgrade((tx) => tx.table("entries").toCollection().modify((entry: Partial<DayEntry>) => {
      entry.ratingChecks ??= Array.from({ length: 10 }, () => false);
      entry.checkpointPrompts = normalizeCheckpointPrompts(entry.checkpointPrompts);
      entry.quoteOfDay ??= "";
      entry.isQuoteStarred ??= false;
      entry.todos ??= [];
      entry.habitLogs ??= [];
      entry.tags ??= [];
      entry.gratitude ??= [];
      entry.memories ??= [];
      entry.moodEmoji ??= "";
      entry.isHighlight ??= false;
      entry.wordCount ??= 0;
      entry.createdAt ??= new Date().toISOString();
      entry.updatedAt ??= entry.createdAt;
    }));

    this.version(6).stores({
      entries: "id, dayNumber, date, moodRating, isHighlight, *tags",
      habits: "id, name",
      reflections: "id, promptId",
      streakFreezes: "++id, usedAt, forDateId",
    }).upgrade((tx) => tx.table("entries").toCollection().modify((entry: Partial<DayEntry>) => {
      entry.ratingChecks = Array.isArray(entry.ratingChecks)
        ? entry.ratingChecks.slice(0, 10).concat(Array.from({ length: Math.max(0, 10 - entry.ratingChecks.length) }, () => false))
        : Array.from({ length: 10 }, () => false);
      entry.checkpointPrompts = normalizeCheckpointPrompts(entry.checkpointPrompts);
      entry.quoteOfDay ??= "";
      entry.isQuoteStarred ??= false;
      entry.todos ??= [];
      entry.habitLogs ??= [];
      entry.tags ??= [];
      entry.gratitude ??= [];
      entry.memories ??= [];
      entry.moodEmoji ??= "";
      entry.isHighlight ??= false;
      entry.wordCount ??= 0;
      entry.createdAt ??= new Date().toISOString();
      entry.updatedAt ??= entry.createdAt;
    }));
  }
}

export const db = new JournalDB();
