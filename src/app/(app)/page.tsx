"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { RevenueChart, type RevenueMonth } from "@/components/RevenueChart";
import { formatCurrency, type Currency } from "@/lib/currency";
import { STATUS_COLORS } from "@/lib/objects/format";
import type { ObjectStatus } from "@/lib/objects/types";
import type { Building } from "@/lib/buildings/types";

type Counts = {
  total: number;
  available: number;
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
};

type ContractRow = {
  object_id: string;
  amount: number;
  paid_amount: number;
  currency: Currency;
  signed_date: string | null;
  status: string;
  client: { id: string; name: string } | null;
};

export default function DashboardPage() {
  const { t } = useLocale();
  const [allObjects, setAllObjects] = useState<ObjectRow[]>([]);
  const [allContracts, setAllContracts] = useState<ContractRow[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();

    Promise.all([
      supabase.schema("crm").from("objects").select("id, status, building_id"),
      supabase
        .schema("crm")
        .from("contracts")
        .select(
          "object_id, amount, paid_amount, currency, signed_date, status, client:clients(id, name)"
        ),
      supabase.schema("crm").from("buildings").select("*"),
    ]).then(([objectsRes, contractsRes, buildingsRes]) => {
      setAllObjects((objectsRes.data ?? []) as ObjectRow[]);
      setAllContracts((contractsRes.data ?? []) as unknown as ContractRow[]);
      setBuildings((buildingsRes.data ?? []) as Building[]);
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

  const counts: Counts = useMemo(
    () => ({
      total: objects.length,
      available: objects.filter((o) => o.status === "available").length,
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

  const debtors: Debtor[] = useMemo(() => {
    const debtorMap = new Map<string, Debtor>();
    contracts
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
  }, [contracts]);

  const cards = [
    { label: t.dashboard.totalObjects, value: counts.total },
    { label: t.dashboard.available, value: counts.available },
    { label: t.dashboard.sold, value: counts.sold },
    { label: t.dashboard.inProgress, value: counts.in_progress },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.dashboard.title}</h1>
        <div className="flex items-center gap-3 print:hidden">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{t.dashboard.filterBuilding}</span>
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="all">{t.dashboard.allBuildings}</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t.dashboard.printReport}
          </button>
        </div>
      </div>

      {!configured && <SetupNotice />}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold">
              {loading ? "…" : card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-4 text-sm font-semibold text-slate-700">
          {t.dashboard.revenueByMonth}
        </p>
        {revenue.length > 0 ? (
          <RevenueChart data={revenue} />
        ) : (
          <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
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

      <div className="rounded-lg border border-slate-200 bg-white p-4">
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
    </div>
  );
}
