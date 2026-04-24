import { create } from "zustand";
import type { DayEntry } from "../db";
import { parseISO } from "date-fns";
import storage from "../storage";
import { getDayNumber, dateToId } from "../utils/dates";
import { normalizeCheckpointPrompts } from "../utils/checkpoints";

interface EntryState {
  currentEntry: DayEntry | null;
  isLoading: boolean;
  loadError: string | null;
  isSaving: boolean;
  saveError: string | null;
  lastSaved: Date | null;
  loadEntry: (dateId: string) => Promise<void>;
  saveEntry: (entry: DayEntry) => Promise<void>;
  updateField: <K extends keyof DayEntry>(field: K, value: DayEntry[K]) => void;
  createEmptyEntry: (dateId: string) => DayEntry;
  clearLoadError: () => void;
  clearSaveError: () => void;
  clearCurrentEntry: () => void;
}

export const useEntryStore = create<EntryState>((set, get) => ({
  currentEntry: null,
  isLoading: false,
  loadError: null,
  isSaving: false,
  saveError: null,
  lastSaved: null,

  createEmptyEntry(dateId: string): DayEntry {
    const date = parseISO(dateId);
    const now = new Date().toISOString();
    return {
      id: dateId,
      dayNumber: getDayNumber(date),
      date: dateToId(date),
      moodRating: -1,
      moodEmoji: "",
      ratingChecks: Array.from({ length: 10 }, () => false),
      checkpointPrompts: normalizeCheckpointPrompts(undefined),
      quoteOfDay: "",
      isQuoteStarred: false,
      journal: "",
      todos: [],
      habitLogs: [],
      tags: [],
      gratitude: [],
      memories: [],
      isHighlight: false,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  },

  async loadEntry(dateId: string) {
    set({ isLoading: true, loadError: null });
    try {
      const entry = await storage.getEntry(dateId);
      if (entry) {
        set({ currentEntry: entry });
      } else {
        const empty = get().createEmptyEntry(dateId);
        set({ currentEntry: empty });
      }
    } catch (err) {
      const fallback = get().createEmptyEntry(dateId);
      set({
        currentEntry: fallback,
        loadError: err instanceof Error ? err.message : "Failed to load entry",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  async saveEntry(entry: DayEntry) {
    set({ isSaving: true });
    try {
      await storage.saveEntry(entry);
      set({ isSaving: false, lastSaved: new Date(), currentEntry: entry, saveError: null });
    } catch (err) {
      set({
        isSaving: false,
        saveError: err instanceof Error
          ? err.message
          : "Failed to save entry",
      });
    }
  },

  updateField<K extends keyof DayEntry>(field: K, value: DayEntry[K]) {
    const current = get().currentEntry;
    if (!current) return;
    set({
      currentEntry: { ...current, [field]: value, updatedAt: new Date().toISOString() },
    });
  },

  clearLoadError() {
    set({ loadError: null });
  },

  clearSaveError() {
    set({ saveError: null });
  },

  clearCurrentEntry() {
    set({ currentEntry: null, lastSaved: null, saveError: null, loadError: null });
  },
}));
