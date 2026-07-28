"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "installPromptDismissed";

// A small "Install app" card. On Chrome/Edge (desktop + Android) the browser
// fires `beforeinstallprompt`; we stash it and offer our own button so the
// install invitation is visible instead of buried in the browser menu. Once
// installed (standalone display) or dismissed, it stays hidden.
export function InstallPrompt() {
  const { t } = useLocale();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already installed → nothing to offer.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setVisible(false));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-brand-strong px-4 py-3 text-white shadow-2xl shadow-black/30 print:hidden sm:left-auto sm:right-4 sm:mx-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{t.pwa.installTitle}</p>
        <p className="truncate text-xs text-white/70">{t.pwa.installHint}</p>
      </div>
      <button
        type="button"
        onClick={install}
        className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition-all hover:shadow active:scale-95"
      >
        {t.pwa.install}
      </button>
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
