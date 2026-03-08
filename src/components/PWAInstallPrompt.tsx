import { useState, useEffect, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { X } from "lucide-react";

/* ── Type for beforeinstallprompt event ──────────────────────── */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/* ── Shared install-prompt hook ──────────────────────────────── */

let _deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyAll() {
  for (const fn of listeners) fn();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    _deferredPrompt = e as BeforeInstallPromptEvent;
    notifyAll();
  });
}

function useInstallPrompt() {
  const [ready, setReady] = useState(_deferredPrompt !== null);

  useEffect(() => {
    const update = () => setReady(_deferredPrompt !== null);
    listeners.add(update);
    update();
    return () => { listeners.delete(update); };
  }, []);

  const install = useCallback(async () => {
    if (!_deferredPrompt) return;
    await _deferredPrompt.prompt();
    _deferredPrompt = null;
    setReady(false);
    notifyAll();
  }, []);

  return { ready, install };
}

/* ── Detect iOS (no beforeinstallprompt) ─────────────────────── */

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as any).standalone === true)
  );
}

/* ══════════════════════════════════════════════════════════════
   InstallBanner — inline card for Dashboard
   ══════════════════════════════════════════════════════════════ */

export function InstallBanner() {
  const { ready, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("install_dismissed") === "1",
  );
  const standalone = isStandalone();

  const dismiss = useCallback(() => {
    localStorage.setItem("install_dismissed", "1");
    setDismissed(true);
  }, []);

  if (dismissed || standalone) return null;

  /* ── iOS banner ──────────────────────────────────────────── */
  if (!ready && isIOS()) {
    return (
      <div
        className="card flex items-start gap-4 p-5"
        style={{ borderLeft: "4px solid var(--accent)" }}
      >
        <span className="text-3xl shrink-0">📲</span>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Install on iPhone / iPad
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Tap the Share button (□↑) then &ldquo;Add to Home Screen&rdquo;
          </p>
        </div>
        <button
          onClick={dismiss}
          className="btn-ghost px-3 py-1.5 text-xs shrink-0"
        >
          Dismiss
        </button>
      </div>
    );
  }

  /* ── Standard install banner ─────────────────────────────── */
  if (!ready) return null;

  return (
    <div
      className="card flex items-center gap-4 p-5"
      style={{ borderLeft: "4px solid var(--accent)" }}
    >
      <span className="text-3xl shrink-0">📲</span>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
          Install 1000 Days Journal
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Add to your desktop or home screen — works offline, no app store needed
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button className="btn-primary px-4 py-2 text-sm" onClick={install}>
          Install App
        </button>
        <button className="btn-ghost px-3 py-2 text-sm" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PWAInstallPrompt — bottom-right toast (App.tsx)
   ══════════════════════════════════════════════════════════════ */

export default function PWAInstallPrompt() {
  /* ── SW update toast ──────────────────────────────────────── */
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  /* ── Install prompt (small toast) ─────────────────────────── */
  const { ready: showInstall, install: handleInstall } = useInstallPrompt();
  const [toastDismissed, setToastDismissed] = useState(false);

  return (
    <>
      {/* Install toast (small, bottom-right — complementary to the Dashboard banner) */}
      {showInstall && !toastDismissed && (
        <div
          className="card fixed z-[100] right-4"
          style={{
            bottom: 80,
            padding: 16,
            maxWidth: 280,
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              📲 Install 1000 Days Journal
            </p>
            <button
              onClick={() => setToastDismissed(true)}
              className="shrink-0 cursor-pointer"
              style={{ color: "var(--text-muted)", background: "none", border: "none" }}
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Add to home screen for the best experience
          </p>
          <div className="flex gap-2">
            <button
              className="btn-primary px-3 py-1.5 text-xs cursor-pointer"
              onClick={handleInstall}
            >
              Install
            </button>
            <button
              className="btn-ghost px-3 py-1.5 text-xs cursor-pointer"
              onClick={() => setToastDismissed(true)}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Update available toast */}
      {needRefresh && (
        <button
          onClick={() => updateServiceWorker(true)}
          className="card fixed z-[100] right-4 cursor-pointer text-sm"
          style={{
            bottom: showInstall && !toastDismissed ? 180 : 80,
            padding: "12px 16px",
            maxWidth: 280,
            color: "var(--accent)",
            border: "1px solid var(--accent)",
            background: "var(--bg-card)",
          }}
        >
          Update available — click to refresh
        </button>
      )}
    </>
  );
}
