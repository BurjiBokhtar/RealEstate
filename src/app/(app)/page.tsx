"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { DashboardHero } from "@/components/DashboardHero";
import { RevenueChart, type RevenueMonth } from "@/components/RevenueChart";
import { ManagerSales } from "@/components/ManagerSales";
import { StatCard, StatIcons } from "@/components/StatCard";
import { formatCurrency, type Currency } from "@/lib/currency";
import { MoneyPairValue, type MoneyPair } from "@/components/MoneyPairValue";
import { STATUS_COLORS } from "@/lib/objects/format";
import type { ObjectStatus } from "@/lib/objects/types";
import type { Building } from "@/lib/buildings/types";

type Counts = {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  in_progress: number;
};

type BuildingOccupancy = {
  id: string;
  name: string;
  counts: Record<ObjectStatus, number>;
  total: number;
};

type Debtor = {
  clientId: string;
  clientName: string;
  remaining: number;
  currency: Currency;
};

type ObjectRow = {
  id: string;
  status: ObjectStatus;
  building_id: string | null;
  price: number | null;
  currency: Currency;
  area: number | null;
};

function formatArea(m2: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(m2))} м²`;
}

type ContractRow = {
  object_id: string;
  amount: number;
  paid_amount: number;
  currency: Currency;
  signed_date: string | null;
  status: string;
  client: { id: string; name: string } | null;
};

type PaymentRow = {
  paid: boolean;
  paid_date: string | null;
  amount: number;
  contract: { currency: Currency; object_id: string } | null;
};

export default function DashboardPage() {
  const { t } = useLocale();
  const { settings } = useSettings();
  const brandName = settings.company_name || t.appName;
  const [allObjects, setAllObjects] = useState<ObjectRow[]>([]);
  const [allContracts, setAllContracts] = useState<ContractRow[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRow[]>([]);
  // Unpaid installments whose due date has passed -- powers the "overdue"
  // tile that links to the Debtors page.
  const [overdueRows, setOverdueRows] = useState<
    Array<{ amount: number; currency: Currency; objectId: string; cancelled: boolean }>
  >([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "month" | "year">("all");
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();

    Promise.all([
      supabase
        .schema("crm")
        .from("objects")
        .select("id, status, building_id, price, currency, area"),
      supabase
        .schema("crm")
        .from("contracts")
        .select(
          "object_id, amount, paid_amount, currency, signed_date, status, client:clients(id, name)"
        ),
      supabase.schema("crm").from("buildings").select("*"),
      supabase
        .schema("crm")
        .from("contract_payments")
        .select("paid, paid_date, amount, contract:contracts(currency, object_id)")
        .eq("paid", true),
      supabase
        .schema("crm")
        .from("contract_payments")
        .select("amount, contract:contracts(currency, object_id, status)")
        .eq("paid", false)
        .lt("due_date", new Date().toISOString().slice(0, 10)),
    ]).then(([objectsRes, contractsRes, buildingsRes, paymentsRes, overdueRes]) => {
      setAllObjects((objectsRes.data ?? []) as ObjectRow[]);
      setAllContracts((contractsRes.data ?? []) as unknown as ContractRow[]);
      setBuildings((buildingsRes.data ?? []) as Building[]);
      setAllPayments((paymentsRes.data ?? []) as unknown as PaymentRow[]);
      setOverdueRows(
        ((overdueRes.data ?? []) as unknown as Array<{
          amount: number;
          contract: { currency: Currency; object_id: string; status: string } | null;
        }>)
          .filter((r) => r.contract)
          .map((r) => ({
            amount: r.amount,
            currency: r.contract!.currency,
            objectId: r.contract!.object_id,
            cancelled: r.contract!.status === "cancelled",
          }))
      );
      setLoading(false);
    });
  }, [configured]);

  const scopedObjectIds = useMemo(() => {
    if (selectedBuildingId === "all") return null;
    return new Set(
      allObjects.filter((o) => o.building_id === selectedBuildingId).map((o) => o.id)
    );
  }, [allObjects, selectedBuildingId]);

  const objects = useMemo(() => {
    if (!scopedObjectIds) return allObjects;
    return allObjects.filter((o) => scopedObjectIds.has(o.id));
  }, [allObjects, scopedObjectIds]);

  const contracts = useMemo(() => {
    if (!scopedObjectIds) return allContracts;
    return allContracts.filter((c) => scopedObjectIds.has(c.object_id));
  }, [allContracts, scopedObjectIds]);

  const periodBounds = useMemo(() => {
    if (periodFilter === "all") return null;
    const now = new Date();
    const start = new Date();
    if (periodFilter === "month") start.setDate(1);
    if (periodFilter === "year") start.setMonth(0, 1);
    // "today": start stays "now" — comparing date-only strings below means
    // both start and end resolve to today's date.
    return {
      start: start.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    };
  }, [periodFilter]);

  // Only figures derived from dated events (revenue/debt/who-owes-what) are
  // scoped by the period filter — inventory snapshots (counts, occupancy)
  // and the monthly trend chart intentionally stay unfiltered.
  const periodContracts = useMemo(() => {
    if (!periodBounds) return contracts;
    return contracts.filter(
      (c) =>
        c.signed_date && c.signed_date >= periodBounds.start && c.signed_date <= periodBounds.end
    );
  }, [contracts, periodBounds]);

  const counts: Counts = useMemo(
    () => ({
      total: objects.length,
      available: objects.filter((o) => o.status === "available").length,
      reserved: objects.filter((o) => o.status === "reserved").length,
      sold: objects.filter((o) => o.status === "sold").length,
      in_progress: objects.filter((o) => o.status === "in_progress").length,
    }),
    [objects]
  );

  const occupancy: BuildingOccupancy[] = useMemo(() => {
    const relevantBuildings =
      selectedBuildingId === "all"
        ? buildings
        : buildings.filter((b) => b.id === selectedBuildingId);
    return relevantBuildings
      .map((b) => {
        const units = allObjects.filter((o) => o.building_id === b.id);
        const c: Record<ObjectStatus, number> = {
          available: 0,
          reserved: 0,
          sold: 0,
          rented: 0,
          in_progress: 0,
        };
        units.forEach((u) => {
          c[u.status] += 1;
        });
        return { id: b.id, name: b.name, counts: c, total: units.length };
      })
      .filter((b) => b.total > 0);
  }, [buildings, allObjects, selectedBuildingId]);

  const revenue: RevenueMonth[] = useMemo(() => {
    const monthMap = new Map<string, { tjs: number; usd: number }>();
    contracts
      .filter((c) => c.signed_date && c.status !== "cancelled")
      .forEach((c) => {
        const month = c.signed_date!.slice(0, 7);
        const entry = monthMap.get(month) ?? { tjs: 0, usd: 0 };
        if (c.currency === "USD") entry.usd += c.amount;
        else entry.tjs += c.amount;
        monthMap.set(month, entry);
      });
    return Array.from(monthMap.keys())
      .sort()
      .slice(-6)
      .map((month) => ({ month, ...monthMap.get(month)! }));
  }, [contracts]);

  // Day-level granularity only makes sense once the period is narrowed down
  // to "today" or "month" -- at "year"/"all" scope it would be hundreds of
  // unreadable bars, so the existing monthly chart covers those instead.
  const dailyRevenue: RevenueMonth[] = useMemo(() => {
    if (periodFilter !== "today" && periodFilter !== "month") return [];
    if (!periodBounds) return [];
    const dayMap = new Map<string, { tjs: number; usd: number }>();
    allPayments
      .filter((p) => p.paid && p.paid_date && p.contract)
      .filter((p) => !scopedObjectIds || scopedObjectIds.has(p.contract!.object_id))
      .filter((p) => p.paid_date! >= periodBounds.start && p.paid_date! <= periodBounds.end)
      .forEach((p) => {
        const day = p.paid_date!;
        const entry = dayMap.get(day) ?? { tjs: 0, usd: 0 };
        if (p.contract!.currency === "USD") entry.usd += p.amount;
        else entry.tjs += p.amount;
        dayMap.set(day, entry);
      });
    return Array.from(dayMap.keys())
      .sort()
      .map((day) => ({ month: day, ...dayMap.get(day)! }));
  }, [allPayments, scopedObjectIds, periodFilter, periodBounds]);

  const debtors: Debtor[] = useMemo(() => {
    const debtorMap = new Map<string, Debtor>();
    periodContracts
      .filter((c) => c.status !== "cancelled" && c.client)
      .forEach((c) => {
        const remaining = c.amount - c.paid_amount;
        if (remaining <= 0) return;
        const key = `${c.client!.id}-${c.currency}`;
        const existing = debtorMap.get(key);
        debtorMap.set(key, {
          clientId: c.client!.id,
          clientName: c.client!.name,
          currency: c.currency,
          remaining: (existing?.remaining ?? 0) + remaining,
        });
      });
    return Array.from(debtorMap.values())
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 5);
  }, [periodContracts]);

  const paidRevenue: MoneyPair = useMemo(() => {
    const v: MoneyPair = { tjs: 0, usd: 0 };
    periodContracts
      .filter((c) => c.status !== "cancelled")
      .forEach((c) => {
        if (c.currency === "USD") v.usd += c.paid_amount;
        else v.tjs += c.paid_amount;
      });
    return v;
  }, [periodContracts]);

  const totalDebt: MoneyPair = useMemo(() => {
    const v: MoneyPair = { tjs: 0, usd: 0 };
    periodContracts
      .filter((c) => c.status !== "cancelled")
      .forEach((c) => {
        const remaining = c.amount - c.paid_amount;
        if (remaining <= 0) return;
        if (c.currency === "USD") v.usd += remaining;
        else v.tjs += remaining;
      });
    return v;
  }, [periodContracts]);

  // Overdue total, respecting the building filter but not the period filter
  // (a debt is overdue regardless of which reporting period you're viewing).
  const overdue: MoneyPair = useMemo(() => {
    const v: MoneyPair = { tjs: 0, usd: 0 };
    overdueRows.forEach((r) => {
      if (r.cancelled) return;
      if (scopedObjectIds && !scopedObjectIds.has(r.objectId)) return;
      if (r.currency === "USD") v.usd += r.amount;
      else v.tjs += r.amount;
    });
    return v;
  }, [overdueRows, scopedObjectIds]);

  const potentialRevenue: MoneyPair = useMemo(() => {
    const v: MoneyPair = { tjs: 0, usd: 0 };
    objects
      .filter((o) => o.status === "available" && o.price)
      .forEach((o) => {
        if (o.currency === "USD") v.usd += o.price!;
        else v.tjs += o.price!;
      });
    return v;
  }, [objects]);

  // Floor area: how much is built and how much is still available to sell.
  const area = useMemo(() => {
    let total = 0;
    let availableArea = 0;
    for (const o of objects) {
      const a = o.area ?? 0;
      total += a;
      if (o.status === "available") availableArea += a;
    }
    return { total, available: availableArea };
  }, [objects]);

  const revenueByBuilding = useMemo(() => {
    const objectToBuilding = new Map(allObjects.map((o) => [o.id, o.building_id]));
    const map = new Map<string, MoneyPair>();
    periodContracts
      .filter((c) => c.status !== "cancelled")
      .forEach((c) => {
        const buildingId = objectToBuilding.get(c.object_id);
        if (!buildingId) return;
        const entry = map.get(buildingId) ?? { tjs: 0, usd: 0 };
        if (c.currency === "USD") entry.usd += c.amount;
        else entry.tjs += c.amount;
        map.set(buildingId, entry);
      });
    const relevantBuildings =
      selectedBuildingId === "all"
        ? buildings
        : buildings.filter((b) => b.id === selectedBuildingId);
    return relevantBuildings
      .map((b) => ({ id: b.id, name: b.name, ...(map.get(b.id) ?? { tjs: 0, usd: 0 }) }))
      .filter((b) => b.tjs > 0 || b.usd > 0)
      .sort((a, b) => b.tjs + b.usd - (a.tjs + a.usd));
  }, [allObjects, periodContracts, buildings, selectedBuildingId]);


  return (
    <div className="flex flex-col gap-5">
      <DashboardHero
        t={t}
        loading={loading}
        brandName={brandName}
        totalUnits={counts.total}
        availableCount={counts.available}
        reservedCount={counts.reserved}
        soldCount={counts.sold}
        paidRevenue={paidRevenue}
        buildings={buildings}
        selectedBuildingId={selectedBuildingId}
        onBuildingChange={setSelectedBuildingId}
        periodFilter={periodFilter}
        onPeriodChange={setPeriodFilter}
      />

      {!configured && <SetupNotice />}

      {/* Only what the hero doesn't already say: total/available/sold and
          paid revenue live up there now, so this row carries just the
          three numbers that don't. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label={t.dashboard.totalArea}
          value={formatArea(area.total)}
          sub={t.dashboard.totalAreaSub}
          icon={StatIcons.area}
          tone="indigo"
          delay={0}
          loading={loading}
        />
        <StatCard
          label={t.dashboard.areaForSale}
          value={formatArea(area.available)}
          sub={
            area.total > 0
              ? `${Math.round((area.available / area.total) * 100)}%`
              : undefined
          }
          icon={StatIcons.tag}
          tone="emerald"
          delay={40}
          loading={loading}
        />
        <StatCard
          label={t.dashboard.inProgress}
          value={counts.in_progress}
          icon={StatIcons.hammer}
          tone="amber"
          delay={80}
          loading={loading}
        />
        <StatCard
          label={t.dashboard.totalDebt}
          value={<MoneyPairValue value={totalDebt} />}
          icon={StatIcons.debt}
          tone="rose"
          delay={120}
          loading={loading}
        />
        <StatCard
          label={t.dashboard.overdueTile}
          value={<MoneyPairValue value={overdue} />}
          icon={StatIcons.warning}
          tone="rose"
          href="/debtors"
          delay={160}
          loading={loading}
        />
        <StatCard
          label={t.dashboard.potentialRevenue}
          value={<MoneyPairValue value={potentialRevenue} />}
          icon={StatIcons.wallet}
          tone="plum"
          delay={200}
          loading={loading}
        />
      </div>

      {(periodFilter === "today" || periodFilter === "month") && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-slate-700">
            {t.dashboard.revenueByDay}
          </p>
          {dailyRevenue.length > 0 ? (
            <RevenueChart data={dailyRevenue} />
          ) : (
            <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-700">
          {t.dashboard.revenueByMonth}
        </p>
        {revenue.length > 0 ? (
          <RevenueChart data={revenue} />
        ) : (
          <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-700">
          {t.dashboard.occupancyByBuilding}
        </p>
        {occupancy.length > 0 ? (
          <div className="flex flex-col gap-3">
            {occupancy.map((b) => (
              <div key={b.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <Link
                    href={`/buildings/${b.id}`}
                    className="font-medium text-slate-700 hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="text-slate-400">{b.total}</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  {(Object.keys(b.counts) as ObjectStatus[]).map((status) =>
                    b.counts[status] > 0 ? (
                      <div
                        key={status}
                        style={{ width: `${(b.counts[status] / b.total) * 100}%` }}
                        className={`transition-all duration-200 hover:brightness-95 ${STATUS_COLORS[status].split(" ")[0]}`}
                        title={`${t.objects.statuses[status]}: ${b.counts[status]}`}
                      />
                    ) : null
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-700">
          {t.dashboard.revenueByBuilding}
        </p>
        {revenueByBuilding.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-2 font-medium">{t.buildings.title}</th>
                <th className="pb-2 font-medium">{t.dashboard.revenueByMonth}</th>
              </tr>
            </thead>
            <tbody>
              {revenueByBuilding.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">
                    <Link href={`/buildings/${b.id}`} className="hover:underline">
                      {b.name}
                    </Link>
                  </td>
                  <td className="py-2 text-base font-medium text-slate-700">
                    <MoneyPairValue value={{ tjs: b.tjs, usd: b.usd }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-700">{t.dashboard.topDebtors}</p>
        {debtors.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-2 font-medium">{t.clients.table.name}</th>
                <th className="pb-2 font-medium">{t.dashboard.remaining}</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d) => (
                <tr
                  key={`${d.clientId}-${d.currency}`}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-2">
                    <Link href={`/clients/${d.clientId}`} className="hover:underline">
                      {d.clientName}
                    </Link>
                  </td>
                  <td className="py-2 text-rose-600">
                    {formatCurrency(d.remaining, d.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
        )}
      </div>
      <ManagerSales />
    </div>
  );
}
