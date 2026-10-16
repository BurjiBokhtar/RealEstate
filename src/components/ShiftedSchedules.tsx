"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useRole } from "@/lib/auth/useRole";
import { useConfirm } from "@/components/ConfirmDialog";
import { useSingleFlight } from "@/lib/useSingleFlight";
import { WarningIcon } from "@/components/icons";
import { formatCurrency, type Currency } from "@/lib/currency";
import { formatShortDate } from "@/lib/formatDate";

type Shift = {
  contract_id: string;
  contract_number: string | null;
  client_id: string | null;
  client_name: string;
  currency: Currency;
  signed_date: string | null;
  installment_months: number | null;
  contract_amount: number;
  paid_amount: number;
  next_plan_date: string | null;
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
    contract_amount: Number(r.contract_amount),
    paid_amount: Number(r.paid_amount),
    overdue_now: Number(r.overdue_now),
    overdue_by_contract_date: Number(r.overdue_by_contract_date),
  }));
}

const BTN_PRIMARY =
  "h-9 shrink-0 rounded-lg bg-brand px-3.5 text-sm font-semibold text-[var(--on-brand)] shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50";
const BTN_SECONDARY =
  "h-9 shrink-0 rounded-lg border border-[var(--field-border)] bg-[var(--surface-1)] px-3.5 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--hover-c)] disabled:opacity-50";

// Contracts whose schedule looks pushed forward: by the contract's own dates the
// client would be further behind than the list below says. Two things can cause
// that: an old clean-up step that rebuilt the schedule of every contract that
// had received a payment from TODAY each time the database file was run (which
// hid real debtors), or a schedule that was moved ON PURPOSE (an agreement with
// the client, "Recalculate schedule", a changed contract amount). Only the
// administrator can tell them apart, so nothing here changes by itself: for each
// contract the administrator either restores the schedule from the contract date
// (the replaced plan is kept in crm.schedule_backup, and a restore can be
// undone right here) or keeps it as it is (the contract leaves this card).
// Not shown to anyone else, and not at all when there is nothing to decide (or
// the database has not been updated yet).
export function ShiftedSchedules({ ready, onRestored }: { ready: boolean; onRestored: () => void }) {
  const { t } = useLocale();
  const { role } = useRole();
  const confirm = useConfirm();
  const once = useSingleFlight();
  const configured = isSupabaseConfigured();
  const [rows, setRows] = useState<Shift[]>([]);
  // Restored in this visit -- offered an "undo" until the page is left.
  const [done, setDone] = useState<Array<{ id: string; number: string | null; client: string }>>([]);
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

  if (role !== "admin" || (rows.length === 0 && done.length === 0)) return null;

  const restore = async (list: Shift[]) => {
    setBusy(true);
    setError(null);
    const db = createClient().schema("crm");
    const restored: Shift[] = [];
    for (const r of list) {
      const { error: rpcError } = await db.rpc("restore_schedule", { p_contract_id: r.contract_id });
      if (rpcError) {
        setError(t.debtors.shifted.failed.replace("{error}", rpcError.message));
        break;
      }
      restored.push(r);
    }
    setDone((prev) => [
      ...restored.map((r) => ({ id: r.contract_id, number: r.contract_number, client: r.client_name })),
      ...prev,
    ]);
    setBusy(false);
    setRows(await fetchShifts());
    onRestored();
  };

  const restoreOne = async (r: Shift) => {
    const ok = await confirm(t.debtors.shifted.confirmOne.replace("{number}", r.contract_number ?? "—"), {
      confirmLabel: t.debtors.shifted.restore,
    });
    if (ok) await restore([r]);
  };

  const restoreAll = async () => {
    const ok = await confirm(t.debtors.shifted.confirmAll.replace("{n}", String(rows.length)), {
      confirmLabel: t.debtors.shifted.restoreAll,
    });
    if (ok) await restore(rows);
  };

  const keepOne = async (r: Shift) => {
    const ok = await confirm(t.debtors.shifted.keepConfirm.replace("{number}", r.contract_number ?? "—"), {
      confirmLabel: t.debtors.shifted.keep,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient()
      .schema("crm")
      .rpc("dismiss_schedule_shift", { p_contract_id: r.contract_id });
    setBusy(false);
    if (rpcError) {
      setError(t.debtors.shifted.failed.replace("{error}", rpcError.message));
      return;
    }
    setRows((prev) => prev.filter((x) => x.contract_id !== r.contract_id));
  };

  const undoOne = async (id: string) => {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient()
      .schema("crm")
      .rpc("undo_restore_schedule", { p_contract_id: id });
    setBusy(false);
    if (rpcError) {
      setError(t.debtors.shifted.failed.replace("{error}", rpcError.message));
      return;
    }
    setDone((prev) => prev.filter((x) => x.id !== id));
    setRows(await fetchShifts());
    onRestored();
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--wash-amber-border)] bg-[var(--wash-amber)] px-4 py-3.5 text-[var(--wash-amber-ink)]">
      {rows.length > 0 && (
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
      )}

      {rows.length > 0 && open && (
        <>
          <p className="max-w-3xl rounded-lg bg-[var(--surface-1)] px-3 py-2.5 text-xs leading-snug text-[var(--ink-3)]">
            {t.debtors.shifted.how}
          </p>
          <ul className="flex flex-col divide-y divide-[var(--wash-amber-border)] rounded-lg bg-[var(--surface-1)] text-[var(--ink-2)]">
            {rows.map((r) => (
              <li key={r.contract_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
                <div className="min-w-0 flex-1 basis-64">
                  {r.client_id ? (
                    <Link
                      href={`/clients/${r.client_id}`}
                      target="_blank"
                      rel="noopener"
                      title={t.debtors.shifted.open}
                      className="block truncate text-sm font-medium text-[var(--ink-1)] underline-offset-2 hover:text-brand hover:underline"
                    >
                      {r.client_name}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium text-[var(--ink-1)]">{r.client_name}</p>
                  )}
                  <p className="text-xs text-[var(--ink-4)]">
                    №{r.contract_number ?? "—"}
                    {r.signed_date && r.installment_months
                      ? ` · ${t.debtors.shifted.details
                          .replace("{date}", formatShortDate(r.signed_date))
                          .replace("{months}", String(r.installment_months))
                          .replace("{amount}", formatCurrency(r.contract_amount, r.currency))
                          .replace("{paid}", formatCurrency(r.paid_amount, r.currency))}`
                      : ""}
                  </p>
                  {r.next_plan_date && (
                    <p className="text-xs text-[var(--ink-4)]">
                      {t.debtors.shifted.nextPlan.replace("{date}", formatShortDate(r.next_plan_date))}
                    </p>
                  )}
                </div>
                <div className="text-xs tabular-nums text-[var(--ink-3)]">
                  <p>{t.debtors.shifted.now.replace("{sum}", formatCurrency(r.overdue_now, r.currency))}</p>
                  <p className="font-semibold text-[var(--wash-rose-ink)]">
                    {t.debtors.shifted.original.replace("{sum}", formatCurrency(r.overdue_by_contract_date, r.currency))}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={once(() => restoreOne(r))} className={BTN_PRIMARY}>
                    {t.debtors.shifted.restore}
                  </button>
                  <button type="button" disabled={busy} onClick={once(() => keepOne(r))} className={BTN_SECONDARY}>
                    {t.debtors.shifted.keep}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {rows.length > 1 && (
            <div className="flex justify-end">
              <button type="button" disabled={busy} onClick={once(restoreAll)} className={BTN_SECONDARY}>
                {t.debtors.shifted.restoreAll}
              </button>
            </div>
          )}
        </>
      )}

      {done.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-[var(--surface-1)] px-3 py-2.5 text-[var(--ink-2)]">
          <p className="text-xs font-semibold">{t.debtors.shifted.restoredTitle.replace("{n}", String(done.length))}</p>
          <ul className="flex flex-col gap-1.5">
            {done.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">
                  {d.client} · №{d.number ?? "—"}
                </span>
                <button type="button" disabled={busy} onClick={once(() => undoOne(d.id))} className={BTN_SECONDARY}>
                  {t.debtors.shifted.undo}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-[var(--wash-rose-ink)]">
          {error}
        </p>
      )}
    </section>
  );
}
