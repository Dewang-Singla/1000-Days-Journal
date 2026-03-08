import type { DayEntry, Habit, ReflectionEntry, RedemptionDay } from "../db";
import { LocalStorageAdapter } from "./local";

export type ClaimResult =
  | { ok: true; redemption: RedemptionDay }
  | { ok: false; reason: "cooldown"; availableDate: string }
  | { ok: false; reason: "exhausted" };

export interface StorageAdapter {
  getEntry(dateId: string): Promise<DayEntry | null>;
  saveEntry(entry: DayEntry): Promise<void>;
  getAllEntries(): Promise<DayEntry[]>;
  deleteEntry(dateId: string): Promise<void>;
  getEntriesByTag(tag: string): Promise<DayEntry[]>;
  searchEntries(query: string): Promise<DayEntry[]>;
  getHighlights(): Promise<DayEntry[]>;
  getHabits(): Promise<Habit[]>;
  saveHabit(habit: Habit): Promise<void>;
  deleteHabit(habitId: string): Promise<void>;
  getReflection(promptId: string): Promise<ReflectionEntry | null>;
  getAllReflections(): Promise<ReflectionEntry[]>;
  saveReflection(entry: ReflectionEntry): Promise<void>;
  getRedemptions(): Promise<RedemptionDay[]>;
  claimRedemption(wastedDateId: string): Promise<ClaimResult>;
  getLastRedemptionDate(): Promise<string | null>;
  exportAllData(): Promise<string>;
  importAllData(json: string): Promise<void>;
  clearAllData(): Promise<void>;
}

const storage: StorageAdapter = new LocalStorageAdapter();
export default storage;
