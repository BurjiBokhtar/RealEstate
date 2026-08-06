"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Status = {
  enabled: boolean;
  hasApiKey: boolean;
  hasSenderName: boolean;
  hasCronSecret: boolean;
  lastRunAt: string | null;
  lastResult: string | null;
};

// The Start/Stop control for the automatic SMS mailout, plus an honest report
// of whether it can actually run.
//
// The old feature had no on/off switch and no status of any kind, so when it
// silently did nothing there was nowhere to look. The usual cause was a
// missing CRON_SECRET on Vercel -- invisible from the browser -- which made
// every nightly run get rejected. This panel names that instead of hiding it.
export function SmsScheduler({ onMessage }: { onMessage: (text: string, ok: boolean) => void }) {
  const { t } = useLocale();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/status", { headers: await authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(json as Status);
        setLoadError(null);
      } else {
        // Show it. Hiding the panel when the status call fails would recreate
        // the exact silence this whole panel is here to end.
        setLoadError((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "network error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = async (next: boolean) => {
    setBusy(true);
    const { error } = await createClient()
      .schema("crm")
      .from("settings")
      .update({ sms_enabled: next })
      .eq("id", true);
    setBusy(false);
    if (error) {
      onMessage(error.message, false);
      return;
    }
    onMessage(next ? t.settings.sms.started : t.settings.sms.stopped, true);
    void refresh();
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/sms/run", { method: "POST", headers: await authHeaders() });
      const json = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
      onMessage(json.summary || json.error || t.common.error, res.ok && !json.error);
    } catch {
      onMessage(t.common.error, false);
    }
    setBusy(false);
    void refresh();
  };

  if (loadError) {
    return (
      <div className="border-t border-slate-100 pt-4">
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5">
          <p className="text-xs font-semibold text-rose-800">{t.settings.sms.blockersTitle}</p>
          <p className="mt-1 text-xs text-rose-800">{loadError}</p>
        </div>
      </div>
    );
  }
  if (!status) return null;

  // Everything that has to be true before a single message can go out.
  const blockers: string[] = [];
  if (!status.hasApiKey || !status.hasSenderName) blockers.push(t.settings.sms.blockerCreds);
  if (!status.hasCronSecret) blockers.push(t.settings.sms.blockerCronSecret);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              status.enabled ? "bg-emerald-500" : "bg-slate-300"
            }`}
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-800">
              {status.enabled ? t.settings.sms.stateOn : t.settings.sms.stateOff}
            </span>
            <span className="text-xs text-slate-400">{t.settings.sms.schedule}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runNow}
            disabled={busy || !status.enabled}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40"
          >
            {t.settings.sms.runNow}
          </button>
          {status.enabled ? (
            <button
              type="button"
              onClick={() => toggle(false)}
              disabled={busy}
              className="h-9 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
            >
              {t.settings.sms.stop}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => toggle(true)}
              disabled={busy}
              className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
            >
              {t.settings.sms.start}
            </button>
          )}
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <p className="text-xs font-semibold text-amber-800">{t.settings.sms.blockersTitle}</p>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-xs text-amber-800">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {status.lastRunAt && (
        <p className="text-xs text-slate-500">
          {t.settings.sms.lastRun}: {new Date(status.lastRunAt).toLocaleString("ru-RU")}
          {status.lastResult ? ` · ${status.lastResult}` : ""}
        </p>
      )}
    </div>
  );
}
