import { create } from "zustand";
import { getTodayDateId } from "../utils/dates";

type Theme = "dark" | "light";

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  currentDateId: string;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  toggleSidebarCollapsed: () => void;
  setCurrentDateId: (dateId: string) => void;
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable
  }
  return "dark";
}

function applyThemeClass(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// Apply saved theme immediately on module load
const initialTheme = getInitialTheme();
applyThemeClass(initialTheme);

export const useUIStore = create<UIState>((set) => ({
  theme: initialTheme,
  sidebarOpen: true,
  sidebarCollapsed: false,
  currentDateId: getTodayDateId(),

  toggleTheme() {
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      applyThemeClass(next);
      return { theme: next };
    });
  },

  toggleSidebar() {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  toggleSidebarCollapsed() {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setCurrentDateId(dateId: string) {
    set({ currentDateId: dateId });
  },
}));
