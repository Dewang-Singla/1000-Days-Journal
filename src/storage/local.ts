import { db } from "../db";
import type { DayEntry, Habit, ReflectionEntry, RedemptionDay } from "../db";
import type { StorageAdapter, ClaimResult } from "./index";
import { differenceInCalendarDays } from "date-fns";

/** All 21 redemption day IDs (Dec 4-24, 2028) */
const REDEMPTION_DAY_IDS = Array.from({ length: 21 }, (_, i) => {
  const d = i + 4;
  return `2028-12-${String(d).padStart(2, "0")}`;
});

const COOLDOWN_DAYS = 40;

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
      if (entry.isRedeemed) return false;
      if (entry.journal.toLowerCase().includes(q)) return true;
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
    return db.habits.toArray();
  }

  async saveHabit(habit: Habit): Promise<void> {
    await db.habits.put(habit);
  }

  async deleteHabit(habitId: string): Promise<void> {
    await db.habits.delete(habitId);
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

  async getRedemptions(): Promise<RedemptionDay[]> {
    return db.redemptions.toArray();
  }

  async getLastRedemptionDate(): Promise<string | null> {
    const all = await db.redemptions.toArray();
    if (all.length === 0) return null;
    all.sort((a, b) => b.usedAt.localeCompare(a.usedAt));
    return all[0].usedAt;
  }

  async claimRedemption(wastedDateId: string): Promise<ClaimResult> {
    // Check cooldown
    const lastUsed = await this.getLastRedemptionDate();
    if (lastUsed) {
      const daysSince = differenceInCalendarDays(
        new Date(),
        new Date(lastUsed + "T00:00:00"),
      );
      if (daysSince < COOLDOWN_DAYS) {
        const availDate = new Date(lastUsed + "T00:00:00");
        availDate.setDate(availDate.getDate() + COOLDOWN_DAYS);
        const y = availDate.getFullYear();
        const m = String(availDate.getMonth() + 1).padStart(2, "0");
        const d = String(availDate.getDate()).padStart(2, "0");
        return { ok: false, reason: "cooldown", availableDate: `${y}-${m}-${d}` };
      }
    }

    // Find next unused redemption day
    const usedIds = new Set((await db.redemptions.toArray()).map((r) => r.id));
    const nextId = REDEMPTION_DAY_IDS.find((id) => !usedIds.has(id));
    if (!nextId) {
      return { ok: false, reason: "exhausted" };
    }

    const redemption: RedemptionDay = {
      id: nextId,
      assignedToDateId: wastedDateId,
      usedAt: new Date().toISOString().slice(0, 10),
    };
    await db.redemptions.put(redemption);
    return { ok: true, redemption };
  }

  async exportAllData(): Promise<string> {
    const [entries, habits, reflections, redemptions] = await Promise.all([
      db.entries.toArray(),
      db.habits.toArray(),
      db.reflections.toArray(),
      db.redemptions.toArray(),
    ]);
    return JSON.stringify({ entries, habits, reflections, redemptions });
  }

  async importAllData(json: string): Promise<void> {
    const data = JSON.parse(json) as {
      entries: DayEntry[];
      habits: Habit[];
      reflections: ReflectionEntry[];
      redemptions?: RedemptionDay[];
    };

    await db.transaction("rw", db.entries, db.habits, db.reflections, db.redemptions, async () => {
      await db.entries.clear();
      await db.habits.clear();
      await db.reflections.clear();
      await db.redemptions.clear();

      if (data.entries?.length) await db.entries.bulkAdd(data.entries);
      if (data.habits?.length) await db.habits.bulkAdd(data.habits);
      if (data.reflections?.length) await db.reflections.bulkAdd(data.reflections);
      if (data.redemptions?.length) await db.redemptions.bulkAdd(data.redemptions);
    });
  }

  async clearAllData(): Promise<void> {
    await db.transaction("rw", db.entries, db.habits, db.reflections, db.redemptions, async () => {
      await db.entries.clear();
      await db.habits.clear();
      await db.reflections.clear();
      await db.redemptions.clear();
    });
  }
}
