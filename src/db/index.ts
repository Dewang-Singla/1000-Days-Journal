import Dexie, { type Table } from "dexie";

// ── Sub-document types ──────────────────────────────────────────────

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  rolledOver: boolean;
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
  journal: string;
  todos: Todo[];
  habitLogs: HabitLog[];
  tags: string[];
  gratitude: string[];
  memories: Memory[];
  isHighlight: boolean;
  isRedeemed: boolean;
  redemptionDayId: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RedemptionDay {
  id: string;              // "2028-12-04" through "2028-12-24"
  assignedToDateId: string; // which wasted day this replaces
  usedAt: string;          // when redemption was claimed
}

export interface ReflectionEntry {
  id: string;
  promptId: string;
  content: string;
  updatedAt: string;
}

// ── Database ────────────────────────────────────────────────────────

class JournalDB extends Dexie {
  entries!: Table<DayEntry, string>;
  habits!: Table<Habit, string>;
  reflections!: Table<ReflectionEntry, string>;
  redemptions!: Table<RedemptionDay, string>;

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
      redemptions: "id, assignedToDateId",
    }).upgrade(tx => {
      return tx.table("entries").toCollection().modify(entry => {
        if (entry.isRedeemed === undefined) entry.isRedeemed = false;
        if (entry.redemptionDayId === undefined) entry.redemptionDayId = "";
      });
    });
  }
}

export const db = new JournalDB();
