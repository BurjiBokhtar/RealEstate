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
      <h1 className="text-2xl font-semibold">{t.buildings.title}</h1>

      {!configured && <SetupNotice />}

      {loading ? (
        <p className="text-slate-400">{t.common.loading}</p>
      ) : buildings.length === 0 ? (
        <p className="text-slate-400">{t.buildings.empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {buildings.map((building, i) => (
            <Link
              key={building.id}
              href={`/buildings/${building.id}`}
              style={{ animationDelay: `${i * 40}ms` }}
              className="animate-fade-up group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
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
                  <p className="truncate text-[15px] font-semibold text-slate-900">
                    {building.name}
                  </p>
                  <ConstructionStatusBadge status={building.construction_status} />
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-500">
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
