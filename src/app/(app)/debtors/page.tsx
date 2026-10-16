"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { Pagination } from "@/components/Pagination";
import { formatCurrency, type Currency } from "@/lib/currency";
import { formatShortDate } from "@/lib/formatDate";
import { ExportMenu } from "@/components/ExportMenu";
import { ControlGroup, GroupDivider } from "@/components/ActionBar";
import { SortIcon } from "@/components/icons";
import { HBarChart } from "@/components/charts/HBarChart";
import { STATUS_HUES } from "@/components/charts/palette";
import { DueThisMonthChart } from "@/components/DueThisMonthChart";
import { ShiftedSchedules } from "@/components/ShiftedSchedules";
import { waLink } from "@/lib/whatsapp";
import { unitLabel } from "@/lib/objects/format";
import { apartmentNumbersForBuildings } from "@/lib/buildings/apartmentNumbersFor";
import { useApartmentNumbers } from "@/lib/buildings/useApartmentNumbers";
import { elapsedSince, formatElapsed, type ElapsedWords } from "@/lib/debtors/elapsed";

const PAGE_SIZE = 25;
// Batch size for the "export everything" path -- PostgREST will not hand back
// more than this in one response anyway.
const EXPORT_BATCH = 1000;

// A debtor who has not paid for more than a month has missed a whole cycle;
// before that, a reminder alone usually fixes it. Drives the badge colour.
const ONE_CYCLE_DAYS = 31;

// ONE sort control: pick WHAT to order by, and which way. It used to be four
// pills where "by age, newest first" and "by age, oldest first" were two
// separate buttons for the same thing, sitting next to a ЖК filter that looked
// like a fifth sort option -- nobody could tell what the list was ordered by.
type SortKey = "lastPayment" | "overdue" | "remaining" | "name";
// What kind of values the column holds -- decides how the direction reads
// ("oldest first" for dates, "A -> Z" for names, "high to low" for money).
type SortKind = "age" | "amount" | "text";

// Which column each choice orders by, applied in the database so the order
// holds across pages.
const SORTS: Record<SortKey, { column: string; kind: SortKind; defaultAscending: boolean }> = {
  // Date of the last real payment. Ascending = the OLDEST date first = whoever
  // has gone longest without paying. A contract with no payment at all has no
  // date; it counts as the longest of all (see nullsFirst below).
  lastPayment: { column: "last_payment_date", kind: "age", defaultAscending: true },
  overdue: { column: "total_overdue", kind: "amount", defaultAscending: false },
  remaining: { column: "remaining_total", kind: "amount", defaultAscending: false },
  name: { column: "client_name", kind: "text", defaultAscending: true },
};

const SORT_KEYS: SortKey[] = ["lastPayment", "overdue", "remaining", "name"];

// One reminder PER CONTRACT, not per missed installment. A long installment
// plan with nothing paid used to spill one row per overdue month (9, 20, 30
// rows for the same flat); now it's a single line summing what's overdue.
// Paid installments drop out on their own, so recording a payment shrinks the
// reminder and fully closing the plan removes it entirely.
type ContractDebt = {
  contractId: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  // Where the flat is: the ЖК, plus the unit itself (block, floor; the flat
  // number is worked out from the building grid, see useApartmentNumbers).
  buildingId: string | null;
  buildingName: string | null;
  objectId: string | null;
  objectName: string | null;
  objectBlock: string | null;
  objectFloor: number | null;
  contractNumber: string | null;
  currency: Currency;
  missedCount: number;
  totalOverdue: number;
  // The whole balance of the contract, not just the overdue slice -- the two
  // were being confused for each other on screen.
  remainingTotal: number;
  // The usual instalment per month, from the payment schedule.
  monthlyPayment: number | null;
  // Date of the last real payment received, null if there never was one. This
  // is "how long has this person not paid", as opposed to how old some single
  // missed instalment is.
  lastPaymentDate: string | null;
  // Earliest missed date = since when in arrears.
  earliestDue: string;
  // Only for the reminder text: days since the most recent missed due date.
  daysOverdue: number;
};

// A row exactly as crm.overdue_contracts() returns it.
type OverdueRow = {
  contract_id: string;
  contract_number: string | null;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  object_id: string | null;
  object_name: string | null;
  object_block: string | null;
  object_floor: number | null;
  building_id: string | null;
  building_name: string | null;
  currency: Currency;
  missed_count: number;
  total_overdue: number;
  remaining_total: number | null;
  earliest_due: string;
  latest_due: string;
  last_payment_date: string | null;
  monthly_payment: number | null;
};

// Same shape the table renders, built from one RPC row.
function toDebt(r: OverdueRow, now: number): ContractDebt {
  return {
    contractId: r.contract_id,
    clientId: r.client_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    buildingId: r.building_id,
    buildingName: r.building_name,
    objectId: r.object_id,
    objectName: r.object_name,
    objectBlock: r.object_block,
    objectFloor: r.object_floor,
    contractNumber: r.contract_number,
    currency: r.currency,
    missedCount: r.missed_count,
    totalOverdue: Number(r.total_overdue),
    remainingTotal: Number(r.remaining_total ?? 0),
    monthlyPayment: r.monthly_payment == null ? null : Number(r.monthly_payment),
    lastPaymentDate: r.last_payment_date,
    earliestDue: r.earliest_due,
    daysOverdue: Math.floor((now - new Date(r.latest_due).getTime()) / 86_400_000),
  };
}

const money = (n: number) => Math.round(n * 100) / 100;

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-1.5-.5c-2.6-1.1-4.3-3.7-4.4-3.9-.1-.2-1-1.4-1-2.6s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c0 .2.1.3 0 .5l-.3.5-.4.5c-.2.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.9 1.7 1.1 2 1.3.2.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
    </svg>
  );
}

// Same button on the table and on the phone cards.
function ReminderLink({ debt, compact = false }: { debt: ContractDebt; compact?: boolean }) {
  const { t } = useLocale();
  if (!debt.clientPhone) {
    return <span className="shrink-0 text-xs text-[var(--ink-5)]">{t.debtors.noPhone}</span>;
  }
  return (
    <a
      href={waLink(
        debt.clientPhone,
        t.debtors.reminderMsg
          .replace("{name}", debt.clientName)
          .replace("{contract}", debt.contractNumber ?? "—")
          .replace("{amount}", formatCurrency(debt.totalOverdue, debt.currency))
          .replace("{days}", String(debt.daysOverdue))
      )}
      target="_blank"
      rel="noopener noreferrer"
      title={t.debtors.whatsapp}
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--wash-emerald-border)] px-2.5 text-xs font-semibold text-[var(--wash-emerald-ink)] transition-all hover:bg-[var(--wash-emerald)] active:scale-95 ${
        compact ? "py-1.5" : "py-1"
      }`}
    >
      <WhatsAppIcon />
      {t.debtors.whatsapp}
    </a>
  );
}

function ClientCell({ debt }: { debt: ContractDebt }) {
  return (
    <div className="min-w-0">
      {debt.clientId ? (
        <Link
          href={`/clients/${debt.clientId}`}
          className="-mx-1 block rounded px-1 font-medium text-[var(--ink-1)] transition-colors hover:bg-[var(--wash-plum)] hover:text-brand"
        >
          {debt.clientName}
        </Link>
      ) : (
        <span className="font-medium text-[var(--ink-1)]">{debt.clientName}</span>
      )}
      {debt.clientPhone && <div className="text-xs text-[var(--ink-5)]">{debt.clientPhone}</div>}
    </div>
  );
}

// Which ЖК, and where in it. The ЖК leads because that is what was missing:
// the column used to show only the stored unit name ("Даромадгоҳи 1 №6-4"),
// which says nothing about which development it belongs to.
function UnitCell({
  debt,
  apartmentNumbers,
}: {
  debt: ContractDebt;
  apartmentNumbers: Map<string, number>;
}) {
  const { t } = useLocale();
  const unit = debt.objectId
    ? unitLabel(
        { name: debt.objectName, block: debt.objectBlock, floor: debt.objectFloor },
        apartmentNumbers.get(debt.objectId),
        t.buildings
      )
    : null;
  // A unit with no building (a stand-alone house): its own label is all there is.
  const first = debt.buildingName ?? unit ?? "—";
  const second = debt.buildingName ? unit : null;
  return (
    <div className="min-w-0">
      <div className="font-medium text-[var(--ink-2)]">{first}</div>
      {second && <div className="text-xs text-[var(--ink-4)]">{second}</div>}
    </div>
  );
}

// Date of the last payment and how long ago that was -- the whole gap, not a
// running tally of missed instalments.
function LastPaymentCell({
  debt,
  words,
  inline = false,
}: {
  debt: ContractDebt;
  words: ElapsedWords;
  /** Date and badge side by side (phone cards) instead of stacked (table). */
  inline?: boolean;
}) {
  const { t } = useLocale();
  const gap = elapsedSince(debt.lastPaymentDate);
  const long = !gap || gap.totalDays > ONE_CYCLE_DAYS;
  const tone = long
    ? "bg-[var(--wash-rose)] text-[var(--wash-rose-ink)]"
    : "bg-[var(--wash-amber)] text-[var(--wash-amber-ink)]";
  const badge = gap
    ? gap.totalDays === 0
      ? words.today
      : `${formatElapsed(gap, words)} ${t.debtors.ago}`
    : t.debtors.noPayments;
  return (
    <div className={inline ? "flex flex-wrap items-center gap-x-2 gap-y-1" : "flex flex-col items-start gap-1"}>
      {debt.lastPaymentDate && (
        <span className="text-[var(--ink-3)]">{formatShortDate(debt.lastPaymentDate)}</span>
      )}
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-xs font-medium ${tone}`}
      >
        {badge}
      </span>
    </div>
  );
}

export default function DebtorsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();
  const [rows, setRows] = useState<ContractDebt[]>([]);
  const [totals, setTotals] = useState<
    Array<{ currency: Currency; overdue: number; remaining: number; contracts: number }>
  >([]);
  // Explicit, and visible on screen: what the list is ordered by, and which
  // way. Defaults to the longest-without-paying first -- the list is a call
  // queue, and the person who has gone longest without paying is the one to
  // ring first.
  const [sort, setSort] = useState<SortKey>("lastPayment");
  const [ascending, setAscending] = useState<boolean>(SORTS.lastPayment.defaultAscending);
  // Filter by ЖК: collections are organised per development, so "show me only
  // this one" is the first thing anybody asks of this list.
  const [buildingId, setBuildingId] = useState<string>("all");
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([]);
  const [byBuilding, setByBuilding] = useState<
    Array<{ name: string; overdue: number; remaining: number; contracts: number; currency: Currency }>
  >([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  // "Loading" is derived, not stored. It is exactly "the data on screen does
  // not belong to the parameters currently set", so it is a comparison, not a
  // flag raised before a fetch and lowered after -- and raising it inside the
  // effect cost a second render every time a filter moved. Not configured
  // means nothing will ever load, so it is not loading either.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // Bumped after a schedule is restored, so the list and totals are read again.
  const [reloadNonce, setReloadNonce] = useState(0);

  // Paged, 25 at a time. Two ceilings had to go here. First: the page used to
  // pull EVERY unpaid overdue installment and group them in the browser -- and
  // a two-year plan is 20-30 rows on its own, so PostgREST's 1000-row cap was
  // reachable at a few dozen debtors. Migration 038 fixed that by grouping in
  // SQL. But one contract still costs one row, so the same cap returns at a
  // thousand contracts in arrears -- and on THIS page a silently truncated
  // list means somebody who owes money never gets called. Hence real paging,
  // with the row count coming from the server rather than from rows.length.
  const queryKey = [page, sort, ascending, buildingId, reloadNonce].join("|");
  const loading = configured && loadedKey !== queryKey;

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const from = (page - 1) * PAGE_SIZE;
    const order = SORTS[sort];
    let query = createClient()
      .schema("crm")
      .rpc("overdue_contracts", { p_building_id: buildingId === "all" ? null : buildingId }, { count: "exact" });
    // Sorted in the database, so the order holds ACROSS pages -- sorting the
    // 25 rows on screen would be a different list on every page.
    // Money first by currency: 600 USD is not "smaller" than 500 TJS, so the
    // two currencies are never interleaved by their bare numbers -- each is
    // ranked on its own, like the charts above.
    if (order.kind === "amount") query = query.order("currency", { ascending: true });
    query
      // Ascending, a missing last-payment date (never paid) comes first: it is
      // the longest gap there is. contract_id last: without a unique
      // tiebreaker, equal values can come back in a different order per page,
      // showing one debtor twice and another never.
      .order(order.column, { ascending, nullsFirst: ascending })
      .order("contract_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .then(({ data, count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("overdue_contracts failed:", error.message);
          setFailure(error.message);
          setRows([]);
          setTotalCount(0);
          setLoadedKey(queryKey);
          return;
        }
        const batch = (data ?? []) as OverdueRow[];
        // Debts get paid while the page is open. If that emptied the page
        // we're standing on, fall back to the first one rather than showing a
        // blank table under a "3 / 2" counter.
        if (batch.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        const now = Date.now();
        setFailure(null);
        setRows(batch.map((r) => toDebt(r, now)));
        setTotalCount(count ?? 0);
        setLoadedKey(queryKey);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, page, sort, ascending, buildingId, queryKey]);

  // Flat numbers for the buildings on screen -- the table says "квартира 34",
  // not just the stored "№6-4".
  const apartmentNumbers = useApartmentNumbers(rows.map((r) => r.buildingId));

  // The headline totals cover EVERY debtor, not the 25 on screen, so they come
  // from their own aggregate instead of being summed from `rows`.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    createClient()
      .schema("crm")
      .rpc("overdue_totals", { p_building_id: buildingId === "all" ? null : buildingId })
      .then(({ data, error }) => {
        if (cancelled || error) {
          if (error) console.error("overdue_totals failed:", error.message);
          return;
        }
        setTotals(
          (
            (data ?? []) as Array<{
              currency: Currency;
              contracts: number;
              total_overdue: number;
              remaining_total: number;
            }>
          )
            .map((r) => ({
              currency: r.currency,
              contracts: r.contracts,
              overdue: Number(r.total_overdue),
              remaining: Number(r.remaining_total ?? 0),
            }))
            .filter((r) => r.overdue > 0)
        );
      });
    return () => {
      cancelled = true;
    };
  }, [configured, buildingId, reloadNonce]);

  // The chart shows every building regardless of the filter -- narrowing the
  // list to one ЖК shouldn't hide the comparison that tells you which ЖК to
  // narrow to. Fetched once.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase.schema("crm").from("buildings").select("id, name").order("name"),
      supabase.schema("crm").rpc("overdue_by_building"),
    ]).then(([bRes, oRes]) => {
      if (cancelled) return;
      setBuildings((bRes.data ?? []) as Array<{ id: string; name: string }>);
      if (oRes.error) {
        console.error("overdue_by_building failed:", oRes.error.message);
        return;
      }
      setByBuilding(
        (
          (oRes.data ?? []) as Array<{
            building_name: string;
            currency: Currency;
            contracts: number;
            total_overdue: number;
            remaining_total: number | null;
          }>
        ).map((r) => ({
          name: r.building_name,
          currency: r.currency,
          contracts: r.contracts,
          overdue: Number(r.total_overdue),
          remaining: Number(r.remaining_total ?? 0),
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [configured, reloadNonce]);

  // Grouped by currency: one panel and one scale per currency, because TJS and
  // USD on a shared axis compare nothing.
  const byCurrency = useMemo(() => {
    const seen: Currency[] = [];
    for (const r of byBuilding) if (!seen.includes(r.currency)) seen.push(r.currency);
    return seen.map((currency) => ({
      currency,
      rows: byBuilding.filter((r) => r.currency === currency),
      total: totals.find((tt) => tt.currency === currency) ?? null,
    }));
  }, [byBuilding, totals]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const elapsedWords: ElapsedWords = {
    years: t.debtors.yearsShort,
    months: t.debtors.monthsShort,
    days: t.debtors.days,
    today: t.debtors.today,
  };

  const sortLabels: Record<SortKey, string> = {
    lastPayment: t.debtors.sortFieldLastPayment,
    overdue: t.debtors.sortFieldOverdue,
    remaining: t.debtors.sortFieldRemaining,
    name: t.debtors.sortFieldName,
  };

  const directionLabel = (key: SortKey, asc: boolean) => {
    switch (SORTS[key].kind) {
      case "age":
        return asc ? t.debtors.dirOldestFirst : t.debtors.dirNewestFirst;
      case "amount":
        return asc ? t.debtors.dirLowToHigh : t.debtors.dirHighToLow;
      case "text":
        return asc ? t.debtors.dirAZ : t.debtors.dirZA;
    }
  };

  // Export is the whole list, not the current page -- an Excel file of 25 rows
  // out of 1200 would be quietly wrong in exactly the way this change exists
  // to prevent. Fetched in batches on demand, only when the button is pressed.
  const getExportRows = async () => {
    const supabase = createClient();
    const all: OverdueRow[] = [];
    const order = SORTS[sort];
    for (let from = 0; ; from += EXPORT_BATCH) {
      // The export follows the same filter and the same order as the list on
      // screen -- a file covering every ЖК while the page shows one, or
      // sorted some other way, would disagree with what the person
      // exporting it was looking at.
      let query = supabase
        .schema("crm")
        .rpc("overdue_contracts", { p_building_id: buildingId === "all" ? null : buildingId });
      if (order.kind === "amount") query = query.order("currency", { ascending: true });
      const { data, error } = await query
        .order(order.column, { ascending, nullsFirst: ascending })
        .order("contract_id", { ascending: true })
        .range(from, from + EXPORT_BATCH - 1);
      // A failure part-way must not produce a file that looks complete.
      if (error) throw new Error(error.message);
      const batch = (data ?? []) as OverdueRow[];
      all.push(...batch);
      if (batch.length < EXPORT_BATCH) break;
    }
    // Flat numbers for every building in the file, in one pass.
    const flats = await apartmentNumbersForBuildings(
      supabase,
      all.map((r) => r.building_id)
    );
    const now = Date.now();
    return all.map((raw) => {
      const r = toDebt(raw, now);
      const gap = elapsedSince(r.lastPaymentDate);
      const flat = r.objectId ? flats.get(r.objectId) : undefined;
      return [
        r.clientName,
        r.clientPhone ?? "",
        r.buildingName ?? "",
        r.objectBlock ?? "",
        // The flat number when the grid gives one; otherwise the unit's own
        // name, so the cell is never empty for a unit that exists.
        flat ?? r.objectName ?? "",
        r.objectFloor ?? "",
        r.contractNumber ?? "",
        r.lastPaymentDate ? formatShortDate(r.lastPaymentDate) : t.debtors.noPayments,
        // Real numbers, not text: the file is meant to be sorted and summed.
        gap ? gap.totalDays : "",
        money(r.totalOverdue),
        r.monthlyPayment == null ? "" : money(r.monthlyPayment),
        money(r.remainingTotal),
        r.currency,
      ];
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t.debtors.title}</h1>
          <p className="text-sm text-[var(--ink-4)]">{t.debtors.subtitle}</p>
        </div>
        {totalCount > 0 && (
          <ExportMenu
            getData={getExportRows}
            headers={[
              t.debtors.client,
              t.clients.table.phone,
              t.debtors.building,
              t.debtors.block,
              t.debtors.object,
              t.buildings.floorLabel,
              "№",
              t.debtors.lastPayment,
              t.debtors.daysWithoutPayment,
              t.debtors.overdueNow,
              t.debtors.monthlyPayment,
              t.debtors.remainingCol,
              "Валюта",
            ]}
            filenameBase="debtors"
            title={t.debtors.title}
          />
        )}
      </div>

      {!configured && <SetupNotice />}

      {failure && (
        <div className="rounded-lg border border-[var(--wash-rose-border)] bg-[var(--wash-rose)] px-4 py-3 text-sm text-[var(--wash-rose-ink)]">
          <p className="font-semibold">{t.debtors.loadFailed}</p>
          <p className="mt-1 text-xs opacity-80">{failure}</p>
        </div>
      )}

      {/* Administrator only, and only when some schedule looks pushed forward. */}
      <ShiftedSchedules onRestored={() => setReloadNonce((n) => n + 1)} />

      {/* One panel PER CURRENCY, each on its own scale.
          The previous version put every building on a single axis regardless of
          currency, so 1 072 475 TJS and 99 205 USD were compared as if they
          were the same unit -- the USD bars were flattened to slivers and every
          building appeared twice with no hint why. Currencies do not share an
          axis. Horizontal bars, so "Кайҳонавадон 36 Б" gets the card width
          instead of 40px under a column. */}
      {byCurrency.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {byCurrency.map(({ currency, rows: cRows, total }) => (
            <div
              key={currency}
              className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--ink-2)]">
                  {t.debtors.chartTitle} · {currency}
                </p>
                {total && (
                  <span className="text-xs text-[var(--ink-4)]">
                    <span className="font-semibold text-[var(--wash-rose-ink)]">
                      {formatCurrency(total.overdue, currency)}
                    </span>{" "}
                    <span className="text-[var(--ink-5)]">
                      / {formatCurrency(total.remaining, currency)}
                    </span>
                  </span>
                )}
              </div>
              <HBarChart
                data={cRows.map((b) => ({
                  label: b.name,
                  value: b.overdue,
                  // Track sized to the whole remaining balance, overdue
                  // filled in as a share of it -- see chartHint below,
                  // which this now actually matches.
                  total: b.remaining > 0 ? b.remaining : b.overdue,
                  hue: STATUS_HUES.sold,
                  hint: t.debtors.contractsCount.replace("{n}", String(b.contracts)),
                }))}
                formatValue={(n) => formatCurrency(n, currency)}
              />
              {total && <p className="mt-3 text-xs text-[var(--ink-5)]">{t.debtors.chartHint}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Who has to pay THIS month, per ЖК -- the forward-looking counterpart
          of the overdue charts above. */}
      <DueThisMonthChart />

      {/* Two separate controls with their own labels -- a filter and a sort --
          instead of one glued group where the ЖК filter looked like another
          sort option. Shown while a ЖК is picked even if it has no debtors:
          hiding the toolbar then left no way to pick another one. */}
      {(totalCount > 0 || buildingId !== "all") && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[var(--ink-4)]">{t.debtors.building}:</span>
            <ControlGroup size="sm">
              <select
                value={buildingId}
                onChange={(e) => {
                  setBuildingId(e.target.value);
                  setPage(1);
                }}
                aria-label={t.dashboard.filterBuilding}
                className="h-8 rounded-md border-0 bg-transparent px-2 text-xs text-[var(--ink-2)] focus:outline-none"
              >
                <option value="all">{t.dashboard.allBuildings}</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </ControlGroup>
          </div>

          {/* On a phone the label sits above and the control takes the whole
              row, so the field name is readable and the direction button can
              never be pushed off the screen; from sm up it is one line as wide
              as its content. */}
          <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
            <span className="text-[var(--ink-4)]">{t.debtors.sortLabel}:</span>
            <ControlGroup size="sm" wrap>
              <span className="pl-1 text-[var(--ink-5)]" aria-hidden="true">
                <SortIcon className="h-4 w-4" />
              </span>
              <select
                value={sort}
                onChange={(e) => {
                  const next = e.target.value as SortKey;
                  setSort(next);
                  // Each field has the direction that makes sense for it.
                  setAscending(SORTS[next].defaultAscending);
                  setPage(1);
                }}
                aria-label={t.debtors.sortLabel}
                className="h-8 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 text-xs text-[var(--ink-2)] focus:outline-none"
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {sortLabels[key]}
                  </option>
                ))}
              </select>
              <GroupDivider />
              <button
                type="button"
                onClick={() => {
                  setAscending((a) => !a);
                  setPage(1);
                }}
                title={t.debtors.sortDirection}
                aria-label={`${t.debtors.sortDirection}: ${directionLabel(sort, ascending)}`}
                className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--hover-c2)] active:scale-[0.97]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 transition-transform ${ascending ? "" : "rotate-180"}`}
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                {directionLabel(sort, ascending)}
              </button>
            </ControlGroup>
          </div>
        </div>
      )}

      <div className="animate-fade-up hidden overflow-x-auto rounded-lg border border-[var(--border-c)] bg-[var(--surface-1)] sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border-c)] text-[var(--ink-4)]">
            <tr>
              <th className="px-3 py-3 font-medium">{t.debtors.client}</th>
              <th className="px-3 py-3 font-medium">{t.debtors.unitCol}</th>
              <th className="px-3 py-3 font-medium">{t.debtors.lastPayment}</th>
              <th className="px-3 py-3 text-right font-medium">{t.debtors.overdueNow}</th>
              <th className="px-3 py-3 text-right font-medium">{t.debtors.monthlyPayment}</th>
              <th className="px-3 py-3 text-right font-medium">{t.debtors.remainingCol}</th>
              <th className="px-3 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--ink-5)]">
                  {t.common.loading}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--wash-emerald-ink)]">
                  {t.debtors.empty}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.contractId} className="border-b border-[var(--border-c2)] last:border-0 hover:bg-[var(--hover-c)]">
                <td className="min-w-[9rem] px-3 py-3">
                  <ClientCell debt={r} />
                </td>
                <td className="min-w-[12rem] px-3 py-3">
                  <UnitCell debt={r} apartmentNumbers={apartmentNumbers} />
                </td>
                <td className="px-3 py-3">
                  <LastPaymentCell debt={r} words={elapsedWords} />
                </td>
                {/* Amount first, then how many payments make it up and since
                    when, spelled out. "9 плат." said nothing about what was
                    owed. */}
                <td className="px-3 py-3 text-right">
                  <div className="font-semibold text-[var(--wash-rose-ink)]">
                    {formatCurrency(r.totalOverdue, r.currency)}
                  </div>
                  {/* Two short lines instead of one that wraps into three
                      in a narrow column. */}
                  <div className="whitespace-nowrap text-xs text-[var(--ink-5)]">
                    {t.debtors.missedCount.replace("{n}", String(r.missedCount))}
                  </div>
                  <div className="whitespace-nowrap text-xs text-[var(--ink-5)]">
                    {t.debtors.since} {formatShortDate(r.earliestDue)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--ink-2)]">
                  {r.monthlyPayment == null ? "—" : formatCurrency(r.monthlyPayment, r.currency)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-[var(--ink-2)]">
                  {formatCurrency(r.remainingTotal, r.currency)}
                </td>
                <td className="px-3 py-3 text-right">
                  <ReminderLink debt={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="animate-fade-up flex flex-col gap-2 sm:hidden">
        {loading && (
          <p className="rounded-lg border border-[var(--border-c)] bg-[var(--surface-1)] px-4 py-6 text-center text-sm text-[var(--ink-5)]">
            {t.common.loading}
          </p>
        )}
        {!loading && rows.length === 0 && (
          <p className="rounded-lg border border-[var(--border-c)] bg-[var(--surface-1)] px-4 py-8 text-center text-sm text-[var(--wash-emerald-ink)]">
            {t.debtors.empty}
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.contractId}
            className="flex flex-col gap-2.5 rounded-lg border border-[var(--border-c)] bg-[var(--surface-1)] p-3.5"
          >
            {/* Stacked, not side by side: the unit's "block, floor, flat" line is
                long, and next to it the name was squeezed to one word a line. */}
            <div className="flex flex-col gap-1">
              <ClientCell debt={r} />
              <div className="text-xs">
                <UnitCell debt={r} apartmentNumbers={apartmentNumbers} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--ink-5)]">
              <span>{t.debtors.lastPayment}:</span>
              <LastPaymentCell debt={r} words={elapsedWords} inline />
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--wash-rose-ink)]">
                  {formatCurrency(r.totalOverdue, r.currency)}
                </p>
                <p className="text-xs text-[var(--ink-5)]">
                  {t.debtors.missedCount.replace("{n}", String(r.missedCount))}
                </p>
                <p className="text-xs text-[var(--ink-5)]">
                  {t.debtors.since} {formatShortDate(r.earliestDue)}
                </p>
                {r.monthlyPayment != null && (
                  <p className="text-xs text-[var(--ink-5)]">
                    {t.debtors.monthlyPayment}: {formatCurrency(r.monthlyPayment, r.currency)}
                  </p>
                )}
                <p className="text-xs text-[var(--ink-5)]">
                  {t.debtors.remainingCol}: {formatCurrency(r.remainingTotal, r.currency)}
                </p>
              </div>
              <ReminderLink debt={r} compact />
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
