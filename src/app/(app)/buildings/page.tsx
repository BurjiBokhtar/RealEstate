"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import type { Building } from "@/lib/buildings/types";

export default function BuildingsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("buildings")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setBuildings((data ?? []) as Building[]);
        setLoading(false);
      });
  }, [configured]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.buildings.title}</h1>
        <Link
          href="/buildings/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + {t.buildings.newBuilding}
        </Link>
      </div>

      {!configured && <SetupNotice />}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t.buildings.table.name}</th>
              <th className="px-4 py-3 font-medium">{t.buildings.table.address}</th>
              <th className="px-4 py-3 font-medium">{t.buildings.table.floors}</th>
              <th className="px-4 py-3 font-medium">{t.buildings.table.unitsPerFloor}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {t.common.loading}
                </td>
              </tr>
            )}
            {!loading && buildings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {t.buildings.empty}
                </td>
              </tr>
            )}
            {buildings.map((building) => (
              <tr
                key={building.id}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/buildings/${building.id}`} className="block">
                    {building.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{building.address || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{building.floors_count ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {building.units_per_floor ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
