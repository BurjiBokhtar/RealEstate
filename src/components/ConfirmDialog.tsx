"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type ConfirmOptions = {
  // Destructive actions (delete) get the red icon/button; anything else
  // (discard unsaved changes, etc.) gets the amber "heads up" treatment.
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
};

type Pending = {
  message: string;
  danger: boolean;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (ok: boolean) => void;
};

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Replaces window.confirm() app-wide: the native dialog is unstyled, sits
// wherever the OS/browser chrome puts it (top-left in some browsers), and
// can't carry the app's own visual language. This renders as a real centered
// card -- same backdrop/panel/animation convention as every other modal in
// the app -- and resolves a promise, so call sites barely change:
// `if (!window.confirm(msg))` becomes `if (!(await confirm(msg)))`.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (message, options) =>
      new Promise<boolean>((resolve) => {
        const danger = options?.danger ?? false;
        setPending({
          message,
          danger,
          confirmLabel:
            options?.confirmLabel ??
            (danger ? t.common.confirmDeleteBtn : t.common.closeAnyway),
          cancelLabel: options?.cancelLabel ?? t.common.cancel,
          resolve,
        });
      }),
    [t]
  );

  const settle = useCallback(
    (ok: boolean) => {
      setPending((prev) => {
        prev?.resolve(ok);
        return null;
      });
    },
    []
  );

  // Esc cancels, same as every other modal in the app.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          // Transparent, not a dark scrim -- the page behind stays fully
          // visible (just slightly softened by the blur), so the dialog
          // reads as a light overlay instead of dimming the whole screen.
          className="animate-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-transparent p-4 backdrop-blur-[2px]"
          onClick={() => settle(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-panel w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
          >
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                pending.danger ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
              }`}
            >
              {pending.danger ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-7 w-7"
                >
                  <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-7 w-7"
                >
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
              )}
            </div>
            <p className="mt-4 text-[15px] font-medium leading-snug text-slate-800">
              {pending.message}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => settle(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                {pending.cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] ${
                  pending.danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "btn-brand hover:brightness-110 hover:shadow-md"
                }`}
              >
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
