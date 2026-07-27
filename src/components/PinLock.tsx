"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const PIN_KEY = "appPinHash";
// Lock the screen after this much inactivity. A short window is deliberate --
// the app is often left open on a shared front desk.
const LOCK_AFTER_MS = 30_000;
const PIN_LEN = 4;

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`realestate-pin:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// A device-local PIN screen-lock layered on top of the login session. On first
// open the user sets a 4-digit PIN; after that the app locks on every open and
// after 30s of inactivity, and the PIN is required to get back in. This is a
// privacy shade for a shared desk, not a replacement for the login -- the
// Supabase session still gates the real data.
export function PinLock() {
  const { t } = useLocale();
  const [ready, setReady] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [locked, setLocked] = useState(false);
  // Setup collects the PIN twice; unlock just once.
  const [firstEntry, setFirstEntry] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState("");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const stored = window.localStorage.getItem(PIN_KEY);
    setHasPin(!!stored);
    if (stored) setLocked(true); // lock on open
    setReady(true);
  }, []);

  // Inactivity auto-lock: only while a PIN exists and we're currently unlocked.
  useEffect(() => {
    if (!hasPin || locked) return;
    const arm = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLocked(true), LOCK_AFTER_MS);
    };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      window.clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [hasPin, locked]);

  const press = useCallback(
    async (digit: string) => {
      setError("");
      const next = (entry + digit).slice(0, PIN_LEN);
      setEntry(next);
      if (next.length < PIN_LEN) return;

      // Setup flow: capture, then confirm.
      if (!hasPin) {
        if (firstEntry === null) {
          setFirstEntry(next);
          setEntry("");
          return;
        }
        if (firstEntry !== next) {
          setError(t.pin.mismatch);
          setFirstEntry(null);
          setEntry("");
          return;
        }
        window.localStorage.setItem(PIN_KEY, await hashPin(next));
        setHasPin(true);
        setLocked(false);
        setFirstEntry(null);
        setEntry("");
        return;
      }

      // Unlock flow.
      const stored = window.localStorage.getItem(PIN_KEY);
      if ((await hashPin(next)) === stored) {
        setLocked(false);
        setEntry("");
      } else {
        setError(t.pin.wrong);
        setEntry("");
      }
    },
    [entry, hasPin, firstEntry, t]
  );

  if (!ready) return null;
  // Nothing to show once a PIN exists and the screen is unlocked.
  if (hasPin && !locked) return null;

  const inSetup = !hasPin;
  const title = inSetup
    ? firstEntry === null
      ? t.pin.setNew
      : t.pin.repeatNew
    : t.pin.locked;

  return (
    <div className="hero-gradient fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 p-6 text-white">
      <div className="flex flex-col items-center gap-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        </span>
        <p className="text-lg font-semibold">{title}</p>
        {inSetup && <p className="text-xs text-white/70">{t.pin.setupHint}</p>}
      </div>

      {/* Dots showing entered length */}
      <div className="flex gap-3">
        {Array.from({ length: PIN_LEN }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border border-white/50 transition-colors ${
              i < entry.length ? "bg-white" : "bg-transparent"
            }`}
          />
        ))}
      </div>

      <p className="h-4 text-sm text-amber-200">{error}</p>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="h-16 w-16 rounded-full bg-white/10 text-2xl font-semibold backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          type="button"
          onClick={() => press("0")}
          className="h-16 w-16 rounded-full bg-white/10 text-2xl font-semibold backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => {
            setError("");
            setEntry((e) => e.slice(0, -1));
          }}
          aria-label="⌫"
          className="flex h-16 w-16 items-center justify-center rounded-full text-2xl text-white/70 transition-colors hover:text-white"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
