import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ["Playfair Display", "serif"],
        sans: ["DM Sans", "sans-serif"],
      },
      colors: {
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-subtle": "var(--accent-subtle)",
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-card": "var(--bg-card)",
        "bg-card-hover": "var(--bg-card-hover)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        "mood-1": "var(--mood-1)",
        "mood-2": "var(--mood-2)",
        "mood-3": "var(--mood-3)",
        "mood-4": "var(--mood-4)",
        "mood-5": "var(--mood-5)",
        "mood-6": "var(--mood-6)",
        "mood-7": "var(--mood-7)",
        "mood-8": "var(--mood-8)",
        "mood-9": "var(--mood-9)",
        "mood-10": "var(--mood-10)",
      },
    },
  },
  plugins: [],
};

export default config;
