import { useEffect, useState, useRef, useCallback } from "react";
import {
  Sun,
  Moon,
  Trash2,
  Download,
  Upload,
  Plus,
} from "lucide-react";

import storage from "../storage";
import { useUIStore } from "../store/uiStore";
import { useHabitStore } from "../store/habitStore";
import { hashPin } from "../utils/crypto";
import { TRIAL_START, GOLDEN_REFLECTION_DAY } from "../utils/dates";

/* ── Constants ──────────────────────────────────────────────── */

const HABIT_COLORS = [
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EF4444",
  "#EC4899",
];

/* ── Component ──────────────────────────────────────────────── */

type ExportStatus = "idle" | "exporting" | "done" | "error";
type ImportStatus = "idle" | "importing" | "done" | "error";
type ClearStatus = "idle" | "confirming" | "clearing" | "done";

export default function Settings() {
  /* ── Stores ─────────────────────────────────────────────── */
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const habits = useHabitStore((s) => s.habits);
  const loadHabits = useHabitStore((s) => s.loadHabits);
  const addHabit = useHabitStore((s) => s.addHabit);
  const deleteHabit = useHabitStore((s) => s.deleteHabit);

  /* ── Local state ────────────────────────────────────────── */
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importError, setImportError] = useState("");
  const [clearStatus, setClearStatus] = useState<ClearStatus>("idle");

  const [totalEntries, setTotalEntries] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [storageEstimate, setStorageEstimate] = useState("—");

  const [pinEnabled, setPinEnabled] = useState(
    () => localStorage.getItem('pin_enabled') === 'true'
  )
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const [showPinForm, setShowPinForm] = useState(false)

  /* Habit form */
  const [habitIcon, setHabitIcon] = useState("");
  const [habitName, setHabitName] = useState("");
  const [habitColor, setHabitColor] = useState(HABIT_COLORS[0]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── On mount ───────────────────────────────────────────── */
  useEffect(() => {
    loadHabits();

    storage.getAllEntries().then((entries) => {
      setTotalEntries(entries.length);
      setTotalWords(entries.reduce((s, e) => s + e.wordCount, 0));
    });

    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        const mb = ((est.usage ?? 0) / (1024 * 1024)).toFixed(1);
        setStorageEstimate(`${mb} MB used`);
      });
    }
  }, [loadHabits]);

  /* ── Export ─────────────────────────────────────────────── */
  const handleExport = useCallback(async () => {
    setExportStatus("exporting");
    try {
      const json = await storage.exportAllData();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `10-years-backup-${dateStr}.json`;

      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus("done");
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch {
      setExportStatus("error");
      setTimeout(() => setExportStatus("idle"), 3000);
    }
  }, []);

  /* ── Import ─────────────────────────────────────────────── */
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportStatus("importing");
    try {
      const text = await file.text();
      await storage.importAllData(text);
      setImportStatus("done");
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      setImportStatus("error");
      setImportError("Invalid JSON file. Please use a backup exported from this app.");
      setTimeout(() => setImportStatus("idle"), 3000);
    }
    // Reset file input so re-selecting same file works
    e.target.value = "";
  }, []);

  /* ── Clear ──────────────────────────────────────────────── */
  const handleClear = useCallback(async () => {
    setClearStatus("clearing");
    await storage.clearAllData();
    setClearStatus("done");
    setTimeout(() => window.location.reload(), 2000);
  }, []);

  /* ── PIN ────────────────────────────────────────────────── */
  const handleSavePin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinMsg('PIN must be exactly 4 digits')
      return
    }
    if (newPin !== confirmPin) {
      setPinMsg('PINs do not match')
      return
    }
    const hashed = await hashPin(newPin)
    localStorage.setItem('pin_hash', hashed)
    localStorage.setItem('pin_enabled', 'true')
    setPinEnabled(true)
    setShowPinForm(false)
    setNewPin('')
    setConfirmPin('')
    setPinMsg('PIN set successfully ✓')
  }

  const handleDisablePin = () => {
    localStorage.removeItem('pin_hash')
    localStorage.removeItem('pin_enabled')
    setPinEnabled(false)
    setShowPinForm(false)
    setPinMsg('')
  }

  /* ── Add habit ──────────────────────────────────────────── */
  const handleAddHabit = useCallback(async () => {
    const trimmed = habitName.trim();
    if (!trimmed || trimmed.length > 20) return;
    await addHabit({ name: trimmed, icon: habitIcon || "✨", color: habitColor });
    setHabitIcon("");
    setHabitName("");
    setHabitColor(HABIT_COLORS[0]);
  }, [habitIcon, habitName, habitColor, addHabit]);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="page-transition max-w-3xl mx-auto space-y-10 pb-20">
      <div>
        <h1 className="text-3xl font-serif font-bold" style={{ color: "var(--text-primary)" }}>
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Manage your journal data and preferences for {TRIAL_START.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} - {GOLDEN_REFLECTION_DAY.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* ━━━━ APPEARANCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="space-y-3">
        <h3 className="section-title">Appearance</h3>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon size={18} style={{ color: "var(--text-secondary)" }} />
              ) : (
                <Sun size={18} style={{ color: "var(--text-secondary)" }} />
              )}
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Theme
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Switch between dark and light mode
                </p>
              </div>
            </div>
            <ToggleSwitch checked={theme === "dark"} onChange={toggleTheme} />
          </div>
        </div>
      </section>

      {/* ━━━━ HABITS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="space-y-3">
        <h3 className="section-title">Habits</h3>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Manage the habits you track each day
        </p>

        <div className="card p-5 space-y-4">
          {/* Habit list */}
          {habits.length > 0 ? (
            <div className="space-y-2">
              {habits.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: "var(--bg-secondary)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{h.icon}</span>
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {h.name}
                    </span>
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ background: h.color }}
                    />
                  </div>
                  <button
                    onClick={() => deleteHabit(h.id)}
                    className="p-1.5 rounded-md cursor-pointer transition-colors"
                    style={{ color: "var(--text-muted)", background: "none", border: "none" }}
                    title="Delete habit"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
              No habits yet. Add one below.
            </p>
          )}

          {/* Add habit form */}
          <div
            className="flex flex-wrap items-end gap-3 pt-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="space-y-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>
                Icon
              </label>
              <input
                className="input-base w-14 text-center text-lg"
                placeholder="📚"
                maxLength={2}
                value={habitIcon}
                onChange={(e) => setHabitIcon(e.target.value)}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[120px]">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>
                Name
              </label>
              <input
                className="input-base w-full"
                placeholder="Habit name"
                maxLength={20}
                value={habitName}
                onChange={(e) => setHabitName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddHabit()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>
                Color
              </label>
              <div className="flex gap-1.5">
                {HABIT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setHabitColor(c)}
                    className="w-6 h-6 rounded-full cursor-pointer transition-transform"
                    style={{
                      background: c,
                      border: habitColor === c ? "2px solid var(--text-primary)" : "2px solid transparent",
                      transform: habitColor === c ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              className="btn-primary px-4 py-2 text-sm cursor-pointer flex items-center gap-1.5"
              disabled={!habitName.trim() || habitName.trim().length > 20}
              onClick={handleAddHabit}
            >
              <Plus size={14} />
              Add Habit
            </button>
          </div>
        </div>
      </section>

      {/* ━━━━ DATA & BACKUP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="space-y-3">
        <h3 className="section-title">Data &amp; Backup</h3>
        <div className="card p-5 space-y-6">
          {/* Storage info */}
          <div className="space-y-1">
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              📦 Storage used: {storageEstimate}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {totalEntries} entries · {totalWords.toLocaleString()} words written
            </p>
          </div>

          {/* Export */}
          <div
            className="flex items-center justify-between flex-wrap gap-4"
            style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Export All Data
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Download a complete backup of your journal as a JSON file
              </p>
            </div>
            <div className="flex items-center gap-3">
              {exportStatus === "done" && (
                <span className="text-xs font-medium" style={{ color: "var(--success)" }}>
                  ✓ Downloaded!
                </span>
              )}
              {exportStatus === "error" && (
                <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
                  Export failed
                </span>
              )}
              <button
                className="btn-primary px-4 py-2 text-sm cursor-pointer flex items-center gap-1.5"
                onClick={handleExport}
                disabled={exportStatus === "exporting"}
              >
                <Download size={14} />
                {exportStatus === "exporting" ? "Exporting..." : "Export JSON"}
              </button>
            </div>
          </div>

          {/* Import */}
          <div
            className="space-y-3"
            style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Import Backup
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Restore from a previously exported JSON backup. This will overwrite all current data.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {importStatus === "done" && (
                  <span className="text-xs font-medium" style={{ color: "var(--success)" }}>
                    ✓ Imported successfully! Refreshing...
                  </span>
                )}
                {importStatus === "error" && (
                  <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
                    {importError}
                  </span>
                )}
                <button
                  className="btn-ghost px-4 py-2 text-sm cursor-pointer flex items-center gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importStatus === "importing"}
                >
                  <Upload size={14} />
                  {importStatus === "importing" ? "Importing..." : "Import JSON"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImport}
                />
              </div>
            </div>
            <p
              className="text-xs font-medium px-3 py-2 rounded-lg"
              style={{ background: "rgba(245,158,11,0.1)", color: "var(--accent)" }}
            >
              ⚠ This will replace all existing entries
            </p>
          </div>
        </div>
      </section>

      {/* ━━━━ SECURITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="space-y-4">
        <h2 className="section-title">Security</h2>
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium"
                style={{ color: 'var(--text-primary)' }}>
                PIN Lock
              </p>
              <p className="text-sm"
                style={{ color: 'var(--text-muted)' }}>
                Require a 4-digit PIN to open the app
              </p>
            </div>
            <ToggleSwitch
              checked={pinEnabled}
              onChange={() => {
                if (!pinEnabled) setShowPinForm(true)
                else handleDisablePin()
              }}
            />
          </div>
          {showPinForm && (
            <div className="space-y-3 pt-2"
              style={{ borderTop: '1px solid var(--border)' }}>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="New PIN (4 digits)"
                className="input-base"
                value={newPin}
                onChange={e => setNewPin(
                  e.target.value.replace(/\D/g,'').slice(0,4)
                )}
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="Confirm PIN"
                className="input-base"
                value={confirmPin}
                onChange={e => setConfirmPin(
                  e.target.value.replace(/\D/g,'').slice(0,4)
                )}
              />
              <button className="btn-primary" onClick={handleSavePin}>
                Save PIN
              </button>
            </div>
          )}
          {pinMsg && (
            <p className="text-sm" style={{
              color: pinMsg.includes('✓') ?
                'var(--success)' : 'var(--danger)'
            }}>
              {pinMsg}
            </p>
          )}
        </div>
      </section>

      {/* ━━━━ DANGER ZONE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="space-y-3">
        <h3 className="section-title">Danger Zone</h3>
        <div
          className="rounded-xl p-5 space-y-4"
          style={{
            border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.05)",
          }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "#EF4444" }}>
              Clear All Data
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Permanently delete all journal entries, habits, and memories. This cannot be undone.
            </p>
          </div>

          {clearStatus === "idle" && (
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer"
              style={{ background: "#EF4444", color: "#fff", border: "none" }}
              onClick={() => setClearStatus("confirming")}
            >
              Clear All Data
            </button>
          )}

          {clearStatus === "confirming" && (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: "#EF4444" }}>
                Are you absolutely sure? All your entries will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer"
                  style={{ background: "#EF4444", color: "#fff", border: "none" }}
                  onClick={handleClear}
                >
                  Yes, delete everything
                </button>
                <button
                  className="btn-ghost px-4 py-2 text-sm cursor-pointer"
                  onClick={() => setClearStatus("idle")}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {clearStatus === "clearing" && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Clearing...
            </p>
          )}

          {clearStatus === "done" && (
            <p className="text-sm font-medium" style={{ color: "var(--success)" }}>
              ✓ All data cleared
            </p>
          )}
        </div>
      </section>

      {/* ━━━━ ABOUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="space-y-3">
        <h3 className="section-title">About</h3>
        <div className="card p-5 space-y-2">
          <p className="text-base font-serif font-bold" style={{ color: "var(--text-primary)" }}>
            10 Years Journal
          </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Your personal journey: {TRIAL_START.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} - {GOLDEN_REFLECTION_DAY.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Built with React, TypeScript, TailwindCSS, Dexie.js
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Version 1.0.0
          </p>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOGGLE SWITCH COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition-colors shrink-0"
      style={{
        background: checked ? "var(--accent)" : "var(--bg-secondary)",
        border: checked ? "none" : "1px solid var(--border)",
      }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full transition-transform"
        style={{
          background: checked ? "#000" : "var(--text-muted)",
          transform: checked ? "translateX(22px)" : "translateX(4px)",
        }}
      />
    </button>
  );
}
