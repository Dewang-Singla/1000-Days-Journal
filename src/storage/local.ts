import { db } from "../db";
import type { DayEntry, Habit, ReflectionEntry, StreakFreeze } from "../db";
import type { StorageAdapter } from "./index";
import { differenceInCalendarDays, parseISO } from "date-fns";

const MAX_FREEZES_PER_CYCLE = 2;
const FREEZE_CYCLE_DAYS = 30;

type ImportData = {
  entries: DayEntry[];
  habits: Habit[];
  reflections: ReflectionEntry[];
  streakFreezes?: StreakFreeze[];
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidTodo(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.completed === "boolean"
  );
}

function isValidMemory(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.content === "string" &&
    typeof value.caption === "string" &&
    typeof value.createdAt === "string"
  );
}

function isValidHabitLog(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.habitId === "string" &&
    typeof value.completed === "boolean"
  );
}

function isValidRatingChecks(value: unknown): boolean {
  return Array.isArray(value) && value.length === 10 && value.every((item) => typeof item === "boolean");
}

function isValidCheckpointPrompts(value: unknown): boolean {
  return Array.isArray(value) && value.length === 10 && value.every((item) => typeof item === "string");
}

function isValidDayEntry(value: unknown): value is DayEntry {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.dayNumber === "number" &&
    typeof value.date === "string" &&
    typeof value.moodRating === "number" &&
    typeof value.moodEmoji === "string" &&
    isValidRatingChecks(value.ratingChecks) &&
    isValidCheckpointPrompts(value.checkpointPrompts) &&
    typeof value.quoteOfDay === "string" &&
    typeof value.isQuoteStarred === "boolean" &&
    typeof value.journal === "string" &&
    Array.isArray(value.todos) && value.todos.every(isValidTodo) &&
    Array.isArray(value.habitLogs) && value.habitLogs.every(isValidHabitLog) &&
    Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === "string") &&
    Array.isArray(value.gratitude) && value.gratitude.every((item) => typeof item === "string") &&
    Array.isArray(value.memories) && value.memories.every(isValidMemory) &&
    typeof value.isHighlight === "boolean" &&
    typeof value.wordCount === "number" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isValidHabit(value: unknown): value is Habit {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.icon === "string" &&
    typeof value.color === "string" &&
    typeof value.createdAt === "string" &&
    (typeof value.deletedAt === "undefined" || typeof value.deletedAt === "string" || value.deletedAt === null)
  );
}

function isValidReflection(value: unknown): value is ReflectionEntry {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.promptId === "string" &&
    typeof value.content === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isValidStreakFreeze(value: unknown): value is StreakFreeze {
  if (!isObjectRecord(value)) return false;
  return (
    (typeof value.id === "number" || typeof value.id === "undefined") &&
    typeof value.usedAt === "string" &&
    typeof value.forDateId === "string"
  );
}

function parseAndValidateImport(json: string): ImportData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON backup file.");
  }

  if (!isObjectRecord(parsed)) {
    throw new Error("Backup payload must be an object.");
  }

  const entries = parsed.entries;
  const habits = parsed.habits;
  const reflections = parsed.reflections;
  const streakFreezes = parsed.streakFreezes;

  if (!Array.isArray(entries) || !entries.every(isValidDayEntry)) {
    throw new Error("Invalid entries in backup payload.");
  }
  if (!Array.isArray(habits) || !habits.every(isValidHabit)) {
    throw new Error("Invalid habits in backup payload.");
  }
  if (!Array.isArray(reflections) || !reflections.every(isValidReflection)) {
    throw new Error("Invalid reflections in backup payload.");
  }
  if (
    typeof streakFreezes !== "undefined" &&
    (!Array.isArray(streakFreezes) || !streakFreezes.every(isValidStreakFreeze))
  ) {
    throw new Error("Invalid streak freezes in backup payload.");
  }

  return {
    entries,
    habits,
    reflections,
    streakFreezes,
  };
}

export class LocalStorageAdapter implements StorageAdapter {
  async getEntry(dateId: string): Promise<DayEntry | null> {
    const entry = await db.entries.get(dateId);
    return entry ?? null;
  }

  async saveEntry(entry: DayEntry): Promise<void> {
    await db.entries.put(entry);
  }

  async getAllEntries(): Promise<DayEntry[]> {
    return db.entries.orderBy("dayNumber").toArray();
  }

  async deleteEntry(dateId: string): Promise<void> {
    await db.entries.delete(dateId);
  }

  async getEntriesByTag(tag: string): Promise<DayEntry[]> {
    return db.entries.where("tags").equals(tag).toArray();
  }

  async searchEntries(query: string): Promise<DayEntry[]> {
    const q = query.toLowerCase();
    const all = await db.entries.toArray();

    return all.filter((entry) => {
      if (entry.journal.toLowerCase().includes(q)) return true;
      if (entry.quoteOfDay.toLowerCase().includes(q)) return true;
      if (entry.tags.some((t) => t.toLowerCase().includes(q))) return true;
      if (entry.gratitude.some((g) => g.toLowerCase().includes(q))) return true;
      if (entry.memories.some((m) => m.content.toLowerCase().includes(q)))
        return true;
      return false;
    });
  }

  async getHighlights(): Promise<DayEntry[]> {
    return db.entries.where("isHighlight").equals(1).toArray();
  }

  async getHabits(): Promise<Habit[]> {
    const habits = await db.habits.toArray();
    return habits.filter((h) => !h.deletedAt);
  }

  async getAllHabits(): Promise<Habit[]> {
    return db.habits.toArray();
  }

  async saveHabit(habit: Habit): Promise<void> {
    await db.habits.put(habit);
  }

  async deleteHabit(habitId: string): Promise<void> {
    const existing = await db.habits.get(habitId);
    if (!existing) return;
    await db.habits.put({
      ...existing,
      deletedAt: new Date().toISOString(),
    });
  }

  async getReflection(promptId: string): Promise<ReflectionEntry | null> {
    const entry = await db.reflections.where("promptId").equals(promptId).first();
    return entry ?? null;
  }

  async getAllReflections(): Promise<ReflectionEntry[]> {
    return db.reflections.toArray();
  }

  async saveReflection(entry: ReflectionEntry): Promise<void> {
    await db.reflections.put(entry);
  }

  async getStreakFreezes(): Promise<StreakFreeze[]> {
    return db.streakFreezes.toArray();
  }

  async useStreakFreeze(forDateId: string): Promise<void> {
    await db.streakFreezes.add({
      usedAt: new Date().toISOString().slice(0, 10),
      forDateId,
    });
  }

  async getRemainingFreezes(cycleStartDate: string): Promise<number> {
    const all = await db.streakFreezes.toArray();
    const cycleStart = parseISO(cycleStartDate);
    const usedThisCycle = all.filter((f) => {
      const used = parseISO(f.usedAt);
      return differenceInCalendarDays(used, cycleStart) >= 0
        && differenceInCalendarDays(used, cycleStart) < FREEZE_CYCLE_DAYS;
    });
    return Math.max(0, MAX_FREEZES_PER_CYCLE - usedThisCycle.length);
  }

  async exportAllData(): Promise<string> {
    const [entries, habits, reflections, streakFreezes] = await Promise.all([
      db.entries.toArray(),
      db.habits.toArray(),
      db.reflections.toArray(),
      db.streakFreezes.toArray(),
    ]);
    return JSON.stringify({ entries, habits, reflections, streakFreezes });
  }

  async importAllData(json: string): Promise<void> {
    const data = parseAndValidateImport(json);

    await db.transaction("rw", [db.entries, db.habits, db.reflections, db.streakFreezes], async () => {
      await db.entries.clear();
      await db.habits.clear();
      await db.reflections.clear();
      await db.streakFreezes.clear();

      if (data.entries?.length) await db.entries.bulkAdd(data.entries);
      if (data.habits?.length) await db.habits.bulkAdd(data.habits);
      if (data.reflections?.length) await db.reflections.bulkAdd(data.reflections);
      if (data.streakFreezes?.length) await db.streakFreezes.bulkAdd(data.streakFreezes);
    });
  }

  async clearAllData(): Promise<void> {
    await db.transaction("rw", [db.entries, db.habits, db.reflections, db.streakFreezes], async () => {
      await db.entries.clear();
      await db.habits.clear();
      await db.reflections.clear();
      await db.streakFreezes.clear();
    });
  }
}
