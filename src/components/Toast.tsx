"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error";

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
    }, 3500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!message) return null;

  const isSuccess = type === "success";

  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 ring-black/5 transition-all duration-300 ${
        visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
      } ${isSuccess ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
        {isSuccess ? "✓" : "!"}
      </span>
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setTimeout(onDismiss, 300);
        }}
        className="ml-1 shrink-0 rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
