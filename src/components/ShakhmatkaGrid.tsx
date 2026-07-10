"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { STATUS_COLORS, formatArea } from "@/lib/objects/format";
import { formatDualCurrency } from "@/lib/currency";
import { useSettings } from "@/lib/settings/SettingsProvider";
import type { PropertyObject } from "@/lib/objects/types";

export type UnitContractInfo = {
  clientName: string;
  remaining: number;
};

const CELL = 64;
const GAP = 8;

export function ShakhmatkaGrid({
  units,
  contractsByUnit,
  onBookUnit,
  onMergeUnits,
}: {
  units: PropertyObject[];
  contractsByUnit: Record<string, UnitContractInfo>;
  onBookUnit: (unit: PropertyObject) => void;
  onMergeUnits: (unitA: PropertyObject, unitB: PropertyObject) => void;
}) {
  const { t } = useLocale();
  const { settings } = useSettings();
  const router = useRouter();

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
                {floorUnits.map((unit) => {
                  const span = unit.span || 1;
                  const width = span * CELL + (span - 1) * GAP;
                  const contractInfo = contractsByUnit[unit.id];
                  const nextUnit = floorUnits.find(
                    (u) => u.position_in_floor === (unit.position_in_floor ?? 0) + span
                  );
                  const canMerge =
                    unit.status === "available" &&
                    nextUnit &&
                    nextUnit.status === "available";

                  return (
                    <div key={unit.id} className="group relative" style={{ width }}>
                      <button
                        type="button"
                        onClick={() =>
                          unit.status === "available"
                            ? onBookUnit(unit)
                            : router.push(`/objects/${unit.id}`)
                        }
                        style={{ width }}
                        className={`flex h-14 flex-col items-center justify-center rounded-md text-xs font-medium transition-transform hover:scale-105 ${STATUS_COLORS[unit.status]}`}
                      >
                        <span>{unit.position_in_floor}</span>
                      </button>

                      {canMerge && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMergeUnits(unit, nextUnit);
                          }}
                          title={t.buildings.merge}
                          className="absolute -right-2 top-1/2 z-20 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900 text-xs text-white group-hover:flex"
                        >
                          +
                        </button>
                      )}

                      <div className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 w-52 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-3 text-xs shadow-lg group-hover:visible">
                        <p className="mb-1 font-semibold text-slate-900">{unit.name}</p>
                        <p className="flex justify-between text-slate-500">
                          <span>{t.buildings.hover.area}</span>
                          <span className="text-slate-700">{formatArea(unit.area)}</span>
                        </p>
                        <p className="flex justify-between text-slate-500">
                          <span>{t.buildings.hover.price}</span>
                          <span className="text-slate-700">
                            {formatDualCurrency(unit.price, settings.usd_rate)}
                          </span>
                        </p>
                        {contractInfo && (
                          <>
                            <p className="flex justify-between text-slate-500">
                              <span>{t.buildings.hover.owner}</span>
                              <span className="text-slate-700">
                                {contractInfo.clientName}
                              </span>
                            </p>
                            <p className="flex justify-between text-slate-500">
                              <span>{t.buildings.hover.remaining}</span>
                              <span className="text-slate-700">
                                {formatDualCurrency(contractInfo.remaining, settings.usd_rate)}
                              </span>
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
