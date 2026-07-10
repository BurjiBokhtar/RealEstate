"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { STATUS_COLORS, formatArea } from "@/lib/objects/format";
import { formatCurrency, type Currency } from "@/lib/currency";
import type { PropertyObject } from "@/lib/objects/types";

export type UnitContractInfo = {
  clientName: string;
  remaining: number;
  currency: Currency;
};

const CELL = 64;
const GAP = 8;

function FloorRow({
  floor,
  floorUnits,
  contractsByUnit,
  onBookUnit,
  onMergeUnits,
  canEditSold,
  onViewUnit,
}: {
  floor: number;
  floorUnits: PropertyObject[];
  contractsByUnit: Record<string, UnitContractInfo>;
  onBookUnit: (unit: PropertyObject) => void;
  onMergeUnits: (unitA: PropertyObject, unitB: PropertyObject) => void;
  canEditSold: boolean;
  onViewUnit: (unit: PropertyObject) => void;
}) {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
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
            unit.status === "available" && nextUnit && nextUnit.status === "available";

          return (
            <div key={unit.id} className="group relative" style={{ width }}>
              <button
                type="button"
                onClick={() => {
                  if (unit.status === "available") {
                    onBookUnit(unit);
                  } else if (canEditSold) {
                    router.push(`/objects/${unit.id}`);
                  } else {
                    onViewUnit(unit);
                  }
                }}
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
                    {formatCurrency(unit.price, unit.currency)}
                  </span>
                </p>
                {contractInfo && (
                  <>
                    <p className="flex justify-between text-slate-500">
                      <span>{t.buildings.hover.owner}</span>
                      <span className="text-slate-700">{contractInfo.clientName}</span>
                    </p>
                    <p className="flex justify-between text-slate-500">
                      <span>{t.buildings.hover.remaining}</span>
                      <span className="text-slate-700">
                        {formatCurrency(contractInfo.remaining, contractInfo.currency)}
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
}

export function ShakhmatkaGrid({
  units,
  contractsByUnit,
  onBookUnit,
  onMergeUnits,
  canEditSold,
  onViewUnit,
}: {
  units: PropertyObject[];
  contractsByUnit: Record<string, UnitContractInfo>;
  onBookUnit: (unit: PropertyObject) => void;
  onMergeUnits: (unitA: PropertyObject, unitB: PropertyObject) => void;
  canEditSold: boolean;
  onViewUnit: (unit: PropertyObject) => void;
}) {
  const { t } = useLocale();

  if (units.length === 0) {
    return <p className="text-slate-400">{t.buildings.noUnits}</p>;
  }

  const blocks = Array.from(new Set(units.map((u) => u.block ?? ""))).sort();
  const hasBlocks = blocks.length > 1 || blocks[0] !== "";

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

      <div className="flex flex-col gap-6">
        {blocks.map((block) => {
          const blockUnits = units.filter((u) => (u.block ?? "") === block);
          const floors = Array.from(new Set(blockUnits.map((u) => u.floor ?? 0))).sort(
            (a, b) => b - a
          );
          return (
            <div key={block} className="flex flex-col gap-2">
              {hasBlocks && (
                <p className="text-sm font-semibold text-slate-700">
                  {block || t.buildings.noBlock}
                </p>
              )}
              {floors.map((floor) => (
                <FloorRow
                  key={floor}
                  floor={floor}
                  floorUnits={blockUnits
                    .filter((u) => (u.floor ?? 0) === floor)
                    .sort((a, b) => (a.position_in_floor ?? 0) - (b.position_in_floor ?? 0))}
                  contractsByUnit={contractsByUnit}
                  onBookUnit={onBookUnit}
                  onMergeUnits={onMergeUnits}
                  canEditSold={canEditSold}
                  onViewUnit={onViewUnit}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
