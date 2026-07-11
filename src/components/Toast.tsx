"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error";

const DURATION_MS = 3500;

export function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string | null;
  type: ToastType;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!message) return null;

  const isSuccess = type === "success";

  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-50 flex max-w-sm origin-bottom-right flex-col overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 ${
        isSuccess
          ? "shadow-emerald-900/30 ring-1 ring-emerald-400/40"
          : "shadow-rose-900/30 ring-1 ring-rose-400/40"
      } ${
        visible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-4 scale-90 opacity-0"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3.5 text-white ${
          isSuccess
            ? "bg-gradient-to-br from-emerald-500 to-emerald-700"
            : "bg-gradient-to-br from-rose-500 to-rose-700"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-base font-bold shadow-inner">
          {isSuccess ? "✓" : "!"}
        </span>
        <span className="text-sm font-semibold leading-snug">{message}</span>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="ml-1 shrink-0 rounded-full p-1 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
        >
          ×
        </button>
      </div>
      {/* Countdown bar -- keyed by message so the animation restarts fresh
          for each new toast instead of continuing a stale one. */}
      <div className="h-1 w-full bg-black/10">
        {visible && (
          <div
            key={message}
            className={`h-full origin-left ${isSuccess ? "bg-white/70" : "bg-white/70"}`}
            style={{
              animation: `toast-countdown ${DURATION_MS}ms linear forwards`,
            }}
          />
        )}
      </div>
    </div>
  );
}
