"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { STATUS_COLORS, formatArea } from "@/lib/objects/format";
import { formatDualCurrency } from "@/lib/currency";
import { useSettings } from "@/lib/settings/SettingsProvider";
import {
  OBJECT_STATUSES,
  OBJECT_TYPES,
  type ObjectStatus,
  type ObjectType,
  type PropertyObject,
} from "@/lib/objects/types";

export default function ObjectsPage() {
  const { t } = useLocale();
  const { settings } = useSettings();
  const configured = isSupabaseConfigured();

  const [objects, setObjects] = useState<PropertyObject[]>([]);
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
    supabase
      .schema("crm")
      .from("objects")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setObjects((data ?? []) as PropertyObject[]);
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.objects.title}</h1>
        <Link
          href="/objects/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + {t.objects.newObject}
        </Link>
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
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t.objects.empty}
                </td>
              </tr>
            )}
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
                  {formatDualCurrency(obj.price, settings.usd_rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
