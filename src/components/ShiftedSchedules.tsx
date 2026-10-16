"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useRole } from "@/lib/auth/useRole";
import { useConfirm } from "@/components/ConfirmDialog";
import { useSingleFlight } from "@/lib/useSingleFlight";
import { WarningIcon } from "@/components/icons";
import { formatCurrency, type Currency } from "@/lib/currency";

type Shift = {
  contract_id: string;
  contract_number: string | null;
  client_name: string;
  currency: Currency;
  overdue_now: number;
  overdue_by_contract_date: number;
};

// A failed read (the database not updated yet, no rights) is the same as having
// nothing to show: the card simply stays hidden.
async function fetchShifts(): Promise<Shift[]> {
  const { data, error } = await createClient().schema("crm").rpc("schedule_shifts");
  if (error) return [];
  return ((data ?? []) as Shift[]).map((r) => ({
    ...r,
    overdue_now: Number(r.overdue_now),
    overdue_by_contract_date: Number(r.overdue_by_contract_date),
  }));
}

const BTN_PRIMARY =
  "h-9 shrink-0 rounded-lg bg-brand px-3.5 text-sm font-semibold text-[var(--on-brand)] shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50";
const BTN_SECONDARY =
  "h-9 shrink-0 rounded-lg border border-[var(--field-border)] bg-[var(--surface-1)] px-3.5 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--hover-c)] disabled:opacity-50";

// Contracts whose schedule looks pushed forward: by the contract's own dates the
// client would be further behind than the list below says. An old clean-up step
// rebuilt the schedule of every contract that had received a payment from
// TODAY, every time the database file was run, which hid real debtors. Nothing
// here changes anything by itself -- the administrator sees the numbers and
// restores the schedule per contract (or all at once); the plan that is replaced
// is kept in crm.schedule_backup. Not shown to anyone else, and not at all when
// there is nothing to restore (or the database has not been updated yet).
export function ShiftedSchedules({ ready, onRestored }: { ready: boolean; onRestored: () => void }) {
  const { t } = useLocale();
  const { role } = useRole();
  const confirm = useConfirm();
  const once = useSingleFlight();
  const configured = isSupabaseConfigured();
  const [rows, setRows] = useState<Shift[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Heavy for a big database, so it starts only after the debtors list itself
    // has loaded instead of competing with it.
    if (!configured || role !== "admin" || !ready) return;
    let cancelled = false;
    void fetchShifts().then((list) => {
      if (!cancelled) setRows(list);
    });
    return () => {
      cancelled = true;
    };
  }, [configured, role, ready]);

  if (role !== "admin" || rows.length === 0) return null;

  const restore = async (ids: string[]) => {
    setBusy(true);
    setError(null);
    const db = createClient().schema("crm");
    for (const id of ids) {
      const { error: rpcError } = await db.rpc("restore_schedule", { p_contract_id: id });
      if (rpcError) {
        setError(t.debtors.shifted.failed.replace("{error}", rpcError.message));
        break;
      }
    }
    setBusy(false);
    setRows(await fetchShifts());
    onRestored();
  };

  const restoreOne = async (r: Shift) => {
    const ok = await confirm(t.debtors.shifted.confirmOne.replace("{number}", r.contract_number ?? "—"), {
      confirmLabel: t.debtors.shifted.restore,
    });
    if (ok) await restore([r.contract_id]);
  };

  const restoreAll = async () => {
    const ok = await confirm(t.debtors.shifted.confirmAll.replace("{n}", String(rows.length)), {
      confirmLabel: t.debtors.shifted.restoreAll,
    });
    if (ok) await restore(rows.map((r) => r.contract_id));
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--wash-amber-border)] bg-[var(--wash-amber)] px-4 py-3.5 text-[var(--wash-amber-ink)]">
      <div className="flex flex-wrap items-start gap-3">
        <WarningIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t.debtors.shifted.title.replace("{n}", String(rows.length))}</p>
          <p className="mt-1 max-w-3xl text-xs leading-snug">{t.debtors.shifted.body}</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={BTN_SECONDARY}>
          {open ? t.debtors.shifted.hide : t.debtors.shifted.show}
        </button>
      </div>

      {open && (
        <>
          <ul className="flex flex-col divide-y divide-[var(--wash-amber-border)] rounded-lg bg-[var(--surface-1)] text-[var(--ink-2)]">
            {rows.map((r) => (
              <li key={r.contract_id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium text-[var(--ink-1)]">{r.client_name}</p>
                  <p className="text-xs text-[var(--ink-4)]">№{r.contract_number ?? "—"}</p>
                </div>
                <div className="text-xs tabular-nums text-[var(--ink-3)]">
                  <p>{t.debtors.shifted.now.replace("{sum}", formatCurrency(r.overdue_now, r.currency))}</p>
                  <p className="font-semibold text-[var(--wash-rose-ink)]">
                    {t.debtors.shifted.original.replace("{sum}", formatCurrency(r.overdue_by_contract_date, r.currency))}
                  </p>
                </div>
                <button type="button" disabled={busy} onClick={once(() => restoreOne(r))} className={BTN_PRIMARY}>
                  {t.debtors.shifted.restore}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {error ? (
              <p role="alert" className="text-xs font-medium text-[var(--wash-rose-ink)]">
                {error}
              </p>
            ) : (
              <span />
            )}
            {rows.length > 1 && (
              <button type="button" disabled={busy} onClick={once(restoreAll)} className={BTN_SECONDARY}>
                {t.debtors.shifted.restoreAll}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
