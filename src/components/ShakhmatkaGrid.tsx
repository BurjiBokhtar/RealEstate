"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { STATUS_COLORS, formatArea } from "@/lib/objects/format";
import { formatCurrency, type Currency } from "@/lib/currency";
import type { PropertyObject } from "@/lib/objects/types";

export type UnitContractInfo = {
  id: string;
  clientName: string;
  remaining: number;
  currency: Currency;
};

const CELL = 64;
const GAP = 8;

// Apartment numbers run sequentially through the whole entrance, floor by
// floor from the ground up (floor 1 ends on 7, floor 2 starts on 8, ...) --
// not the per-floor position index and not the floor-position pair encoded
// in the unit's name. Each block/entrance numbers its own units starting
// from 1, since that's how real shakhmatki are numbered.
function computeApartmentNumbers(units: PropertyObject[]): Map<string, number> {
  const numbers = new Map<string, number>();
  const blocks = Array.from(new Set(units.map((u) => u.block ?? "")));
  for (const block of blocks) {
    const blockUnits = units
      .filter((u) => (u.block ?? "") === block)
      .sort((a, b) => {
        const floorDiff = (a.floor ?? 0) - (b.floor ?? 0);
        if (floorDiff !== 0) return floorDiff;
        return (a.position_in_floor ?? 0) - (b.position_in_floor ?? 0);
      });
    blockUnits.forEach((u, i) => numbers.set(u.id, i + 1));
  }
  return numbers;
}

function UnitCell({
  unit,
  apartmentNumber,
  floorUnits,
  contractInfo,
  onBookUnit,
  onQuickBook,
  onMergeUnits,
  canEditSold,
  onViewUnit,
}: {
  unit: PropertyObject;
  apartmentNumber: number | undefined;
  floorUnits: PropertyObject[];
  contractInfo: UnitContractInfo | undefined;
  onBookUnit: (unit: PropertyObject) => void;
  onQuickBook: (unit: PropertyObject) => void;
  onMergeUnits: (unitA: PropertyObject, unitB: PropertyObject) => void;
  canEditSold: boolean;
  onViewUnit: (unit: PropertyObject) => void;
}) {
  const { t } = useLocale();
  const router = useRouter();

  const span = unit.span || 1;
  const width = span * CELL + (span - 1) * GAP;
  const nextUnit = floorUnits.find(
    (u) => u.position_in_floor === (unit.position_in_floor ?? 0) + span
  );
  const canMerge = unit.status === "available" && nextUnit && nextUnit.status === "available";

  // Left click: available -> open the full contract-drafting dialog; already
  // booked/sold -> jump straight to that unit's contract (so staff can see
  // the buyer and finish paperwork) if one exists, otherwise fall back to
  // editing the unit itself.
  const handlePrimaryAction = () => {
    if (unit.status === "available") {
      onBookUnit(unit);
    } else if (canEditSold) {
      if (contractInfo) {
        router.push(`/contracts/${contractInfo.id}`);
      } else {
        router.push(`/objects/${unit.id}`);
      }
    } else {
      onViewUnit(unit);
    }
  };

  return (
    <div className="group relative shrink-0" style={{ width }}>
      <button
        type="button"
        onClick={handlePrimaryAction}
        onContextMenu={(e) => {
          e.preventDefault();
          // Right click: instantly reserve an available unit, no dialog.
          if (unit.status === "available") onQuickBook(unit);
        }}
        style={{ width }}
        className={`flex h-14 flex-col items-center justify-center rounded-md text-[11px] font-semibold leading-tight transition-transform hover:scale-105 ${STATUS_COLORS[unit.status]}`}
      >
        <span>{apartmentNumber ?? "—"}</span>
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
        <p className="mb-1 font-semibold text-slate-900">
          {apartmentNumber != null ? `№${apartmentNumber} · ${unit.name}` : unit.name}
        </p>
        {unit.rooms != null && (
          <p className="flex justify-between text-slate-500">
            <span>{t.buildings.hover.rooms}</span>
            <span className="text-slate-700">{unit.rooms}</span>
          </p>
        )}
        <p className="flex justify-between text-slate-500">
          <span>{t.buildings.hover.area}</span>
          <span className="text-slate-700">{formatArea(unit.area)}</span>
        </p>
        <p className="flex justify-between text-slate-500">
          <span>{t.buildings.hover.price}</span>
          <span className="text-slate-700">{formatCurrency(unit.price, unit.currency)}</span>
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
        {unit.status === "available" && (
          <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
            {t.buildings.hover.clickHint}
          </p>
        )}
      </div>
    </div>
  );
}

export function ShakhmatkaGrid({
  units,
  contractsByUnit,
  onBookUnit,
  onQuickBook,
  onMergeUnits,
  canEditSold,
  onViewUnit,
}: {
  units: PropertyObject[];
  contractsByUnit: Record<string, UnitContractInfo>;
  onBookUnit: (unit: PropertyObject) => void;
  onQuickBook: (unit: PropertyObject) => void;
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
  const floors = Array.from(new Set(units.map((u) => u.floor ?? 0))).sort((a, b) => b - a);
  const apartmentNumbers = computeApartmentNumbers(units);

  // Header labels and each floor's cell group live in separate flex rows, so
  // without a shared width per block column their gaps drift out of sync --
  // pin every block to the widest row it needs so columns stay aligned.
  const blockWidths = new Map<string, number>();
  for (const block of blocks) {
    let widest = CELL;
    for (const floor of floors) {
      const cellUnits = units.filter((u) => (u.block ?? "") === block && (u.floor ?? 0) === floor);
      const width = cellUnits.reduce((sum, u) => sum + (u.span || 1) * CELL, 0) +
        Math.max(0, cellUnits.length - 1) * GAP;
      widest = Math.max(widest, width);
    }
    blockWidths.set(block, widest);
  }

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

      {/* Blocks/entrances sit side by side as columns sharing the same floor
          rows, rather than stacked one under another -- lets you compare
          entrances at a glance the way a real shakhmatka is read. */}
      <div className="overflow-x-auto">
        <div className="flex w-fit flex-col gap-2">
          {hasBlocks && (
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0" />
              <div className="flex gap-6">
                {blocks.map((block) => (
                  <p
                    key={block}
                    style={{ width: blockWidths.get(block) }}
                    className="shrink-0 text-sm font-semibold text-slate-700"
                  >
                    {block || t.buildings.noBlock}
                  </p>
                ))}
              </div>
            </div>
          )}

          {floors.map((floor) => (
            <div key={floor} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-medium text-slate-500">
                {t.buildings.floorLabel} {floor}
              </span>
              <div className="flex gap-6">
                {blocks.map((block) => {
                  const cellUnits = units
                    .filter((u) => (u.block ?? "") === block && (u.floor ?? 0) === floor)
                    .sort((a, b) => (a.position_in_floor ?? 0) - (b.position_in_floor ?? 0));
                  return (
                    <div
                      key={block}
                      style={{ width: blockWidths.get(block) }}
                      className="flex shrink-0 flex-nowrap gap-2"
                    >
                      {cellUnits.map((unit) => (
                        <UnitCell
                          key={unit.id}
                          unit={unit}
                          apartmentNumber={apartmentNumbers.get(unit.id)}
                          floorUnits={cellUnits}
                          contractInfo={contractsByUnit[unit.id]}
                          onBookUnit={onBookUnit}
                          onQuickBook={onQuickBook}
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
          ))}
        </div>
      </div>
    </div>
  );
}
