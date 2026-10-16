"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatCurrency, type Currency } from "@/lib/currency";
import { unitLabel } from "@/lib/objects/format";
import { useApartmentNumbers } from "@/lib/buildings/useApartmentNumbers";
import { STATUS_HUES, type ChartHue } from "@/components/charts/palette";

// "Who has to pay this month, per ЖК" -- one card per currency, one row per
// building, and inside a building the clients who still owe.
//
// What a bar means. Its whole length is what the payment schedule puts on THIS
// calendar month for that building; the green part is what has already been
// covered by money received, the amber part is what is still to be paid. So one
// bar answers both "how big is the month for this ЖК" and "how far along are
// we". Debts from earlier months are deliberately not in here -- they are the
// overdue chart above, and mixing them in would make a client who is two
// months behind look like they owe three installments this month.
//
// Currencies get a card each and never share a scale: 500 USD beside 50 000 TJS
// on one axis draws the smaller number as the bigger bar.
//
// The data comes from crm.due_this_month_contracts() (migration 064), one row
// per contract, fetched in pages of 1000 because PostgREST silently truncates a
// longer answer -- on a page that is a to-do list, a quietly missing client is
// worse than an error.

const PAGE = 1000;
// How many clients a building shows before "show more".
const PAYERS_SHOWN = 8;
// Below this a figure is rounding dust, not a debt (same threshold the SQL uses).
const EPS = 0.005;

type DueRow = {
  contract_id: string;
  client_id: string | null;
  client_name: string;
  object_id: string | null;
  object_name: string | null;
  object_block: string | null;
  object_floor: number | null;
  building_id: string | null;
  building_name: string;
  currency: Currency;
  scheduled_amount: number | string;
  unpaid_amount: number | string;
};

type Payer = {
  contractId: string;
  clientId: string | null;
  clientName: string;
  objectId: string | null;
  objectName: string | null;
  objectBlock: string | null;
  objectFloor: number | null;
  scheduled: number;
  unpaid: number;
};

type BuildingDue = {
  key: string;
  buildingId: string | null;
  name: string;
  scheduled: number;
  unpaid: number;
  contracts: number;
  /** Only contracts that still owe something, biggest first. */
  payers: Payer[];
};

type CurrencyDue = {
  currency: Currency;
  scheduled: number;
  unpaid: number;
  buildings: BuildingDue[];
};

const CURRENCY_ORDER: Currency[] = ["TJS", "USD"];

async function fetchAllRows(): Promise<DueRow[]> {
  const supabase = createClient();
  const all: DueRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .schema("crm")
      .rpc("due_this_month_contracts")
      // A total order, or two pages can overlap and drop a contract.
      .order("unpaid_amount", { ascending: false })
      .order("contract_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as DueRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

function group(rows: DueRow[]): CurrencyDue[] {
  const byCurrency = new Map<Currency, Map<string, BuildingDue>>();
  for (const r of rows) {
    const scheduled = Number(r.scheduled_amount);
    const unpaid = Math.min(Number(r.unpaid_amount), scheduled);
    let buildings = byCurrency.get(r.currency);
    if (!buildings) {
      buildings = new Map();
      byCurrency.set(r.currency, buildings);
    }
    const key = `${r.currency}|${r.building_id ?? "none"}`;
    let b = buildings.get(key);
    if (!b) {
      b = {
        key,
        buildingId: r.building_id,
        name: r.building_name,
        scheduled: 0,
        unpaid: 0,
        contracts: 0,
        payers: [],
      };
      buildings.set(key, b);
    }
    b.scheduled += scheduled;
    b.unpaid += unpaid;
    b.contracts += 1;
    if (unpaid > EPS) {
      b.payers.push({
        contractId: r.contract_id,
        clientId: r.client_id,
        clientName: r.client_name,
        objectId: r.object_id,
        objectName: r.object_name,
        objectBlock: r.object_block,
        objectFloor: r.object_floor,
        scheduled,
        unpaid,
      });
    }
  }

  return CURRENCY_ORDER.filter((c) => byCurrency.has(c)).map((currency) => {
    const buildings = [...(byCurrency.get(currency)?.values() ?? [])];
    for (const b of buildings) b.payers.sort((x, y) => y.unpaid - x.unpaid);
    // Most still-to-pay first; among equals, the bigger month.
    buildings.sort((x, y) => y.unpaid - x.unpaid || y.scheduled - x.scheduled);
    return {
      currency,
      scheduled: buildings.reduce((s, b) => s + b.scheduled, 0),
      unpaid: buildings.reduce((s, b) => s + b.unpaid, 0),
      buildings,
    };
  });
}

function gradient(h: ChartHue) {
  return `linear-gradient(90deg, ${h.from}, ${h.to})`;
}

// The two-tone bar. `max` is the biggest `scheduled` among the bars it is
// compared with, so lengths are comparable inside one list.
function DueBar({ scheduled, unpaid, max }: { scheduled: number; unpaid: number; max: number }) {
  const paid = Math.max(scheduled - unpaid, 0);
  const trackFrac = max > 0 ? scheduled / max : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden">
      <div
        className="animate-chart-grow-x flex h-full overflow-hidden rounded-full bg-[var(--track-c)]"
        style={{ width: `${trackFrac * 100}%`, minWidth: scheduled > 0 ? 6 : 0 }}
      >
        <div
          className="h-full"
          style={{
            width: `${scheduled > 0 ? (paid / scheduled) * 100 : 0}%`,
            background: gradient(STATUS_HUES.available),
          }}
        />
        <div
          className="h-full"
          style={{
            width: `${scheduled > 0 ? (unpaid / scheduled) * 100 : 0}%`,
            background: gradient(STATUS_HUES.reserved),
          }}
        />
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function DueThisMonthChart() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();
  const [rows, setRows] = useState<DueRow[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [shown, setShown] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    fetchAllRows()
      .then((all) => {
        if (cancelled) return;
        setFailure(null);
        setRows(all);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        console.error("due_this_month_contracts failed:", message);
        setFailure(message);
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const cards = useMemo(() => group(rows ?? []), [rows]);

  // Flat numbers are only needed for buildings that are open.
  const openBuildingIds: string[] = [];
  for (const card of cards) {
    for (const b of card.buildings) {
      if (expanded.has(b.key) && b.buildingId) openBuildingIds.push(b.buildingId);
    }
  }
  const apartmentNumbers = useApartmentNumbers(openBuildingIds);

  if (!configured) return null;

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (failure) {
    return (
      <div className="rounded-lg border border-[var(--wash-rose-border)] bg-[var(--wash-rose)] px-4 py-3 text-sm text-[var(--wash-rose-ink)]">
        <p className="font-semibold">{t.debtors.dueFailed}</p>
        <p className="mt-1 text-xs opacity-80">{failure}</p>
      </div>
    );
  }

  if (rows === null) {
    return (
      <p className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 text-sm text-[var(--ink-5)] shadow-sm">
        {t.common.loading}
      </p>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-[var(--ink-2)]">{t.debtors.dueTitle}</p>
        <p className="text-sm text-[var(--ink-5)]">{t.debtors.dueEmpty}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cards.map((card) => {
          const maxScheduled = Math.max(...card.buildings.map((b) => b.scheduled), 0);
          return (
            <div
              key={card.currency}
              className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--ink-2)]">
                  {t.debtors.dueTitle} · {card.currency}
                </p>
                <span className="text-xs text-[var(--ink-4)]">
                  <span className="font-semibold text-[var(--wash-amber-ink)]">
                    {formatCurrency(card.unpaid, card.currency)}
                  </span>{" "}
                  <span className="text-[var(--ink-5)]">
                    / {formatCurrency(card.scheduled, card.currency)}
                  </span>
                </span>
              </div>
  
              <ul className="flex flex-col gap-3">
                {card.buildings.map((b) => {
                  const open = expanded.has(b.key);
                  const limit = shown[b.key] ?? PAYERS_SHOWN;
                  const visible = b.payers.slice(0, limit);
                  const maxPayer = Math.max(...b.payers.map((p) => p.scheduled), 0);
                  const allPaid = b.unpaid <= EPS;
                  const hasPayers = b.payers.length > 0;
                  return (
                    <li key={b.key} className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => hasPayers && toggle(b.key)}
                        aria-expanded={hasPayers ? open : undefined}
                        disabled={!hasPayers}
                        className={`-mx-1.5 flex flex-col gap-1 rounded-lg px-1.5 py-1 text-left transition-colors ${
                          hasPayers ? "hover:bg-[var(--hover-c)]" : "cursor-default"
                        }`}
                      >
                        <span className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-1 text-[var(--ink-2)]">
                            <span className={hasPayers ? "text-[var(--ink-4)]" : "invisible"}>
                              <Chevron open={open} />
                            </span>
                            <span className="truncate" title={b.name}>
                              {b.name}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-[var(--ink-1)]">
                            {allPaid ? (
                              <span className="text-[var(--wash-emerald-ink)]">{t.debtors.dueAllPaid}</span>
                            ) : (
                              formatCurrency(b.unpaid, card.currency)
                            )}
                            <span className="ml-1 font-normal text-[var(--ink-5)]">
                              / {formatCurrency(b.scheduled, card.currency)}
                            </span>
                          </span>
                        </span>
                        <DueBar scheduled={b.scheduled} unpaid={b.unpaid} max={maxScheduled} />
                        <span className="text-[11px] text-[var(--ink-5)]">
                          {t.debtors.dueUnpaidContracts
                            .replace("{left}", String(b.payers.length))
                            .replace("{all}", String(b.contracts))}
                        </span>
                      </button>
  
                      {open && hasPayers && (
                        <div className="ml-2 border-l border-[var(--border-c)] pl-3">
                          <ul className="flex flex-col gap-2.5 py-1">
                            {visible.map((p) => {
                              const unit = p.objectId
                                ? unitLabel(
                                    {
                                      name: p.objectName,
                                      block: p.objectBlock,
                                      floor: p.objectFloor,
                                    },
                                    apartmentNumbers.get(p.objectId),
                                    t.buildings
                                  )
                                : null;
                              const partly = p.scheduled - p.unpaid > EPS;
                              return (
                                <li key={p.contractId} className="flex flex-col gap-1">
                                  <div className="flex items-baseline justify-between gap-3 text-sm">
                                    <div className="min-w-0">
                                      {p.clientId ? (
                                        <Link
                                          href={`/clients/${p.clientId}`}
                                          className="-mx-1 block truncate rounded px-1 text-[var(--ink-2)] transition-colors hover:bg-brand-soft hover:text-brand"
                                          title={p.clientName}
                                        >
                                          {p.clientName}
                                        </Link>
                                      ) : (
                                        <span className="block truncate text-[var(--ink-2)]">
                                          {p.clientName}
                                        </span>
                                      )}
                                      {unit && (
                                        <span className="block truncate text-[11px] text-[var(--ink-5)]">
                                          {unit}
                                        </span>
                                      )}
                                    </div>
                                    <span className="shrink-0 font-semibold tabular-nums text-[var(--ink-1)]">
                                      {formatCurrency(p.unpaid, card.currency)}
                                      {partly && (
                                        <span className="ml-1 font-normal text-[var(--ink-5)]">
                                          / {formatCurrency(p.scheduled, card.currency)}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <DueBar scheduled={p.scheduled} unpaid={p.unpaid} max={maxPayer} />
                                </li>
                              );
                            })}
                          </ul>
                          {b.payers.length > PAYERS_SHOWN && (
                            <button
                              type="button"
                              onClick={() =>
                                setShown((prev) => ({
                                  ...prev,
                                  [b.key]:
                                    limit >= b.payers.length
                                      ? PAYERS_SHOWN
                                      : Math.min(limit + PAYERS_SHOWN * 4, b.payers.length),
                                }))
                              }
                              className="mt-1 rounded px-1 text-xs font-medium text-brand transition-colors hover:bg-brand-soft"
                            >
                              {limit >= b.payers.length
                                ? t.debtors.dueShowLess
                                : t.debtors.dueShowMore.replace(
                                    "{n}",
                                    String(Math.min(PAYERS_SHOWN * 4, b.payers.length - limit))
                                  )}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* One legend and one note for both cards -- repeating a three-line
          explanation under each currency just pushed the charts apart. */}
      <div className="flex flex-col gap-1.5 px-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--ink-4)]">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: STATUS_HUES.reserved.solid }}
            />
            {t.debtors.dueLegendLeft}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: STATUS_HUES.available.solid }}
            />
            {t.debtors.dueLegendPaid}
          </span>
        </div>
        <p className="text-xs text-[var(--ink-5)]">{t.debtors.dueHint}</p>
      </div>
    </div>
  );
}
