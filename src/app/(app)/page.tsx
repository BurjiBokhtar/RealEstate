"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { RevenueChart } from "@/components/RevenueChart";
import { formatDualCurrency } from "@/lib/currency";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { STATUS_COLORS } from "@/lib/objects/format";
import type { ObjectStatus } from "@/lib/objects/types";

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
};

export default function DashboardPage() {
  const { t } = useLocale();
  const { settings } = useSettings();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [revenue, setRevenue] = useState<Array<{ month: string; revenue: number }>>([]);
  const [occupancy, setOccupancy] = useState<BuildingOccupancy[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
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
          "amount, paid_amount, signed_date, status, client:clients(id, name)"
        ),
      supabase.schema("crm").from("buildings").select("id, name"),
    ]).then(([objectsRes, contractsRes, buildingsRes]) => {
      const objectRows = (objectsRes.data ?? []) as Array<{
        id: string;
        status: ObjectStatus;
        building_id: string | null;
      }>;
      setCounts({
        total: objectRows.length,
        available: objectRows.filter((r) => r.status === "available").length,
        sold: objectRows.filter((r) => r.status === "sold").length,
        in_progress: objectRows.filter((r) => r.status === "in_progress").length,
      });

      const buildingRows = (buildingsRes.data ?? []) as Array<{ id: string; name: string }>;
      const occ: BuildingOccupancy[] = buildingRows.map((b) => {
        const units = objectRows.filter((o) => o.building_id === b.id);
        const emptyCounts: Record<ObjectStatus, number> = {
          available: 0,
          reserved: 0,
          sold: 0,
          rented: 0,
          in_progress: 0,
        };
        units.forEach((u) => {
          emptyCounts[u.status] += 1;
        });
        return { id: b.id, name: b.name, counts: emptyCounts, total: units.length };
      });
      setOccupancy(occ.filter((b) => b.total > 0));

      const contractRows = (contractsRes.data ?? []) as unknown as Array<{
        amount: number;
        paid_amount: number;
        signed_date: string | null;
        status: string;
        client: { id: string; name: string } | null;
      }>;

      const monthMap = new Map<string, number>();
      contractRows
        .filter((c) => c.signed_date && c.status !== "cancelled")
        .forEach((c) => {
          const month = c.signed_date!.slice(0, 7);
          monthMap.set(month, (monthMap.get(month) ?? 0) + c.amount);
        });
      const sortedMonths = Array.from(monthMap.keys()).sort().slice(-6);
      setRevenue(sortedMonths.map((month) => ({ month, revenue: monthMap.get(month)! })));

      const debtorMap = new Map<string, Debtor>();
      contractRows
        .filter((c) => c.status !== "cancelled" && c.client)
        .forEach((c) => {
          const remaining = c.amount - c.paid_amount;
          if (remaining <= 0) return;
          const existing = debtorMap.get(c.client!.id);
          debtorMap.set(c.client!.id, {
            clientId: c.client!.id,
            clientName: c.client!.name,
            remaining: (existing?.remaining ?? 0) + remaining,
          });
        });
      setDebtors(
        Array.from(debtorMap.values())
          .sort((a, b) => b.remaining - a.remaining)
          .slice(0, 5)
      );

      setLoading(false);
    });
  }, [configured]);

  const cards = [
    { label: t.dashboard.totalObjects, value: counts?.total },
    { label: t.dashboard.available, value: counts?.available },
    { label: t.dashboard.sold, value: counts?.sold },
    { label: t.dashboard.inProgress, value: counts?.in_progress },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">{t.dashboard.title}</h1>

      {!configured && <SetupNotice />}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold">
              {loading ? "…" : (card.value ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/objects"
        className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        {t.nav.objects} →
      </Link>

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
                  <Link href={`/buildings/${b.id}`} className="font-medium text-slate-700 hover:underline">
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
                        className={STATUS_COLORS[status].split(" ")[0]}
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
                <tr key={d.clientId} className="border-b border-slate-100 last:border-0">
                  <td className="py-2">
                    <Link href={`/clients/${d.clientId}`} className="hover:underline">
                      {d.clientName}
                    </Link>
                  </td>
                  <td className="py-2 text-rose-600">
                    {formatDualCurrency(d.remaining, settings.usd_rate)}
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
