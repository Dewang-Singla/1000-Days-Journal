import { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  PenLine,
  CalendarDays,
  Clock,
  BarChart3,
  Search,
  Sparkles,
  Settings as SettingsIcon,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
} from "lucide-react";

import Dashboard from "./pages/Dashboard";
import DayEntry from "./pages/DayEntry";
import Calendar from "./pages/Calendar";
import Timeline from "./pages/Timeline";
import Stats from "./pages/Stats";
import SearchPage from "./pages/Search";
import Reflection from "./pages/Reflection";
import Settings from "./pages/Settings";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { useUIStore } from "./store/uiStore";
import { getDayNumber, getTodayDateId } from "./utils/dates";
import storage from "./storage";

/* ── Nav config ─────────────────────────────────────────────── */

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/entry", label: "Day Entry", icon: PenLine },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/timeline", label: "Timeline", icon: Clock },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/search", label: "Search", icon: Search },
  { to: "/reflection", label: "Reflection", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const mobileTabItems = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: `/entry/${getTodayDateId()}`, label: "Today", icon: BookOpen },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/timeline", label: "Timeline", icon: List },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/search", label: "Search", icon: Search },
];

/* ── Crypto helper ──────────────────────────────────────────── */

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin + 'journal-salt-1000days')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/* ── App ────────────────────────────────────────────────────── */

function App() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);

  const today = new Date();
  const rawDayNumber = getDayNumber(today);

  const [redeemedCount, setRedeemedCount] = useState(0);
  useEffect(() => {
    storage.getAllEntries().then((all) => {
      setRedeemedCount(all.filter((e) => e.isRedeemed).length);
    });
  }, []);

  const dayNumber = Math.max(rawDayNumber - redeemedCount, 0);
  const progress = Math.min(Math.max(dayNumber / 1000, 0), 1);

  /* ── PIN lock state ─────────────────────────────────────── */
  const [isLocked, setIsLocked] = useState(false)
  const [pinDigits, setPinDigits] = useState(['','','',''])
  const [pinError, setPinError] = useState('')
  const [pinAttempts, setPinAttempts] = useState(0)
  const [pinShake, setPinShake] = useState(false)
  const [pinReady, setPinReady] = useState(false)

  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  useEffect(() => {
    const enabled = localStorage.getItem('pin_enabled') === 'true'
    const hash = localStorage.getItem('pin_hash') ?? ''
    if (enabled && hash.length >= 60) {
      setIsLocked(true)
    }
    setPinReady(true)
  }, [])

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...pinDigits]
    newDigits[index] = digit
    setPinDigits(newDigits)
    if (digit && index < 3) {
      pinRefs[index + 1].current?.focus()
    }
  }

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1].current?.focus()
    }
  }

  const handleUnlock = async () => {
    const pin = pinDigits.join('')
    if (pin.length < 4) {
      setPinError('Enter all 4 digits')
      return
    }
    const stored = localStorage.getItem('pin_hash') ?? ''
    if (!stored || stored.length < 60) {
      setPinError('No PIN set. Go to Settings to set one.')
      return
    }
    const hashed = await hashPin(pin)
    if (hashed === stored) {
      setIsLocked(false)
      setPinError('')
      setPinDigits(['','','',''])
    } else {
      setPinAttempts(p => p + 1)
      setPinError('Incorrect PIN')
      setPinDigits(['','','',''])
      setPinShake(true)
      pinRefs[0].current?.focus()
      setTimeout(() => setPinShake(false), 400)
    }
  }

  /* ── PIN lock screen ────────────────────────────────────── */
  if (!pinReady) return null

  if (isLocked) {
    return (
      <div className={theme === 'light' ? 'light' : ''}>
        <div className="flex items-center justify-center min-h-screen"
          style={{ background: 'var(--bg-primary)' }}>
          <div className="card text-center"
            style={{ maxWidth: 340, padding: 40 }}>
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-serif font-bold mb-1"
              style={{ color: 'var(--text-primary)' }}>
              1000 Days Journal
            </h2>
            <p className="text-sm mb-8"
              style={{ color: 'var(--text-muted)' }}>
              Enter your PIN to continue
            </p>
            {pinAttempts >= 5 ? (
              <p style={{ color: 'var(--danger)' }}>
                Too many attempts. Please refresh the page.
              </p>
            ) : (
              <>
                <div className={`flex gap-3 justify-center mb-6 ${pinShake ? 'shake' : ''}`}>
                  {[0,1,2,3].map(i => (
                    <input
                      key={i}
                      ref={pinRefs[i]}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      autoFocus={i === 0}
                      value={pinDigits[i]}
                      onChange={e => handleDigitChange(i, e.target.value)}
                      onKeyDown={e => handleDigitKeyDown(i, e)}
                      style={{
                        width: 56, height: 56,
                        textAlign: 'center',
                        fontSize: '1.5rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                      onFocus={e =>
                        e.target.style.borderColor = 'var(--accent)'}
                      onBlur={e =>
                        e.target.style.borderColor = 'var(--border)'}
                    />
                  ))}
                </div>
                <button className="btn-primary w-full mb-3"
                  onClick={handleUnlock}>
                  Unlock
                </button>
                {pinError && (
                  <p className="text-sm"
                    style={{ color: 'var(--danger)' }}>
                    {pinError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ── Main layout ────────────────────────────────────────── */
  return (
    <div className={theme === "light" ? "light" : ""}>
      <div
        className="flex h-screen"
        style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        {/* ── Desktop Sidebar ────────────────────────────── */}
        <aside
          className="hidden md:flex shrink-0 flex-col overflow-hidden"
          style={{
            width: sidebarCollapsed ? "64px" : "240px",
            transition: "width 0.25s ease",
            background: "var(--bg-secondary)",
            borderRight: "1px solid var(--border)",
          }}
        >
          {/* Collapse toggle + title */}
          <div className="flex items-center px-3 py-4" style={{ minHeight: 56 }}>
            {!sidebarCollapsed && (
              <span
                className="flex-1 pl-3 text-lg font-bold tracking-tight font-serif truncate"
                style={{ color: "var(--text-primary)" }}
              >
                1000 Days Journal
              </span>
            )}
            <button
              onClick={toggleSidebarCollapsed}
              className="p-1.5 rounded-lg cursor-pointer shrink-0"
              style={{ color: "var(--text-muted)", background: "none", border: "none" }}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-2 space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                title={label}
                className="flex items-center rounded-lg text-sm font-medium transition-colors"
                style={({ isActive }) => ({
                  background: isActive ? "var(--accent-subtle)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  padding: sidebarCollapsed ? "8px 0" : "8px 12px",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: sidebarCollapsed ? 0 : 12,
                })}
              >
                <Icon size={18} />
                {!sidebarCollapsed && (
                  <span className="truncate">{label}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom section */}
          <div
            className="px-2 py-4 space-y-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center w-full rounded-lg text-sm font-medium transition-colors cursor-pointer"
              style={{
                color: "var(--text-secondary)",
                background: "transparent",
                border: "none",
                padding: sidebarCollapsed ? "8px 0" : "8px 12px",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: sidebarCollapsed ? 0 : 8,
              }}
              title={theme === "dark" ? "Light Mode" : "Dark Mode"}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              {!sidebarCollapsed && (theme === "dark" ? "Light Mode" : "Dark Mode")}
            </button>

            {/* Day progress — hidden when collapsed */}
            {!sidebarCollapsed && (
              <div className="space-y-2 px-1">
                <div className="flex justify-between items-baseline text-xs">
                  <span style={{ color: "var(--text-primary)" }} className="font-semibold">
                    {dayNumber <= 0 ? "Starts Mar 6, 2026" : `Day ${dayNumber} of 1000`}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {dayNumber <= 0 ? "0%" : `${Math.round(progress * 100)}%`}
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${dayNumber <= 0 ? 0 : progress * 100}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ───────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-8 pb-16 md:pb-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/entry" element={<DayEntry />} />
            <Route path="/entry/:dateId" element={<DayEntry />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/reflection" element={<Reflection />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        {/* ── Mobile Bottom Tab Bar ──────────────────────── */}
        <MobileTabBar />
        {/* ── PWA Install/Update Prompt ───────────────── */}
        <PWAInstallPrompt />      </div>
    </div>
  );
}

/* ── Mobile Tab Bar ─────────────────────────────────────────── */

function MobileTabBar() {
  const location = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
      style={{
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        height: 60,
      }}
    >
      {mobileTabItems.map(({ to, label, icon: Icon }) => {
        const isActive =
          to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(to.split("/").slice(0, 2).join("/"));

        return (
          <NavLink
            key={to}
            to={to}
            className="flex-1 flex flex-col items-center justify-center gap-0.5"
            style={{
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              textDecoration: "none",
            }}
          >
            <Icon size={20} />
            <span style={{ fontSize: 10 }}>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default App;