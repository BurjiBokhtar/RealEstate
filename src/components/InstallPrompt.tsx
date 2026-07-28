"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "installPromptDismissed";

// Install-app card. Chrome/Edge (desktop + Android) fire `beforeinstallprompt`
// -> we show a one-tap Install button. iOS Safari never fires it, so there we
// show the manual "Share → Add to Home Screen" hint instead (otherwise iPhone
// users get nothing). The card wears the company logo. Hidden once installed
// (standalone) or dismissed.
export function InstallPrompt() {
  const { t } = useLocale();
  const { settings } = useSettings();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"none" | "prompt" | "ios">("none");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setMode("none"));

    // iOS: no beforeinstallprompt ever. If this is an iPhone/iPad in Safari and
    // not already installed, offer the manual instructions after a moment
    // (only if Chrome's event hasn't taken over).
    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIOS && isSafari) {
      const id = window.setTimeout(() => setMode((m) => (m === "none" ? "ios" : m)), 1200);
      return () => {
        window.clearTimeout(id);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setMode("none");
  };

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setMode("none");
  };

  if (mode === "none") return null;

  const icon = settings.company_logo_url || "/icon-192.png";

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-brand-strong px-4 py-3 text-white shadow-2xl shadow-black/30 print:hidden sm:bottom-4 sm:left-auto sm:right-4 sm:mx-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white/90 object-contain p-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{t.pwa.installTitle}</p>
        <p className="text-xs leading-snug text-white/70">
          {mode === "ios" ? t.pwa.iosHint : t.pwa.installHint}
        </p>
      </div>
      {mode === "prompt" && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition-all hover:shadow active:scale-95"
        >
          {t.pwa.install}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.pwa.later}
        title={t.pwa.later}
        className="shrink-0 rounded-md p-1 text-white/60 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
