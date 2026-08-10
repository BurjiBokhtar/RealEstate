"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Honest connection indicator. When the internet drops, the app keeps
// running on its cached shell, but any data on screen is the last thing
// loaded and NEW actions (payments, bookings) can't be saved -- so the bar
// says exactly that instead of letting someone think a payment went through.
// When the connection returns, it offers a one-tap refresh to pull the
// current data from the server.
function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const isOnline = () => navigator.onLine;

export function OfflineBanner() {
  const { t } = useLocale();
  // Whether the browser is online is not React state -- it is a fact about
  // the machine that changes on its own. Subscribing to it is what
  // useSyncExternalStore is for; the previous version copied it into state
  // from inside an effect, which meant an extra render on every mount just to
  // correct a guess. The server has no connection to report, so it says
  // "online" and the browser corrects it during hydration without a flash.
  const online = useSyncExternalStore(subscribeToConnection, isOnline, () => true);

  // Not a snapshot but a transition -- "was offline, now back" -- so it stays
  // ordinary state, set from the event callbacks rather than from the effect
  // body.
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    const goOffline = () => setReconnected(false);
    const goOnline = () => setReconnected(true);
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
