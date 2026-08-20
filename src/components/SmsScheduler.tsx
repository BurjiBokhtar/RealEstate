"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Status = {
  enabled: boolean;
  hasApiKey: boolean;
  hasSenderName: boolean;
  hasCronSecret: boolean;
  projectRefMismatch: boolean | null;
  lastRunAt: string | null;
  lastResult: string | null;
};

// The Start/Stop control for the automatic SMS mailout, plus an honest report
// of whether it can actually run.
//
// Two different things used to be fetched by ONE call (/api/sms/status,
// which needs SUPABASE_SERVICE_ROLE_KEY to work at all): "is the switch
// currently on" and "why can't the nightly run go out". The first is a plain
// column read the ordinary signed-in session can already do -- RLS has
// always allowed it -- and never needed the service key in the first place.
// Bundling them meant that whenever the service key broke (a stale/wrong
// value on Vercel, or -- the actual cause found once -- crm never having
// been GRANTed to service_role at all), the ENTIRE panel disappeared behind
// one error paragraph, including the Start/Stop button itself, which would
// have worked fine on its own the whole time.
//
// So they're two independent reads now. enabled loads first, straight from
// the table, and the button appears as soon as it does -- diagnostics
// (why a scheduled run might still fail even with the switch on) load
// separately and degrade to a small note instead of hiding the button.
export function SmsScheduler({ onMessage }: { onMessage: (text: string, ok: boolean) => void }) {
  const { t } = useLocale();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  // The one thing the button needs: is the switch on. A plain table read
  // under the signed-in admin's own session -- no service key involved.
  const loadEnabled = useCallback(async () => {
    const { data, error } = await createClient()
      .schema("crm")
      .from("settings")
      .select("sms_enabled")
      .maybeSingle();
    if (!error) setEnabled(!!data?.sms_enabled);
  }, []);

  // Everything else: has an API key been saved, is CRON_SECRET set on
  // Vercel, does the service key match this project, when did it last run.
  // Nice to have, not required to show the button.
  const loadDiagnostics = useCallback(async () => {
    try {
      const res = await fetch("/api/sms/status", { headers: await authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus(json as Status);
        setDiagError(null);
      } else {
        setDiagError((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : "network error");
    }
  }, []);

  useEffect(() => {
    void loadEnabled();
    void loadDiagnostics();
  }, [loadEnabled, loadDiagnostics]);

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
    setEnabled(next);
    onMessage(next ? t.settings.sms.started : t.settings.sms.stopped, true);
    void loadDiagnostics();
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
    void loadDiagnostics();
  };

  // Still waiting on the one read the button actually depends on.
  if (enabled === null) {
    return <div className="border-t border-[var(--border-c2)] pt-4 text-sm text-[var(--ink-5)]">{t.common.loading}</div>;
  }

  // Everything that has to be true before a single message can go out --
  // only shown once diagnostics actually loaded.
  const blockers: string[] = [];
  if (status && (!status.hasApiKey || !status.hasSenderName)) blockers.push(t.settings.sms.blockerCreds);
  if (status && !status.hasCronSecret) blockers.push(t.settings.sms.blockerCronSecret);
  if (status?.projectRefMismatch) blockers.push(t.settings.sms.blockerProjectMismatch);

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border-c2)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${enabled ? "bg-[var(--wash-emerald-ink)]" : "bg-[var(--ink-5)]"}`}
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[var(--ink-2)]">
              {enabled ? t.settings.sms.stateOn : t.settings.sms.stateOff}
            </span>
            <span className="text-xs text-[var(--ink-5)]">{t.settings.sms.schedule}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runNow}
            disabled={busy || !enabled}
            className="h-9 rounded-lg border border-[var(--field-border)] bg-[var(--field-bg)] px-3.5 text-sm font-medium text-[var(--ink-2)] transition-all hover:bg-[var(--hover-c)] active:scale-[0.98] disabled:opacity-40"
          >
            {t.settings.sms.runNow}
          </button>
          {enabled ? (
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
        <div className="rounded-lg border border-[var(--wash-amber-border)] bg-[var(--wash-amber)] px-3.5 py-2.5">
          <p className="text-xs font-semibold text-[var(--wash-amber-ink)]">{t.settings.sms.blockersTitle}</p>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-xs text-[var(--wash-amber-ink)]">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Diagnostics genuinely couldn't be read (the service key itself is
          still broken somehow) -- a one-line note, not a wall of red that
          used to replace the button above instead of sitting quietly under
          it. */}
      {diagError && !status && (
        <p className="text-xs text-[var(--ink-5)]">
          {t.settings.sms.diagUnavailable}: {diagError}
        </p>
      )}

      {status?.lastRunAt && (
        <p className="text-xs text-[var(--ink-4)]">
          {t.settings.sms.lastRun}: {new Date(status.lastRunAt).toLocaleString("ru-RU")}
          {status.lastResult ? ` · ${status.lastResult}` : ""}
        </p>
      )}
    </div>
  );
}
