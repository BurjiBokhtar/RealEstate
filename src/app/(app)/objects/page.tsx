"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
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

export default function ObjectsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();

  const [objects, setObjects] = useState<PropertyObject[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ObjectType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ObjectStatus | "all">("all");

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
        .select("*")
        .is("building_id", null)
        .order("created_at", { ascending: false }),
      supabase
        .schema("crm")
        .from("buildings")
        .select("*")
        .order("created_at", { ascending: false }),
    ]).then(([objectsRes, buildingsRes]) => {
      setObjects((objectsRes.data ?? []) as PropertyObject[]);
      setBuildings((buildingsRes.data ?? []) as Building[]);
      setLoading(false);
    });
  }, [configured]);

  const filtered = useMemo(() => {
    return objects.filter((o) => {
      if (typeFilter !== "all" && o.type !== typeFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${o.name} ${o.address ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [objects, typeFilter, statusFilter, search]);

  const filteredBuildings = useMemo(() => {
    if (typeFilter !== "all" || statusFilter !== "all") return [];
    return buildings.filter((b) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return `${b.name} ${b.address ?? ""}`.toLowerCase().includes(q);
    });
  }, [buildings, typeFilter, statusFilter, search]);

  const empty = !loading && filtered.length === 0 && filteredBuildings.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.objects.title}</h1>
        <div className="flex gap-2">
          <Link
            href="/buildings/new"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + {t.objects.newBuilding}
          </Link>
          <Link
            href="/objects/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + {t.objects.newObject}
          </Link>
        </div>
      </div>

      {!configured && <SetupNotice />}

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.objects.search}
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ObjectType | "all")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">{t.objects.filters.allStatuses}</option>
          {OBJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.objects.statuses[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                className="cursor-pointer border-b border-slate-100 bg-slate-50/60 last:border-0 hover:bg-slate-100"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/buildings/${building.id}`} className="block">
                    {building.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{building.address || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{t.objects.buildingRowType}</td>
                <td className="px-4 py-3 text-slate-600">
                  {building.floors_count && building.units_per_floor
                    ? `${building.floors_count} × ${building.units_per_floor}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">—</td>
                <td className="px-4 py-3 text-slate-600">
                  {building.price_per_sqm
                    ? `${formatCurrency(building.price_per_sqm, "TJS")}/м²`
                    : "—"}
                </td>
              </tr>
            ))}
            {filtered.map((obj) => (
              <tr
                key={obj.id}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
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
    </div>
  );
}
