# 1000 Days Journal

A personal journaling & habit-tracking Progressive Web App for a **1 000-day journey** (6 Mar 2026 – 30 Nov 2028). Built with React, TypeScript, and IndexedDB — your data never leaves your device.

---

## Features

| Area | Highlights |
|---|---|
| **Daily Entry** | Rich-text editor (TipTap), mood selector (5 emojis), energy bar, photo embeds, auto-save |
| **Habit Tracker** | Create / reorder habits, daily check-off, streak counter, colour labels |
| **Dashboard** | Day counter ring, current streak, mood + energy sparklines, quick-links |
| **Calendar** | Month grid colour-coded by mood, dot indicators for entries & habits |
| **Timeline** | Infinite-scroll card feed grouped by month with search filters |
| **Search** | Full-text search across entries with highlighted results |
| **Stats** | Completion heat-map, mood distribution donut, energy line chart, milestone table |
| **Reflections** | Quarterly / milestone long-form reflections with TipTap editor |
| **Settings** | Theme toggle (dark / light), optional PIN lock, export JSON, danger-zone reset |
| **PWA** | Installable on any device, works offline, background sync-ready |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 5.9 |
| Build | Vite 7 |
| Styling | Tailwind CSS 3.4 + CSS custom properties (dark / light) |
| State | Zustand 5 |
| Database | Dexie.js 4 (IndexedDB) |
| Rich Text | TipTap 3 |
| Charts | Recharts 3 |
| Dates | date-fns 4 |
| Icons | Lucide React |
| PWA | vite-plugin-pwa (Workbox) |
| Deployment | Netlify (static) |

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

---

## Getting Started

```bash
# 1. Clone the repository
git clone <your-repo-url> 1000-days-journal
cd 1000-days-journal

# 2. Install dependencies
npm install

# 3. (Optional) Regenerate PWA icons
node scripts/generate-icons.mjs

# 4. Start the dev server
npm run dev
# → opens at http://localhost:5173

# 5. Production build
npm run build

# 6. Preview the production build
npm run preview
# → opens at http://localhost:4173
```

---

## Deployment

### Netlify (recommended)

**Drag-and-drop** — run `npm run build`, then drag the `dist/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).

**GitHub integration** — connect the repo in Netlify; the included `netlify.toml` handles the build command, publish directory, and SPA redirect automatically.

### PWA Install

Once deployed over HTTPS the app is installable:

1. Open the site in Chrome / Edge / Safari.
2. Tap the **"Install"** prompt that appears, or use the browser menu → *Install app*.
3. The journal now launches from your home screen and works fully offline.

---

## Data & Privacy

All journal entries, habits, and reflections are stored **locally in IndexedDB**. Nothing is sent to any server. Use **Settings → Export JSON** to back up your data at any time.

---

## Project Structure

```
1000-days-journal/
├── public/                  # Static assets & PWA icons
├── scripts/
│   └── generate-icons.mjs   # Minimal PWA icon generator
├── src/
│   ├── components/
│   │   └── PWAInstallPrompt.tsx
│   ├── db/
│   │   └── index.ts          # Dexie database schema
│   ├── hooks/                # (reserved for custom hooks)
│   ├── pages/
│   │   ├── Calendar.tsx
│   │   ├── Dashboard.tsx
│   │   ├── DayEntry.tsx
│   │   ├── Reflection.tsx
│   │   ├── Search.tsx
│   │   ├── Settings.tsx
│   │   ├── Stats.tsx
│   │   └── Timeline.tsx
│   ├── storage/
│   │   ├── index.ts          # StorageAdapter interface
│   │   └── local.ts          # IndexedDB implementation
│   ├── store/
│   │   ├── entryStore.ts
│   │   ├── habitStore.ts
│   │   └── uiStore.ts
│   ├── utils/
│   │   └── dates.ts          # Date helpers & day-number math
│   ├── App.tsx               # Router, sidebar, PIN lock
│   ├── index.css             # Design tokens & component classes
│   └── main.tsx              # Entry point
├── index.html
├── netlify.toml
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## Journey Milestones

| Day | Date | Milestone |
|----:|------|-----------|
| 1 | 6 Mar 2026 | **Day One** — the journey begins |
| 100 | 13 Jun 2026 | First century |
| 250 | 10 Nov 2026 | Quarter-of-the-way |
| 365 | 6 Mar 2027 | One full year |
| 500 | 18 Jul 2027 | Halfway |
| 730 | 6 Mar 2028 | Two full years |
| 750 | 26 Mar 2028 | Three-quarters |
| 1000 | 30 Nov 2028 | **Day 1 000** — journey complete 🎉 |

---

## License

Private project — not currently published under an open-source licence.
