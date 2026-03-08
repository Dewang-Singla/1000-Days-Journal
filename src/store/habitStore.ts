import { create } from "zustand";
import type { Habit } from "../db";
import storage from "../storage";

interface HabitState {
  habits: Habit[];
  isLoading: boolean;
  loadHabits: () => Promise<void>;
  addHabit: (habit: Omit<Habit, "id" | "createdAt">) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
}

export const useHabitStore = create<HabitState>((set) => ({
  habits: [],
  isLoading: false,

  async loadHabits() {
    set({ isLoading: true });
    try {
      const habits = await storage.getHabits();
      set({ habits });
    } finally {
      set({ isLoading: false });
    }
  },

  async addHabit(partial) {
    const habit: Habit = {
      ...partial,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await storage.saveHabit(habit);
    set((state) => ({ habits: [...state.habits, habit] }));
  },

  async deleteHabit(id) {
    await storage.deleteHabit(id);
    set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }));
  },
}));
