"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useConfirm } from "@/components/ConfirmDialog";

const SIZE_CLASSES = {
  md: "max-w-xl",
  lg: "max-w-3xl",
};

// A dialog. With `guardClose`, an accidental Esc / click-outside / ✕ won't
// silently throw away a half-filled form: once anything inside has been typed
// or changed, closing asks for confirmation first. Deliberate saves close
// through their own handlers (not these), so they're never blocked.
export function Modal({
  title,
  onClose,
  children,
  size = "md",
  guardClose = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
  guardClose?: boolean;
}) {
  const { t } = useLocale();
  const confirm = useConfirm();
  const [touched, setTouched] = useState(false);

  // Latest close logic behind a ref so the one-time Esc listener always sees
  // the current `touched`/`onClose` without re-binding on every keystroke.
  const requestClose = async () => {
    if (guardClose && touched && !(await confirm(t.common.discardConfirm))) return;
    onClose();
  };
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
      onClick={() => closeRef.current()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onInput={() => setTouched(true)}
        onChange={() => setTouched(true)}
        className={`animate-modal-panel max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-[var(--surface-1)] p-6 shadow-2xl ${SIZE_CLASSES[size]}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--ink-1)]">{title}</h2>
          <button
            type="button"
            onClick={() => closeRef.current()}
            className="rounded-md p-1 text-[var(--ink-5)] hover:bg-[var(--hover-c2)] hover:text-[var(--ink-3)]"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
