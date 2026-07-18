"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { STATUS_COLORS, formatArea } from "@/lib/objects/format";
import { formatCurrency, type Currency } from "@/lib/currency";
import { computeApartmentNumbers } from "@/lib/buildings/apartmentNumbers";
import type { ObjectStatus, PropertyObject } from "@/lib/objects/types";

export type UnitContractInfo = {
  id: string;
  clientName: string;
  clientPhone: string | null;
  amount: number;
  paid: number;
  remaining: number;
  currency: Currency;
  paymentsCount: number;
  isQuickBooking: boolean;
};

const CELL = 64;
const GAP = 8;


function UnitCell({
  unit,
  apartmentNumber,
  floorUnits,
  contractInfo,
  onBookUnit,
  onQuickBook,
  onCancelQuickBook,
  isPending,
  onMergeUnits,
  canEditSold,
  readOnly,
  onViewUnit,
  statusFilter,
}: {
  unit: PropertyObject;
  apartmentNumber: number | undefined;
  floorUnits: PropertyObject[];
  contractInfo: UnitContractInfo | undefined;
  onBookUnit: (unit: PropertyObject) => void;
  onQuickBook: (unit: PropertyObject) => void;
  onCancelQuickBook: (unit: PropertyObject, contractId: string) => void;
  isPending: boolean;
  onMergeUnits: (unitA: PropertyObject, unitB: PropertyObject) => void;
  canEditSold: boolean;
  readOnly: boolean;
  onViewUnit: (unit: PropertyObject) => void;
  statusFilter: ObjectStatus | null;
}) {
  const { t } = useLocale();
  const router = useRouter();

  const span = unit.span || 1;
  const width = span * CELL + (span - 1) * GAP;
  const nextUnit = floorUnits.find(
    (u) => u.position_in_floor === (unit.position_in_floor ?? 0) + span
  );
  const canMerge = unit.status === "available" && nextUnit && nextUnit.status === "available";
  const dimmed = statusFilter !== null && unit.status !== statusFilter;

  // Left click: available -> open the full contract-drafting dialog.
  // Already booked/sold -> a client paying their installment is routine
  // front-desk work, not admin-only, so anyone jumps straight to that
  // unit's payments/receipt screen if a contract exists; only the
  // fallback (a unit marked busy with no contract at all) is gated to
  // admins, since that means editing the raw unit record.
  const handlePrimaryAction = () => {
    if (isPending) return;
    if (readOnly) {
      // Director: everything opens as a view -- the cash desk page is
      // already read-only for this role, unit cells never open write forms.
      if (contractInfo) router.push(`/contracts/${contractInfo.id}/payments`);
      else onViewUnit(unit);
      return;
    }
    if (unit.status === "available") {
      onBookUnit(unit);
    } else if (contractInfo) {
      router.push(`/contracts/${contractInfo.id}/payments`);
    } else if (unit.manual_reserved) {
      // Hand-reserved, no contract yet: the natural next step is drafting
      // the real contract for whoever the unit was held for.
      onBookUnit(unit);
    } else if (canEditSold) {
      router.push(`/objects/${unit.id}`);
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
          if (isPending || readOnly) return;
          // Right click toggles a quick booking. Decide by whether the
          // unit's contract is an untouched placeholder booking -- NOT by
          // the unit's status color: if the status-sync DB trigger is
          // missing or lagging, the cell can still read "available" while
          // its placeholder contract already exists (and vice versa), and
          // keying off status made the second right-click a silent no-op.
          if (contractInfo?.isQuickBooking) {
            onCancelQuickBook(unit, contractInfo.id);
          } else {
            // Real bookings (or no contract at all) go to the page handler,
            // which quick-books a free unit or explains why it can't.
            onQuickBook(unit);
          }
        }}
        disabled={isPending}
        style={{ width }}
        className={`flex h-14 flex-col items-center justify-center rounded-md text-[11px] font-semibold leading-tight transition-all hover:scale-105 ${
          isPending ? "animate-pulse opacity-60" : ""
        } ${dimmed ? "opacity-20 saturate-0" : ""} ${STATUS_COLORS[unit.status]}`}
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

      {/* Hover card: everything the front desk asks about a unit at a
          glance -- price, how much is paid (with a progress bar), what's
          left, who the buyer is and their phone. */}
      <div className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-xl group-hover:visible">
        <div className="flex items-start justify-between gap-2 px-3.5 pb-1.5 pt-3">
          <div>
            <p className="text-[15px] font-bold leading-tight text-slate-900">
              {apartmentNumber != null ? `№${apartmentNumber}` : unit.name}
            </p>
            <p className="mt-0.5 text-[10.5px] text-slate-500">
              {[
                unit.floor != null ? `${unit.floor} ${t.buildings.hover.floorShort}` : null,
                unit.block,
                unit.rooms != null ? `${unit.rooms} ${t.buildings.hover.roomsShort}` : null,
                unit.area != null ? formatArea(unit.area) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[unit.status]}`}
          >
            {t.objects.statuses[unit.status]}
          </span>
        </div>

        <div className="flex items-baseline justify-between border-t border-slate-100 px-3.5 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t.buildings.hover.price}
          </span>
          <span className="text-[13px] font-bold text-slate-900">
            {formatCurrency(unit.price, unit.currency)}
          </span>
        </div>

        {contractInfo && (
          <div className="border-t border-slate-100 px-3.5 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t.buildings.hover.paid}
              </span>
              <span className="text-[13px] font-bold text-emerald-600">
                {formatCurrency(contractInfo.paid, contractInfo.currency)}
              </span>
            </div>
            {contractInfo.amount > 0 && (
              <>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    style={{
                      width: `${Math.min(100, Math.round((contractInfo.paid / contractInfo.amount) * 100))}%`,
                    }}
                  />
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-[10px] text-slate-400">
                    {Math.min(100, Math.round((contractInfo.paid / contractInfo.amount) * 100))}%
                  </span>
                  {contractInfo.remaining > 0 && (
                    <span className="text-[11px] font-semibold text-rose-600">
                      −{formatCurrency(contractInfo.remaining, contractInfo.currency)}
                    </span>
                  )}
                </div>
              </>
            )}
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t.buildings.hover.owner}
              </span>
              <span className="truncate font-semibold text-slate-800">
                {contractInfo.clientName}
              </span>
            </div>
            {contractInfo.clientPhone && (
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {t.buildings.hover.phone}
                </span>
                <span className="text-slate-700">{contractInfo.clientPhone}</span>
              </div>
            )}
          </div>
        )}

        {!contractInfo && unit.manual_reserved && (
          <div className="border-t border-slate-100 px-3.5 py-1.5">
            <p className="flex justify-between text-slate-500">
              <span>{t.buildings.hover.owner}</span>
              <span className="text-slate-700">{t.buildings.hover.reservedNoClient}</span>
            </p>
          </div>
        )}

        {!readOnly && (
          <p className="border-t border-slate-100 bg-slate-50 px-3.5 py-1.5 text-center text-[10px] text-slate-400">
            {unit.status === "available"
              ? t.buildings.hover.clickHint
              : contractInfo
                ? contractInfo.isQuickBooking
                  ? t.buildings.hover.clickHintQuickBooked
                  : t.buildings.hover.clickHintBooked
                : unit.manual_reserved
                  ? t.buildings.hover.clickHintQuickBooked
                  : t.buildings.hover.clickHint}
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
  onCancelQuickBook,
  onAddUnit,
  pendingUnitIds,
  onMergeUnits,
  canEditSold,
  readOnly = false,
  onViewUnit,
}: {
  units: PropertyObject[];
  contractsByUnit: Record<string, UnitContractInfo>;
  onBookUnit: (unit: PropertyObject) => void;
  onQuickBook: (unit: PropertyObject) => void;
  onCancelQuickBook: (unit: PropertyObject, contractId: string) => void;
  onAddUnit: (floor: number, block: string, position: number) => void;
  pendingUnitIds: Set<string>;
  onMergeUnits: (unitA: PropertyObject, unitB: PropertyObject) => void;
  canEditSold: boolean;
  readOnly?: boolean;
  onViewUnit: (unit: PropertyObject) => void;
}) {
  const { t } = useLocale();
  const [statusFilter, setStatusFilter] = useState<ObjectStatus | null>(null);

  if (units.length === 0) {
    return <p className="text-slate-400">{t.buildings.noUnits}</p>;
  }

  // The three statuses core to selling units are always in the legend, so
  // it never looks like "Продано" or "Забронировано" quietly disappeared
  // just because nothing currently has that status. Only the two rarer,
  // non-sales statuses ("rented"/"in_progress") are hidden when unused.
  const CORE_STATUSES: ObjectStatus[] = ["available", "reserved", "sold"];
  const presentStatuses = (
    Object.keys(t.buildings.legend) as Array<keyof typeof t.buildings.legend>
  ).filter(
    (status) => CORE_STATUSES.includes(status) || units.some((u) => u.status === status)
  );

  const blocks = Array.from(new Set(units.map((u) => u.block ?? ""))).sort();
  const hasBlocks = blocks.length > 1 || blocks[0] !== "";
  const floors = Array.from(new Set(units.map((u) => u.floor ?? 0))).sort((a, b) => b - a);
  const apartmentNumbers = computeApartmentNumbers(units);

  // Deleting a unit leaves a hole at its position that the grid used to
  // just silently close up around -- nothing suggested a slot ever existed
  // there or offered a way back. Pad each floor's row out to the widest
  // position any floor in this block actually reaches, and render a ghost
  // "+" cell at every gap so restoring (or adding) a specific unit is one
  // click on the exact slot it belongs in.
  const maxPositionByBlock = new Map<string, number>();
  for (const block of blocks) {
    const rightEdges = units
      .filter((u) => (u.block ?? "") === block)
      .map((u) => (u.position_in_floor ?? 0) + (u.span || 1) - 1);
    maxPositionByBlock.set(block, rightEdges.length > 0 ? Math.max(...rightEdges) : 0);
  }

  type Slot = { kind: "unit"; unit: PropertyObject } | { kind: "ghost"; position: number };
  function floorSlots(block: string, floor: number, cellUnits: PropertyObject[]): Slot[] {
    const maxPosition = maxPositionByBlock.get(block) ?? 0;
    const slots: Slot[] = [];
    let p = 1;
    while (p <= maxPosition) {
      const unit = cellUnits.find((u) => (u.position_in_floor ?? 0) === p);
      if (unit) {
        slots.push({ kind: "unit", unit });
        p += unit.span || 1;
      } else {
        slots.push({ kind: "ghost", position: p });
        p += 1;
      }
    }
    return slots;
  }

  // Header labels and each floor's cell group live in separate flex rows, so
  // without a shared width per block column their gaps drift out of sync --
  // pin every block to the widest row it needs so columns stay aligned.
  const blockWidths = new Map<string, number>();
  for (const block of blocks) {
    const slotCount = maxPositionByBlock.get(block) ?? 0;
    blockWidths.set(block, slotCount * CELL + Math.max(0, slotCount - 1) * GAP);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {presentStatuses.map((status) => {
          const active = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === status ? null : status))}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-transparent text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status].split(" ")[0]}`}
              />
              {t.buildings.legend[status]}
            </button>
          );
        })}
        {statusFilter && (
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            × {t.buildings.clearFilter}
          </button>
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
                  const slots = floorSlots(block, floor, cellUnits);
                  return (
                    <div
                      key={block}
                      style={{ width: blockWidths.get(block) }}
                      className="flex shrink-0 flex-nowrap gap-2"
                    >
                      {slots.map((slot) =>
                        slot.kind === "unit" ? (
                          <UnitCell
                            key={slot.unit.id}
                            unit={slot.unit}
                            apartmentNumber={apartmentNumbers.get(slot.unit.id)}
                            floorUnits={cellUnits}
                            contractInfo={contractsByUnit[slot.unit.id]}
                            onBookUnit={onBookUnit}
                            onQuickBook={onQuickBook}
                            onCancelQuickBook={onCancelQuickBook}
                            isPending={pendingUnitIds.has(slot.unit.id)}
                            onMergeUnits={onMergeUnits}
                            canEditSold={canEditSold}
                            readOnly={readOnly}
                            onViewUnit={onViewUnit}
                            statusFilter={statusFilter}
                          />
                        ) : canEditSold ? (
                          <button
                            key={`ghost-${block}-${floor}-${slot.position}`}
                            type="button"
                            title={t.buildings.addUnitHere}
                            onClick={() => onAddUnit(floor, block, slot.position)}
                            className="flex h-14 w-16 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-slate-200 text-slate-300 transition-all hover:border-slate-400 hover:bg-slate-50 hover:text-slate-500 active:scale-95"
                          >
                            +
                          </button>
                        ) : (
                          <div
                            key={`ghost-${block}-${floor}-${slot.position}`}
                            className="h-14 w-16 shrink-0 rounded-md border-2 border-dashed border-slate-100"
                          />
                        )
                      )}
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
