"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ConstructionStatusBadge } from "@/components/ConstructionStatusBadge";
import type { Building } from "@/lib/buildings/types";

// Card grid instead of a table: each ЖК shows its facade photo (or an atlas
// placeholder), name, address and floor count. Buildings are few, so this
// loads fast and reads far better than a row of text.
export default function BuildingsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();

  const [buildings, setBuildings] = useState<Building[]>([]);
  // Seeded from `configured` rather than set from inside the effect: the
  // flag is a build-time env check, constant for the whole session, so the
  // not-configured case is a starting value, not something to synchronise.
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    Promise.all([
      supabase.schema("crm").from("buildings").select("*"),
      // Same RPC the objects list uses for its "В продаже · N" roll-up --
      // counted in SQL rather than paging through every unit here too.
      supabase.schema("crm").rpc("building_unit_stats"),
    ]).then(([buildingsRes, statsRes]) => {
      const rows = (buildingsRes.data ?? []) as Building[];
      const available = new Map<string, number>();
      for (const row of (statsRes.data ?? []) as Array<{
        building_id: string;
        available: number;
      }>) {
        available.set(row.building_id, row.available);
      }
      // Most free units first, down to the most sold-out -- the question
      // this page answers is "where is there still something to sell",
      // not "what was added most recently".
      rows.sort((a, b) => (available.get(b.id) ?? 0) - (available.get(a.id) ?? 0));
      setBuildings(rows);
      setLoading(false);
    });
  }, [configured]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">{t.buildings.title}</h1>

      {!configured && <SetupNotice />}

      {loading ? (
        <p className="text-[var(--ink-5)]">{t.common.loading}</p>
      ) : buildings.length === 0 ? (
        <p className="text-[var(--ink-5)]">{t.buildings.empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {buildings.map((building, i) => (
            <Link
              key={building.id}
              href={`/buildings/${building.id}`}
              style={{ animationDelay: `${i * 40}ms` }}
              className="animate-fade-up group overflow-hidden rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-40 w-full overflow-hidden">
                {building.facade_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={building.facade_url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  // Atlas-gradient placeholder with a simple tower mark.
                  <div className="hero-gradient flex h-full w-full items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.2"
                      className="h-14 w-14 opacity-80"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                    </svg>
                  </div>
                )}
                {building.floors_count != null && (
                  <span className="absolute right-2 top-2 rounded-full bg-black/45 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                    {building.floors_count} {t.buildings.floorBuilder.floorsShort}
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold text-[var(--ink-1)]">
                    {building.name}
                  </p>
                  <ConstructionStatusBadge status={building.construction_status} />
                </div>
                <p className="mt-0.5 truncate text-sm text-[var(--ink-4)]">
                  {building.address || "—"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
