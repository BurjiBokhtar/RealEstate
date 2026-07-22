"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Honest connection indicator. When the internet drops, the app keeps
// running on its cached shell, but any data on screen is the last thing
// loaded and NEW actions (payments, bookings) can't be saved -- so the bar
// says exactly that instead of letting someone think a payment went through.
// When the connection returns, it offers a one-tap refresh to pull the
// current data from the server.
export function OfflineBanner() {
  const { t } = useLocale();
  // Start "online" for SSR; correct on mount to avoid a hydration flash.
  const [online, setOnline] = useState(true);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOffline = () => {
      setOnline(false);
      setReconnected(false);
    };
    const goOnline = () => {
      setOnline(true);
      setReconnected(true);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (online && !reconnected) return null;

  if (!online) {
    return (
      <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white print:hidden">
        <span className="inline-block h-2 w-2 rounded-full bg-white/90" />
        {t.offline.offline}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-emerald-600 px-4 py-1.5 text-center text-xs font-medium text-white print:hidden">
      {t.offline.backOnline}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full bg-white/20 px-3 py-0.5 font-semibold transition-colors hover:bg-white/30"
      >
        {t.offline.refresh}
      </button>
    </div>
  );
}
