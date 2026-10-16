"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";

// The sections the administrator may take out of the side menu. Dashboard is
// home and Settings is where this switch lives, so neither can be hidden.
const HIDEABLE_NAV = ["buildings", "objects", "clients", "debtors", "tasks", "rentals"] as const;

// Settings -> Меню: one switch per section. A change is saved the moment it is
// made (there is nothing to "save" for a light switch) and reaches every
// signed-in person the next time their settings refresh.
export function NavVisibility() {
  const { t } = useLocale();
  const { settings, refresh } = useSettings();
  const [optimistic, setOptimistic] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hidden = new Set(optimistic ?? settings.hidden_nav ?? []);

  const toggle = async (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const list = HIDEABLE_NAV.filter((k) => next.has(k));
    setOptimistic(list);
    setError(null);
    const { error: dbError } = await createClient()
      .schema("crm")
      .from("settings")
      .update({ hidden_nav: list })
      .eq("id", true);
    if (dbError) {
      console.error("hidden_nav update failed:", dbError.message);
      setError(t.settings.menu.saveFailed);
      setOptimistic(null);
      return;
    }
    await refresh();
    setOptimistic(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-[var(--border-c2)] rounded-xl border border-[var(--border-c)] bg-[var(--surface-1)]">
        {HIDEABLE_NAV.map((key) => {
          const on = !hidden.has(key);
          return (
            <li key={key} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${on ? "text-[var(--ink-1)]" : "text-[var(--ink-4)]"}`}>
                  {t.nav[key]}
                </span>
                <span className="block text-xs text-[var(--ink-5)]">
                  {on ? t.settings.menu.shown : t.settings.menu.hidden}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={t.nav[key]}
                onClick={() => void toggle(key)}
                className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
                  on ? "border-brand bg-brand" : "border-[var(--border-strong-c)] bg-[var(--hover-c2)]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-[3px] h-5 w-5 rounded-full transition-all duration-150 ${
                    on ? "left-[24px] bg-[var(--on-brand)]" : "left-[3px] bg-[var(--ink-5)]"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs leading-snug text-[var(--ink-5)]">{t.settings.menu.alwaysOn}</p>
      <p className="text-xs leading-snug text-[var(--ink-5)]">{t.settings.menu.note}</p>
      {error && (
        <p role="alert" className="rounded-lg bg-[var(--wash-rose)] px-3 py-2 text-sm text-[var(--wash-rose-ink)]">
          {error}
        </p>
      )}
    </div>
  );
}
