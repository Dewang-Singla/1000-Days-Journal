# 1000 Days Journal

A personal journaling & habit-tracking Progressive Web App for a **1,000-day journey** (10 Mar 2026 – 3 Dec 2028). Built with React, TypeScript, and IndexedDB — your data never leaves your device.

---

## Features

| Area | Highlights |
|---|---|
| **Daily Entry** | Rich-text editor (TipTap), mood rating (0–10) with auto emoji, auto-save with debounce |
| **Time Rules** | Today's entry unlocks at 8 PM · Yesterday editable until noon · Older days always editable |
| **Habit Tracker** | Create habits, daily check-off, streak counter, colour labels |
| **Memories** | Attach text, images (base64), YouTube embeds, or links to any day |
| **Dashboard** | Day counter, progress bar, current streak, avg mood, recent entries, highlights, random entry |
| **Calendar** | Month grid colour-coded by mood, memory dots, highlight stars, redeemed day indicators |
| **Timeline** | Chronological feed, filter by tag or highlights, load more pagination |
| **Search** | Full-text search across entries, mood & tag filters, highlighted snippets |
| **Stats** | Overview, mood trends, habit completion, tag frequency — all via Recharts |
| **Reflection** | Unlocks December 4, 2028 · 6 tabs: Overview, 2026, 2027, 2028, Prompts, Vision Board |
| **Redemption System** | Rate a day 0–2 → claim a Dec 4–24 replacement day · 40-day cooldown · 21 total |
| **Security** | PIN lock (SHA-256 hashed) · 4-box PIN entry screen · set/disable in Settings |
| **Settings** | Theme toggle (dark/light), habits management, export/import JSON, danger-zone reset |
| **PWA** | Installable on any device, works fully offline via Workbox service worker |

---

## How the Redemption System Works

If you rate a day 0, 1, or 2 out of 10, the app offers you a **redemption**:

- The bad day is marked as redeemed — it turns red on the calendar, is locked from editing, and is excluded from all stats and counts
- A December 2028 day (Dec 4–24) is assigned as its replacement and becomes a normal writable journal day
- You have **21 redemption days** total (Dec 4–24)
- A **40-day cooldown** applies between redemptions
- The remaining **Dec 25–31** are reserved for reflection

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

**GitHub integration** — connect the repo in Netlify; the included `netlify.toml` handles the build command, publish directory, and SPA redirect automatically. Every push to `main` triggers an auto-deploy.

### PWA Install

Once deployed over HTTPS the app is installable:

1. Open the site in Chrome / Edge / Safari.
2. Tap the **"Install"** prompt that appears, or use the browser menu → *Install app*.
3. The journal now launches from your home screen and works fully offline.

---

## Data & Privacy

All journal entries, habits, reflections, and redemptions are stored **locally in IndexedDB**. Nothing is sent to any server. Use **Settings → Export JSON** to back up your data regularly.

The optional **PIN lock** uses SHA-256 hashing stored in `localStorage`. It protects the UI from casual access but does not encrypt the underlying IndexedDB data.

---

## Project Structure

```
1000-days-journal/
├── public/                  # Static assets & PWA icons
├── scripts/
│   └── generate-icons.mjs   # PWA icon generator
├── src/
│   ├── components/
│   │   └── PWAInstallPrompt.tsx
│   ├── db/
│   │   └── index.ts          # Dexie schema (entries, habits, reflections, redemptions)
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
│   │   └── local.ts          # IndexedDB implementation + redemption logic
│   ├── store/
│   │   ├── entryStore.ts
│   │   ├── habitStore.ts
│   │   ├── redemptionStore.ts
│   │   └── uiStore.ts
│   ├── utils/
│   │   └── dates.ts          # Date helpers, day-number math, journey constants
│   ├── App.tsx               # Router, sidebar, PIN lock screen
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
| 1 | 10 Mar 2026 | **Day One** — the journey begins |
| 100 | 17 Jun 2026 | First century |
| 250 | 14 Nov 2026 | Quarter-of-the-way |
| 365 | 9 Mar 2027 | One full year |
| 500 | 22 Jul 2027 | Halfway |
| 730 | 8 Mar 2028 | Two full years |
| 750 | 28 Mar 2028 | Three-quarters |
| 1000 | 3 Dec 2028 | **Day 1,000** — journey complete 🎉 |

---

## License

Private project — not published under an open-source licence.
