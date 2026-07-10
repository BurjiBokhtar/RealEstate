"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { STATUS_COLORS } from "@/lib/objects/format";
import { formatDualCurrency } from "@/lib/currency";
import { useSettings } from "@/lib/settings/SettingsProvider";
import type { PropertyObject } from "@/lib/objects/types";

export function ShakhmatkaGrid({ units }: { units: PropertyObject[] }) {
  const { t } = useLocale();
  const { settings } = useSettings();

  if (units.length === 0) {
    return <p className="text-slate-400">{t.buildings.noUnits}</p>;
  }

  const floors = Array.from(new Set(units.map((u) => u.floor ?? 0))).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(t.buildings.legend) as Array<keyof typeof t.buildings.legend>).map(
          (status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${STATUS_COLORS[status].split(" ")[0]}`} />
              {t.buildings.legend[status]}
            </span>
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        {floors.map((floor) => {
          const floorUnits = units
            .filter((u) => (u.floor ?? 0) === floor)
            .sort((a, b) => (a.position_in_floor ?? 0) - (b.position_in_floor ?? 0));
          return (
            <div key={floor} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-medium text-slate-500">
                {t.buildings.floorLabel} {floor}
              </span>
              <div className="flex flex-wrap gap-2">
                {floorUnits.map((unit) => (
                  <Link
                    key={unit.id}
                    href={`/objects/${unit.id}`}
                    title={`${unit.name} · ${formatDualCurrency(unit.price, settings.usd_rate)}`}
                    className={`flex h-14 w-16 flex-col items-center justify-center rounded-md text-xs font-medium transition-transform hover:scale-105 ${STATUS_COLORS[unit.status]}`}
                  >
                    <span>{unit.position_in_floor}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
