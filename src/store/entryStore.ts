import { create } from "zustand";
import type { DayEntry } from "../db";
import storage from "../storage";
import { getDayNumber, dateToId } from "../utils/dates";

interface EntryState {
  currentEntry: DayEntry | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  loadEntry: (dateId: string) => Promise<void>;
  saveEntry: (entry: DayEntry) => Promise<void>;
  updateField: <K extends keyof DayEntry>(field: K, value: DayEntry[K]) => void;
  createEmptyEntry: (dateId: string) => DayEntry;
  clearCurrentEntry: () => void;
}

export const useEntryStore = create<EntryState>((set, get) => ({
  currentEntry: null,
  isLoading: false,
  isSaving: false,
  lastSaved: null,

  createEmptyEntry(dateId: string): DayEntry {
    const date = new Date(dateId + "T00:00:00");
    const now = new Date().toISOString();
    return {
      id: dateId,
      dayNumber: getDayNumber(date),
      date: dateToId(date),
      moodRating: -1,
      moodEmoji: "",
      journal: "",
      todos: [],
      habitLogs: [],
      tags: [],
      gratitude: [],
      memories: [],
      isHighlight: false,
      isRedeemed: false,
      redemptionDayId: "",
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  },

  async loadEntry(dateId: string) {
    set({ isLoading: true });
    try {
      const entry = await storage.getEntry(dateId);
      if (entry) {
        set({ currentEntry: entry });
      } else {
        const empty = get().createEmptyEntry(dateId);
        set({ currentEntry: empty });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  async saveEntry(entry: DayEntry) {
    set({ isSaving: true });
    try {
      await storage.saveEntry(entry);
      set({ isSaving: false, lastSaved: new Date(), currentEntry: entry });
    } catch {
      set({ isSaving: false });
    }
  },

  updateField<K extends keyof DayEntry>(field: K, value: DayEntry[K]) {
    const current = get().currentEntry;
    if (!current) return;
    set({
      currentEntry: { ...current, [field]: value, updatedAt: new Date().toISOString() },
    });
  },

  clearCurrentEntry() {
    set({ currentEntry: null, lastSaved: null });
  },
}));
