"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { AddMenu } from "@/components/AddMenu";
import { useRole } from "@/lib/auth/useRole";
import { Pagination } from "@/components/Pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { STATUS_COLORS, formatArea } from "@/lib/objects/format";
import { formatCurrency } from "@/lib/currency";
import {
  OBJECT_STATUSES,
  OBJECT_TYPES,
  type ObjectStatus,
  type ObjectType,
  type PropertyObject,
} from "@/lib/objects/types";
import type { Building } from "@/lib/buildings/types";

const PAGE_SIZE = 25;

export default function ObjectsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();
  const { role } = useRole();

  const [objects, setObjects] = useState<PropertyObject[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [buildings, setBuildings] = useState<Building[]>([]);
  // Per-building roll-up of its child units: how many are still available and
  // the total free area, so the list can show a live "В продаже" status and
  // the remaining square metres instead of a dash.
  const [buildingStats, setBuildingStats] = useState<
    Record<string, { available: number; availableArea: number; total: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput);
  const [typeFilter, setTypeFilter] = useState<ObjectType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ObjectStatus | "all">("all");

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    setLoading(true);

    let query = supabase
      .schema("crm")
      .from("objects")
      .select("*", { count: "exact" })
      .is("building_id", null);
    if (typeFilter !== "all") query = query.eq("type", typeFilter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (search.trim()) {
      const q = search.trim();
      query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`);
    }
    const from = (page - 1) * PAGE_SIZE;
    query = query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);

    query.then(({ data, count }) => {
      setObjects((data ?? []) as PropertyObject[]);
      setTotalCount(count ?? 0);
      setLoading(false);
    });
  }, [configured, page, search, typeFilter, statusFilter]);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("buildings")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setBuildings((data ?? []) as Building[]));
  }, [configured]);

  // Roll up each building's units (available count + free area). Counted in
  // SQL: this used to read every unit of every building in 1000-row pages, one
  // request after another -- ten sequential round trips on a 10 000-unit
  // development, for three numbers per card.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    createClient()
      .schema("crm")
      .rpc("building_unit_stats")
      .then(({ data, error }) => {
        if (cancelled || error) {
          if (error) console.error("building_unit_stats failed:", error.message);
          return;
        }
        const stats: Record<
          string,
          { available: number; availableArea: number; total: number }
        > = {};
        for (const row of (data ?? []) as Array<{
          building_id: string;
          total: number;
          available: number;
          available_area: number;
        }>) {
          stats[row.building_id] = {
            total: row.total,
            available: row.available,
            availableArea: Number(row.available_area),
          };
        }
        setBuildingStats(stats);
      });

    return () => {
      cancelled = true;
    };
  }, [configured]);

  const filteredBuildings = useMemo(() => {
    if (typeFilter !== "all" || statusFilter !== "all") return [];
    return buildings.filter((b) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return `${b.name} ${b.address ?? ""}`.toLowerCase().includes(q);
    });
  }, [buildings, typeFilter, statusFilter, search]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const empty = !loading && objects.length === 0 && filteredBuildings.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.objects.title}</h1>
        {role === "admin" && (
          <AddMenu
            label={t.objects.add}
            items={[
              { href: "/objects/new", label: t.objects.newObject },
              { href: "/buildings/new", label: t.objects.newBuilding },
            ]}
          />
        )}
      </div>

      {!configured && <SetupNotice />}

      <div className="flex flex-wrap gap-3">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t.objects.search}
          className="h-10 min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ObjectType | "all")}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="all">{t.objects.filters.allTypes}</option>
          {OBJECT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t.objects.types[type]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ObjectStatus | "all")}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="all">{t.objects.filters.allStatuses}</option>
          {OBJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.objects.statuses[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="animate-fade-up overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t.objects.table.name}</th>
              <th className="px-4 py-3 font-medium">{t.objects.table.address}</th>
              <th className="px-4 py-3 font-medium">{t.objects.table.type}</th>
              <th className="px-4 py-3 font-medium">{t.objects.table.status}</th>
              <th className="px-4 py-3 font-medium">{t.objects.table.area}</th>
              <th className="px-4 py-3 font-medium">{t.objects.table.price}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t.common.loading}
                </td>
              </tr>
            )}
            {empty && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t.objects.empty}
                </td>
              </tr>
            )}
            {filteredBuildings.map((building) => (
              <tr
                key={`building-${building.id}`}
                className="cursor-pointer border-b border-slate-100 bg-slate-50/60 transition-colors last:border-0 hover:bg-slate-100"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/buildings/${building.id}`} className="block">
                    {building.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{building.address || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{t.objects.buildingRowType}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const s = buildingStats[building.id];
                    if (!s || s.total === 0)
                      return <span className="text-slate-600">—</span>;
                    const sold = s.available === 0;
                    return (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          sold ? STATUS_COLORS.sold : STATUS_COLORS.available
                        }`}
                      >
                        {sold
                          ? t.objects.buildingSoldOut
                          : `${t.objects.buildingInSale} · ${s.available}`}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {buildingStats[building.id]?.availableArea
                    ? formatArea(buildingStats[building.id].availableArea)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {building.price_per_sqm
                    ? `${formatCurrency(building.price_per_sqm, "TJS")}/м²`
                    : "—"}
                </td>
              </tr>
            ))}
            {objects.map((obj) => (
              <tr
                key={obj.id}
                className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/objects/${obj.id}`} className="block">
                    {obj.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{obj.address || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{t.objects.types[obj.type]}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[obj.status]}`}
                  >
                    {t.objects.statuses[obj.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatArea(obj.area)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatCurrency(obj.price, obj.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
