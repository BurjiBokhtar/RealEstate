"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { justWentBack } from "@/lib/useScrollMemory";
import { setCellMetric, useCellMetric, type CellMetric } from "@/lib/useCellMetric";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CELL_COLORS, STATUS_COLORS, STATUS_PROGRESS_COLORS, formatArea, formatAreaValue } from "@/lib/objects/format";
import { STATUS_HUES } from "@/components/charts/palette";
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

// A cell is a CELL-pixel square (48px; h-12 is the same 48px): the flat number in a regular
// (thin) weight, and -- only when the bar above the grid asks for it (see useCellMetric) --
// one small value under it, the rooms ("2к") or the real area ("54,3", never rounded);
// everything else is in the hover card. One value at a time keeps the cells calm, and about
// six fit a phone.
// Every width below -- merged cells, entrance columns, the empty "+" slots -- is derived
// from CELL and GAP, so changing them moves everything together.
const CELL = 48;
const GAP = 4;
// Shops, offices and parking bays are drawn calmer and roomier than flats: a wider, slightly
// taller cell with the real area under the number, and twice the gap between neighbours.
// A flat is read by its number; a shop by its size -- and with no ring, they no longer shout.
const CALM_W = 64;
const CALM_H = 52;
const CALM_GAP = 8;
// The strip of floor numbers that stays pinned at the left while the grid scrolls sideways.
const FLOOR_STRIP = "w-7";

// Apartments and houses are the "main" shakhmatka. Everything else (shops,
// offices, parking, land, construction) is non-residential and is drawn as a
// second zone below the flats -- same entrance columns, its own floor rows --
// so a basement full of parking bays, or a strip of shops, can never stretch
// the apartment rows or shove entrances apart.
const RESIDENTIAL_TYPES = new Set(["apartment", "house"]);
function isResidential(u: PropertyObject): boolean {
  return RESIDENTIAL_TYPES.has(u.type ?? "apartment");
}

// Non-residential units are told apart from flats by a purpose prefix on the number -- a
// ground-floor shop reads "М1", a parking bay "П1", an office "О1", never confused with
// apartment "1" -- and by sitting in their own zone with their own, calmer cell (see CALM_*).
// There used to be a thick coloured ring on top of that; it made the shops look coarse.
const TYPE_PREFIX: Record<string, string> = {
  commercial: "М",
  office: "О",
  parking: "П",
  land: "З",
  construction_site: "С",
};

// The width of one cell: a flat is CELL wide per slot it spans, a shop/office/bay CALM_W.
function cellWidth(span: number, calm: boolean): number {
  return calm ? span * CALM_W + (span - 1) * CALM_GAP : span * CELL + (span - 1) * GAP;
}


// A flat that cannot be sold as it stands. These are the ones the dashboard
// reports as "без цены — в сумму не вошли": the potential is a sum of stored
// prices, so a flat with no price adds nothing to it, and a flat with no area
// can never be given one -- площадь × ставка has nothing to multiply. Sold
// flats are excluded: their price is settled and not part of any potential.
export type GapFilter = "no_price" | "no_area" | null;

// The filters survive leaving the building and coming back (to a contract, a client,
// the cash desk and "back"): kept per building for the length of the tab. A stored
// value that no longer makes sense is ignored rather than trusted.
type SavedFilters = { status: ObjectStatus | null; rooms: number | null; gap: GapFilter };
const NO_FILTERS: SavedFilters = { status: null, rooms: null, gap: null };
const STATUSES: ObjectStatus[] = ["available", "reserved", "sold", "rented", "in_progress"];

export function loadFilters(buildingId: string): SavedFilters {
  if (typeof window === "undefined") return NO_FILTERS;
  try {
    const raw = window.sessionStorage.getItem(`shakhmatka-filters:${buildingId}`);
    if (!raw) return NO_FILTERS;
    const v = JSON.parse(raw) as Partial<SavedFilters>;
    return {
      status: STATUSES.includes(v.status as ObjectStatus) ? (v.status as ObjectStatus) : null,
      rooms: typeof v.rooms === "number" ? v.rooms : null,
      gap: v.gap === "no_price" || v.gap === "no_area" ? v.gap : null,
    };
  } catch {
    return NO_FILTERS;
  }
}

export function saveFilters(buildingId: string, filters: SavedFilters) {
  try {
    window.sessionStorage.setItem(`shakhmatka-filters:${buildingId}`, JSON.stringify(filters));
  } catch {
    // storage blocked -- the filters just are not remembered
  }
}

export function hasGap(unit: PropertyObject, gap: Exclude<GapFilter, null>): boolean {
  if (unit.status === "sold") return false;
  if (gap === "no_area") return !(unit.area != null && unit.area > 0);
  return !(unit.price != null && unit.price > 0);
}

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
  onSplitUnit,
  onDeleteUnit,
  canEditSold,
  readOnly,
  onViewUnit,
  statusFilter,
  roomsFilter,
  gapFilter,
  editMode,
  openUpward = false,
  calm = false,
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
  onSplitUnit: (unit: PropertyObject) => void;
  onDeleteUnit: (unit: PropertyObject) => void;
  canEditSold: boolean;
  readOnly: boolean;
  onViewUnit: (unit: PropertyObject) => void;
  statusFilter: ObjectStatus | null;
  roomsFilter: number | null;
  gapFilter: GapFilter;
  editMode: boolean;
  // Near the bottom of the grid there aren't enough rows left below for the
  // hover card to open into -- it used to be kept clear of the container's
  // bottom edge with a permanent ~288px of blank padding under the whole
  // grid instead, which read as a big dead gap even when nobody was
  // hovering anything. Opening upward for the last few rows means that
  // padding is no longer load-bearing and can shrink back down to nothing.
  openUpward?: boolean;
  // Shops, offices, parking: the roomier cell with the area always shown (see CALM_*).
  calm?: boolean;
}) {
  // What goes next to the flat number: nothing, the rooms or the area (the bar above).
  const metric = useCellMetric();
  const { t } = useLocale();
  const router = useRouter();
  // Where "back" should return to. Opening a sold flat lands on the buyer's
  // card, which otherwise offers "back to the client list" -- a place the
  // user was never at. Carrying the origin through keeps the way out
  // pointing at the shakhmatka they came from.
  const pathname = usePathname();
  const cashDesk = (contractId: string) =>
    `/contracts/${contractId}/payments?from=${encodeURIComponent(pathname)}`;

  const span = unit.span || 1;
  const width = cellWidth(span, calm);
  const nextUnit = floorUnits.find(
    (u) => u.position_in_floor === (unit.position_in_floor ?? 0) + span
  );
  // Merging is a structural edit -- admins only (canEditSold gates that).
  const canMerge =
    canEditSold && unit.status === "available" && nextUnit && nextUnit.status === "available";
  // Both filters narrow together, and a cell that fails either one is
  // dimmed rather than removed: dropping cells would collapse the floors and
  // the grid would stop being a shakhmatka -- the point of it is that every
  // flat keeps its place whether or not it matches what you asked for.
  const dimmed =
    (statusFilter !== null && unit.status !== statusFilter) ||
    (roomsFilter !== null && unit.rooms !== roomsFilter) ||
    (gapFilter !== null && !hasGap(unit, gapFilter));
  const prefix = TYPE_PREFIX[unit.type ?? "apartment"];

  // Payment standing of this cell. Only meaningful where there IS a contract:
  // a free flat owes nothing and must not look like a fully paid one.
  // `settled` uses remaining rather than a percentage so a few cents of
  // rounding on the last installment still counts as done.
  const payProgress =
    contractInfo && contractInfo.amount > 0
      ? {
          pct: Math.max(0, Math.min(100, (contractInfo.paid / contractInfo.amount) * 100)),
          settled: contractInfo.remaining <= 0.005,
        }
      : null;

  // Left click: available -> open the full contract-drafting dialog.
  // Already booked/sold -> a client paying their installment is routine
  // front-desk work, not admin-only, so anyone jumps straight to that
  // unit's payments/receipt screen if a contract exists; only the
  // fallback (a unit marked busy with no contract at all) is gated to
  // admins, since that means editing the raw unit record.
  const handlePrimaryAction = () => {
    if (isPending) return;
    // Edit mode: any cell opens its editor (rooms/area/price), never books.
    if (editMode) {
      onViewUnit(unit);
      return;
    }
    if (readOnly) {
      // Director: everything opens as a view -- the cash desk page is
      // already read-only for this role, unit cells never open write forms.
      if (contractInfo) router.push(cashDesk(contractInfo.id));
      else onViewUnit(unit);
      return;
    }
    if (unit.status === "available") {
      onBookUnit(unit);
    } else if (contractInfo) {
      router.push(cashDesk(contractInfo.id));
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
        style={calm ? { width, height: CALM_H } : { width }}
        className={`relative flex flex-col items-center justify-center overflow-hidden text-[11px] font-normal leading-tight transition-all hover:scale-105 hover:ring-2 hover:ring-offset-1 hover:ring-[color-mix(in_srgb,var(--brand)_45%,transparent)] ${
          calm ? "gap-1 rounded-xl" : "h-12 gap-0.5 rounded-lg"
        } ${isPending ? "animate-pulse opacity-60" : ""} ${
          dimmed ? "opacity-20 saturate-0" : ""
        } ${CELL_COLORS[unit.status]}`}
      >
        {/* The number, not too big and not bold; the chosen value sits under it, small and
            quiet so it never competes. A flat with no rooms or no area simply shows
            nothing there. A shop, office or bay always shows its area: that is what tells
            one of them from the next, and there is room for it. */}
        <span className="text-[14px] font-normal leading-none">
          {prefix}
          {apartmentNumber ?? "—"}
        </span>
        {!calm && metric === "rooms" && unit.rooms != null && unit.rooms > 0 && (
          <span className="text-[11px] font-normal leading-none opacity-80">
            {unit.rooms}
            {t.buildings.roomsFilterShort.charAt(0)}
          </span>
        )}
        {(calm || metric === "area") && unit.area != null && unit.area > 0 && (
          <span className="text-[11px] font-normal leading-none opacity-80">
            {formatAreaValue(unit.area)}
            {calm && <span className="ml-0.5 text-[9px]">м²</span>}
          </span>
        )}

        {/* How much of this flat is actually paid for, readable without
            hovering anything: a thin fill along the bottom edge while money is
            still owed, and a small tick once nothing is. The status colour
            alone can't say this -- "продано" is the same red whether the
            client has paid 5% or 95%.
            The fill is that cell's OWN hue, just stronger, so it reads as more
            of the cell rather than a second colour system laid on top. The
            tick stays green everywhere: "nothing left to pay" is the one
            meaning that shouldn't change shade with the status. */}
        {payProgress != null &&
          (payProgress.settled ? (
            <span
              aria-hidden="true"
              className="absolute bottom-0.5 left-1 text-emerald-600"
              title={t.buildings.hover.fullyPaid}
            >
              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5.5 5.5L20 6.5" />
              </svg>
            </span>
          ) : (
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 bottom-0 h-1 ${STATUS_PROGRESS_COLORS[unit.status].track}`}
            >
              <span
                className={`block h-full ${STATUS_PROGRESS_COLORS[unit.status].fill}`}
                style={{ width: `${payProgress.pct}%` }}
              />
            </span>
          ))}
      </button>

      {canMerge && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMergeUnits(unit, nextUnit);
          }}
          title={t.buildings.merge}
          className="absolute -right-2 top-1/2 z-20 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-xs text-white group-hover:flex"
        >
          +
        </button>
      )}

      {/* Edit-mode cell tools (admin): split a merged cell back apart, or
          delete the cell. Shown on hover so they don't clutter the grid. */}
      {editMode && canEditSold && (
        <div className="absolute -top-2 right-1 z-30 hidden gap-1 group-hover:flex">
          {(unit.span || 1) > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSplitUnit(unit);
              }}
              title={t.buildings.cellActions.split}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[11px] text-white shadow hover:bg-brand"
            >
              ⤢
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteUnit(unit);
            }}
            title={t.buildings.cellActions.delete}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white shadow hover:bg-rose-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Hover card: everything the front desk asks about a unit at a
          glance -- price, how much is paid (with a progress bar), what's
          left, who the buyer is and their phone. */}
      {/* Anchored to the cell's LEFT edge, opening rightward -- so the card
          for a leftmost cell never extends left under the sidebar (where it
          used to get clipped and "disappear"). */}
      <div
        className={`pointer-events-none invisible absolute left-0 z-40 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--border-c)] bg-[var(--surface-1)] text-xs shadow-xl group-hover:visible ${
          openUpward ? "bottom-full mb-2" : "top-full mt-2"
        }`}
      >
        <div className="flex items-start justify-between gap-2 px-3.5 pb-1.5 pt-3">
          <div>
            <p className="text-[15px] font-bold leading-tight text-[var(--ink-1)]">
              {apartmentNumber != null ? `№${apartmentNumber}` : unit.name}
            </p>
            <p className="mt-0.5 text-[10.5px] text-[var(--ink-4)]">
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

        <div className="flex items-baseline justify-between border-t border-[var(--border-c2)] px-3.5 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-5)]">
            {t.buildings.hover.price}
          </span>
          <span className="text-[13px] font-bold text-[var(--ink-1)]">
            {/* Once a contract exists, its negotiated amount IS the deal's
                real price (may differ from the catalog price via a discount
                or a hand-agreed rate) -- show that, not the listing price. */}
            {contractInfo
              ? formatCurrency(contractInfo.amount, contractInfo.currency)
              : formatCurrency(unit.price, unit.currency)}
          </span>
        </div>
        {unit.area != null && unit.area > 0 && (
          <div className="flex items-baseline justify-between px-3.5 pb-1.5">
            <span className="text-[10px] text-[var(--ink-5)]">{t.buildings.hover.pricePerSqm}</span>
            <span className="text-[11px] font-medium text-[var(--ink-3)]">
              {/* Same price the row above shows (deal amount once sold/
                  reserved, catalog price otherwise) divided by area -- what
                  the front desk actually gets asked: "за сколько ушёл метр". */}
              {formatCurrency(
                Math.round((contractInfo ? contractInfo.amount : (unit.price ?? 0)) / unit.area),
                contractInfo ? contractInfo.currency : unit.currency
              )}
            </span>
          </div>
        )}

        {contractInfo && (
          <div className="border-t border-[var(--border-c2)] px-3.5 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-5)]">
                {t.buildings.hover.paid}
              </span>
              <span className="text-[13px] font-bold text-emerald-600">
                {formatCurrency(contractInfo.paid, contractInfo.currency)}
              </span>
            </div>
            {contractInfo.amount > 0 && (
              <>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--track-c)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    style={{
                      width: `${Math.min(100, Math.round((contractInfo.paid / contractInfo.amount) * 100))}%`,
                    }}
                  />
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-[10px] text-[var(--ink-5)]">
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
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-5)]">
                {t.buildings.hover.owner}
              </span>
              <span className="truncate font-semibold text-[var(--ink-2)]">
                {contractInfo.clientName}
              </span>
            </div>
            {contractInfo.clientPhone && (
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-5)]">
                  {t.buildings.hover.phone}
                </span>
                <span className="text-[var(--ink-2)]">{contractInfo.clientPhone}</span>
              </div>
            )}
          </div>
        )}

        {!contractInfo && unit.manual_reserved && (
          <div className="border-t border-[var(--border-c2)] px-3.5 py-1.5">
            <p className="flex justify-between text-[var(--ink-4)]">
              <span>{t.buildings.hover.owner}</span>
              <span className="text-[var(--ink-2)]">{t.buildings.hover.reservedNoClient}</span>
            </p>
          </div>
        )}

        {!readOnly && (
          <p className="border-t border-[var(--border-c2)] bg-[var(--surface-2)] px-3.5 py-1.5 text-center text-[10px] text-[var(--ink-5)]">
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
  onSplitUnit,
  onDeleteUnit,
  canEditSold,
  readOnly = false,
  onViewUnit,
  statusFilter,
  roomsFilter,
  gapFilter = null,
  editMode = false,
}: {
  units: PropertyObject[];
  contractsByUnit: Record<string, UnitContractInfo>;
  onBookUnit: (unit: PropertyObject) => void;
  onQuickBook: (unit: PropertyObject) => void;
  onCancelQuickBook: (unit: PropertyObject, contractId: string) => void;
  onAddUnit: (floor: number, block: string, position: number) => void;
  pendingUnitIds: Set<string>;
  onMergeUnits: (unitA: PropertyObject, unitB: PropertyObject) => void;
  onSplitUnit: (unit: PropertyObject) => void;
  onDeleteUnit: (unit: PropertyObject) => void;
  canEditSold: boolean;
  readOnly?: boolean;
  onViewUnit: (unit: PropertyObject) => void;
  statusFilter: ObjectStatus | null;
  roomsFilter: number | null;
  gapFilter?: GapFilter;
  editMode?: boolean;
}) {
  const { t } = useLocale();

  // A wide shakhmatka scrolls sideways inside its own box. Remember how far, per
  // address, and give it back on "back" (the page's vertical position is handled
  // by useScrollMemory in the app shell).
  const pathname = usePathname();
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const hasUnits = units.length > 0;
  // A whole floor picked by tapping its number: its row is highlighted and a small
  // summary of its flats floats at the bottom of the screen.
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  useEffect(() => {
    const box = scrollBoxRef.current;
    if (!box) return;
    const key = `shakhmatka-x:${pathname}`;
    if (justWentBack()) {
      try {
        const x = Number(window.sessionStorage.getItem(key));
        if (Number.isFinite(x) && x > 0) box.scrollLeft = x;
      } catch {
        // nothing remembered
      }
    }
    const onScroll = () => {
      try {
        window.sessionStorage.setItem(key, String(Math.round(box.scrollLeft)));
      } catch {
        // storage blocked
      }
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => box.removeEventListener("scroll", onScroll);
  }, [pathname, hasUnits]);

  if (units.length === 0) {
    return <p className="text-[var(--ink-5)]">{t.buildings.noUnits}</p>;
  }

  // Split the main residential grid from everything else. The main grid's
  // blocks, floors and column widths are computed from residential units ONLY,
  // so parking/shops never widen or space out the apartment shakhmatka.
  const residentialUnits = units.filter(isResidential);
  const otherUnits = units.filter((u) => !isResidential(u));

  // Numbering still runs over ALL units, so per-type sequences (П1, М1…) stay
  // consistent whether a unit is shown in the main grid or the section below.
  const apartmentNumbers = computeApartmentNumbers(units);

  // Blocks/entrances ordered left→right by when they were first created, so
  // the first entrance you made sits leftmost and each new one appears to its
  // right -- the way a real shakhmatka grows -- instead of an alphabetical
  // order that reshuffles them.
  const gridUnits = residentialUnits.length > 0 ? residentialUnits : units;
  // Shops, offices, parking and the rest are drawn as a second zone UNDER the flats, in the
  // same entrance columns and with the same floor strip, so one look at the grid shows what
  // is where in the building: flats above, commercial floors below. They never widen or
  // renumber the flats' rows (each zone only pads a column to its own widest floor).
  const zoneUnits = residentialUnits.length > 0 ? otherUnits : [];
  const blockFirstCreated = new Map<string, string>();
  for (const u of [...gridUnits, ...zoneUnits]) {
    const b = u.block ?? "";
    const ts = u.created_at ?? "";
    const seen = blockFirstCreated.get(b);
    if (seen === undefined || ts < seen) blockFirstCreated.set(b, ts);
  }
  const blocks = Array.from(blockFirstCreated.keys()).sort((a, b) =>
    (blockFirstCreated.get(a) ?? "").localeCompare(blockFirstCreated.get(b) ?? "")
  );
  const hasBlocks = blocks.length > 1 || blocks[0] !== "";
  const floors = Array.from(new Set(gridUnits.map((u) => u.floor ?? 0))).sort((a, b) => b - a);
  const zoneFloors = Array.from(new Set(zoneUnits.map((u) => u.floor ?? 0))).sort((a, b) => b - a);

  // A building with no flats at all (only shops, offices, parking) draws those in the main
  // rows -- in the calm cell, as in the zone.
  const mainCalm = residentialUnits.length === 0;
  type Slot = { kind: "unit"; unit: PropertyObject } | { kind: "ghost"; position: number };
  function floorSlots(
    block: string,
    floor: number,
    cellUnits: PropertyObject[],
    ghosts: boolean
  ): Slot[] {
    // Pack the floor's units left-to-right in order, ignoring gaps in their
    // stored positions -- so a floor always shows exactly as many cells as it
    // has units, side by side, with no confusing empty holes. One trailing
    // "+" add-slot (unless read-only) lets you append a unit.
    const sorted = [...cellUnits].sort(
      (a, b) => (a.position_in_floor ?? 0) - (b.position_in_floor ?? 0)
    );
    const slots: Slot[] = sorted.map((unit) => ({ kind: "unit" as const, unit }));
    if (!readOnly && ghosts) {
      const last = sorted[sorted.length - 1];
      const nextPos = last ? (last.position_in_floor ?? sorted.length) + 1 : 1;
      slots.push({ kind: "ghost", position: nextPos });
    }
    return slots;
  }

  // Pin every block's column to its widest floor (units + a trailing add-slot) so entrances
  // line up cleanly and sit right next to each other. A floor is measured by the units it
  // actually has (their real cell widths), not by their stored positions: measuring by
  // position let a stray high-position unit -- left by a construction glitch -- reserve a
  // huge empty column and shove the next entrance far to the right. The flats' floors and the
  // zone's floors each count in their own cell size; the column is as wide as the widest.
  const blockWidths = new Map<string, number>();
  for (const block of blocks) {
    // A flats floor always has its trailing "+" (unless read-only), even with no units yet.
    let widest = !readOnly && gridUnits.length > 0 ? CELL : 0;
    const lists: Array<[PropertyObject[], boolean, boolean]> = [
      [gridUnits, mainCalm, !readOnly],
      [zoneUnits, true, false],
    ];
    for (const [list, calm, ghost] of lists) {
      const gap = calm ? CALM_GAP : GAP;
      const perFloor = new Map<number, { width: number; count: number }>();
      for (const u of list) {
        if ((u.block ?? "") !== block) continue;
        const f = u.floor ?? 0;
        const acc = perFloor.get(f) ?? { width: 0, count: 0 };
        acc.width += cellWidth(u.span || 1, calm);
        acc.count += 1;
        perFloor.set(f, acc);
      }
      for (const { width, count } of perFloor.values()) {
        widest = Math.max(widest, width + (count - 1) * gap + (ghost ? gap + CELL : 0));
      }
    }
    blockWidths.set(block, widest);
  }

  // The rows of the grid, top to bottom: the flats' floors, then (if there is anything but
  // flats) a divider and the commercial floors. A whole-floor pick lights up both zones.
  type FloorRow =
    | { kind: "floor"; floor: number; source: PropertyObject[]; zone: boolean; index: number }
    | { kind: "divider" };
  const floorRows: FloorRow[] = [
    ...floors.map((floor, index) => ({ kind: "floor" as const, floor, source: gridUnits, zone: false, index })),
    ...(zoneFloors.length > 0 ? [{ kind: "divider" as const }] : []),
    ...zoneFloors.map((floor, index) => ({ kind: "floor" as const, floor, source: zoneUnits, zone: true, index })),
  ];
  const rowWidth =
    blocks.reduce((sum, b) => sum + (blockWidths.get(b) ?? 0), 0) + Math.max(0, blocks.length - 1) * 12;

  // Premises on the picked floor (all entrances, flats and commercial), by status, for the
  // floating summary.
  const floorCounts = new Map<ObjectStatus, number>();
  if (selectedFloor !== null) {
    for (const u of units) {
      if ((u.floor ?? 0) === selectedFloor) {
        floorCounts.set(u.status, (floorCounts.get(u.status) ?? 0) + 1);
      }
    }
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4">

      {/* Blocks/entrances sit side by side as columns sharing the same floor
          rows, rather than stacked one under another -- lets you compare
          entrances at a glance the way a real shakhmatka is read. */}
      {/* ONE scrollbar on this page, the page's own.
          `overflow-x-auto` alone is not "horizontal only": CSS makes the other
          axis compute to `auto` as soon as one axis is not `visible`, so this
          box was also a vertical scroll container, and anything poking out of
          it -- a hover card opening downward from the bottom row -- gave it
          its own vertical scrollbar right next to the page's. Pinning
          overflow-y to hidden keeps the horizontal scrolling the grid needs
          and removes the second bar for good.
          Used to also carry a permanent pb-72 (288px) here so a bottom-row
          hover card always had room to open into -- but that meant 288px of
          plain empty space under the grid at all times, hover or not, which
          read as a big broken gap especially on a shorter tablet screen.
          Now the last few rows flip their card upward instead (see
          `openUpward` on UnitCell), so every downward-opening card always
          has real rows below it to render over, and this padding only needs
          to cover ordinary breathing room, not a worst-case card height. */}
      <div ref={scrollBoxRef} className="overflow-x-auto overflow-y-hidden">
        <div className="flex w-fit flex-col gap-1 pb-2">
          {hasBlocks && (
            <div className="flex items-center gap-1.5">
              <span className={`sticky left-0 z-20 ${FLOOR_STRIP} shrink-0 self-stretch bg-[var(--surface-0)]`} />
              <div className="flex gap-3">
                {blocks.map((block) => (
                  <p
                    key={block}
                    style={{ width: blockWidths.get(block) }}
                    className="shrink-0 text-sm font-semibold text-[var(--ink-2)]"
                  >
                    {/* Stays at the left edge (just right of the floor strip) for as
                        long as any part of its entrance is on screen. */}
                    <span className="sticky left-9 inline-block">{block || t.buildings.noBlock}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {floorRows.map((row) => {
            if (row.kind === "divider") {
              return (
                <div key="zone-divider" className="flex items-center gap-1.5 pt-3">
                  <span className={`sticky left-0 z-20 ${FLOOR_STRIP} shrink-0 self-stretch bg-[var(--surface-0)]`} />
                  <div style={{ width: rowWidth }} className="border-t border-[var(--border-c)] pt-1.5">
                    <p className="sticky left-9 inline-block text-xs font-semibold uppercase tracking-wide text-[var(--ink-4)]">
                      {t.buildings.commercialZone}
                      <span className="ml-2 font-normal normal-case tracking-normal text-[var(--ink-5)]">
                        ({zoneUnits.length})
                      </span>
                    </p>
                  </div>
                </div>
              );
            }
            const { floor, source, zone } = row;
            // The hover card is up to ~260px tall (roughly 4 rows) -- any
            // row with fewer than 4 rows left below it flips its card
            // upward instead, so it always has somewhere to render into.
            // The commercial zone is the bottom of the grid, so all of it opens upward.
            const openUpward = zone || row.index >= floors.length - 4;
            // Shops/offices/bays sit in the roomier cell: a wider gap, and more air between rows.
            const calm = zone || mainCalm;
            return (
            <div
              key={`${zone ? "z" : "m"}-${floor}`}
              className={`flex items-center gap-1.5 rounded-lg ${calm ? "py-1" : "py-0.5"} ${
                selectedFloor === floor ? "bg-[color-mix(in_srgb,var(--brand)_14%,transparent)]" : ""
              }`}
            >
              {/* Just the number, pinned to the left edge: scroll the grid sideways and
                  the floor you are reading stays with you. Tapping it picks the whole
                  floor (highlight + summary), tapping again lets go. */}
              <button
                type="button"
                onClick={() => setSelectedFloor(selectedFloor === floor ? null : floor)}
                aria-pressed={selectedFloor === floor}
                title={`${t.buildings.floorLabel} ${floor}`}
                className={`sticky left-0 z-20 ${FLOOR_STRIP} shrink-0 self-stretch rounded-md text-xs font-medium transition-colors ${
                  selectedFloor === floor
                    ? "bg-brand text-[var(--on-brand)]"
                    : "bg-[var(--surface-0)] text-[var(--ink-4)] shadow-[1px_0_0_var(--border-c)] hover:text-[var(--ink-2)]"
                }`}
              >
                {floor}
              </button>
              <div className="flex gap-3">
                {blocks.map((block) => {
                  const cellUnits = source
                    .filter((u) => (u.block ?? "") === block && (u.floor ?? 0) === floor)
                    .sort((a, b) => (a.position_in_floor ?? 0) - (b.position_in_floor ?? 0));
                  // No "+" add-slot in the commercial zone: a new cell there would be born
                  // as a flat. Commercial premises are added in the structure editor.
                  const slots = floorSlots(block, floor, cellUnits, !zone);
                  return (
                    <div
                      key={block}
                      style={{ width: blockWidths.get(block) }}
                      className={`flex shrink-0 flex-nowrap ${calm ? "gap-2" : "gap-1"}`}
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
                            onSplitUnit={onSplitUnit}
                            onDeleteUnit={onDeleteUnit}
                            canEditSold={canEditSold}
                            readOnly={readOnly}
                            onViewUnit={onViewUnit}
                            statusFilter={statusFilter}
                            roomsFilter={roomsFilter}
                            gapFilter={gapFilter}
                            editMode={editMode}
                            openUpward={openUpward}
                            calm={calm}
                          />
                        ) : canEditSold ? (
                          <button
                            key={`ghost-${block}-${floor}-${slot.position}`}
                            type="button"
                            title={t.buildings.addUnitHere}
                            onClick={() => onAddUnit(floor, block, slot.position)}
                            style={{ width: CELL }}
                            className="flex h-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-[var(--border-c)] text-[var(--ink-5)] transition-all hover:border-slate-400 hover:bg-[var(--surface-2)] hover:text-[var(--ink-4)] active:scale-95"
                          >
                            +
                          </button>
                        ) : (
                          <div
                            key={`ghost-${block}-${floor}-${slot.position}`}
                            style={{ width: CELL }}
                            className="h-12 shrink-0 rounded-lg border-2 border-dashed border-[var(--border-c2)]"
                          />
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* What is on the picked floor, floating at the bottom of the screen while the
          grid is in view (above the phone tab bar). Tapping it lets the floor go. */}
      {selectedFloor !== null && (
        <button
          type="button"
          onClick={() => setSelectedFloor(null)}
          title={`${t.buildings.floorLabel} ${selectedFloor}`}
          className="sticky bottom-20 z-30 flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 self-center rounded-full border border-[var(--border-c)] bg-[var(--surface-1)] px-3.5 py-1.5 text-xs shadow-lg sm:bottom-4"
        >
          <span className="font-semibold text-[var(--ink-2)]">
            {t.buildings.floorLabel} {selectedFloor}
          </span>
          {(Object.keys(t.buildings.legend) as Array<keyof typeof t.buildings.legend>)
            .filter((status) => floorCounts.get(status))
            .map((status) => (
              <span key={status} className="flex items-center gap-1 text-[var(--ink-4)]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: STATUS_HUES[status].solid }}
                />
                {t.buildings.legend[status]} {floorCounts.get(status)}
              </span>
            ))}
        </button>
      )}

      {/* What the bar and the tick on a cell mean. This is a reading key, not
          a control, and it used to sit in the filter row -- which made that
          row long enough to read as a wall of chips and buried the two actual
          filters in it. It belongs under the grid: you look it up after
          seeing a cell you don't recognise, not before. */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ink-5)]">
        <span className="flex items-center gap-1.5">
          {/* Shown in the "продано" hue: that is the status people are
              actually chasing a balance on, and the bar takes its colour
              from the cell it sits in. */}
          <span
            className={`flex h-2.5 w-6 overflow-hidden rounded-sm ${STATUS_PROGRESS_COLORS.sold.track}`}
          >
            <span className={`h-full w-3/5 ${STATUS_PROGRESS_COLORS.sold.fill}`} />
          </span>
          {t.buildings.hover.partlyPaid}
        </span>
        <span className="flex items-center gap-1.5">
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3 text-emerald-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5l5.5 5.5L20 6.5" />
          </svg>
          {t.buildings.hover.fullyPaid}
        </span>
      </div>
    </div>
  );
}

// The filter bar, lifted out of the grid so it sits on the line under the page header.
//
// It used to be one long strip of pills -- cell display, every status, every room count,
// the "no price / no area" keys -- that was wider than a phone and scrolled sideways inside
// its own box. Now the bar holds only what is used all the time: ONE segmented control for
// the status ("Все / Свободно / Бронь / Продано", each with its count) and a "Фильтры" button.
// The rest -- room counts, the flats with no price or no area, the rarer statuses and what
// the cells show next to the number -- lives in the panel that button opens; whatever is
// switched on there is shown back as small removable chips beside the button, so you can
// always see (and undo) what narrows the grid without opening anything.
export function ShakhmatkaFilters({
  units,
  statusFilter,
  onStatusChange,
  roomsFilter,
  onRoomsChange,
  gapFilter,
  onGapChange,
}: {
  units: PropertyObject[];
  statusFilter: ObjectStatus | null;
  onStatusChange: (next: ObjectStatus | null) => void;
  roomsFilter: number | null;
  onRoomsChange: (next: number | null) => void;
  gapFilter: GapFilter;
  onGapChange: (next: GapFilter) => void;
}) {
  const { t } = useLocale();
  const f = t.buildings.filters;
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const metric = useCellMetric();

  // Close the panel on a click anywhere else and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The three statuses core to selling are always in the bar, so it never looks like "sold"
  // quietly disappeared because nothing has that status yet. The two rarer ones (rented, in
  // progress) are offered in the panel, and only when some unit actually has them.
  const BAR_STATUSES: ObjectStatus[] = ["available", "reserved", "sold"];
  const statusCounts = new Map<ObjectStatus, number>();
  for (const u of units) statusCounts.set(u.status, (statusCounts.get(u.status) ?? 0) + 1);
  const rareStatuses = (Object.keys(t.buildings.legend) as ObjectStatus[]).filter(
    (s) => !BAR_STATUSES.includes(s) && (statusCounts.get(s) ?? 0) > 0
  );
  const barLabel = (s: ObjectStatus) => (s === "reserved" ? f.reservedShort : t.buildings.legend[s]);

  // Room counts come from the units of THIS building, not a fixed 1/2/3 list.
  const roomCounts = new Map<number, number>();
  for (const u of units) {
    if (u.rooms == null) continue;
    roomCounts.set(u.rooms, (roomCounts.get(u.rooms) ?? 0) + 1);
  }
  const presentRooms = Array.from(roomCounts.keys()).sort((a, b) => a - b);

  // The dashboard says "N без цены — в сумму не вошли" and there was nowhere to go and look at
  // them. These two appear only when such flats exist, and they separate the two very
  // different reasons: no price is fixable by re-saving the building's rate, no area is not --
  // someone has to type the area first, because the price is computed from it.
  const noPriceCount = units.filter((u) => hasGap(u, "no_price")).length;
  const noAreaCount = units.filter((u) => hasGap(u, "no_area")).length;

  const rareActive = statusFilter !== null && !BAR_STATUSES.includes(statusFilter);
  const activeCount = (roomsFilter !== null ? 1 : 0) + (gapFilter !== null ? 1 : 0) + (rareActive ? 1 : 0);
  const anyActive = statusFilter !== null || activeCount > 0;
  const resetAll = () => {
    onStatusChange(null);
    onRoomsChange(null);
    onGapChange(null);
  };

  const metricOptions: Array<{ value: CellMetric; label: string }> = [
    { value: "none", label: f.cellNumberOnly },
    { value: "rooms", label: t.buildings.hover.rooms },
    { value: "area", label: t.buildings.hover.area },
  ];

  // A small removable chip for one active filter.
  const chip = (key: string, label: string, onRemove: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onRemove}
      title={t.buildings.clearFilter}
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--wash-sky)] px-3 text-xs font-medium text-[var(--wash-sky-ink)] transition-all hover:brightness-95 active:scale-95"
    >
      {label}
      <span aria-hidden="true" className="text-sm leading-none opacity-70">
        ×
      </span>
    </button>
  );

  const optionClass = (active: boolean) =>
    `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-medium transition-all active:scale-[0.97] ${
      active
        ? "border-transparent bg-brand text-white shadow-sm"
        : "border-[var(--border-c)] bg-[var(--surface-1)] text-[var(--ink-3)] hover:bg-[var(--hover-c2)]"
    }`;

  return (
    <div ref={boxRef} className="relative flex flex-wrap items-center gap-2">
      {/* Status as one segmented control: the active segment is a raised pill, the rest are
          quiet text. On a phone it spans the row and the segments share it by their content
          (a long label is trimmed rather than pushing the row wider than the screen); from
          the sm breakpoint up it is only as wide as it needs to be. */}
      <div
        role="group"
        className="flex w-full min-w-0 items-center gap-0.5 rounded-xl bg-[var(--hover-c2)] p-0.5 sm:inline-flex sm:w-auto"
      >
        {[null, ...BAR_STATUSES].map((s) => {
          const active = statusFilter === s;
          const count = s === null ? units.length : (statusCounts.get(s) ?? 0);
          return (
            <button
              key={s ?? "all"}
              type="button"
              onClick={() => onStatusChange(s)}
              aria-pressed={active}
              className={`inline-flex h-8 min-w-0 flex-auto items-center justify-center gap-1 whitespace-nowrap rounded-[10px] px-1.5 text-xs font-medium transition-all active:scale-[0.97] sm:flex-none sm:px-3 ${
                active
                  ? "bg-[var(--surface-1)] text-[var(--ink-1)] shadow-sm"
                  : "text-[var(--ink-4)] hover:text-[var(--ink-2)]"
              }`}
            >
              {s !== null && (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: STATUS_HUES[s].solid }}
                />
              )}
              <span className="min-w-0 truncate">{s === null ? f.all : barLabel(s)}</span>
              <span className={active ? "text-[var(--ink-4)]" : "text-[var(--ink-5)]"}>{count}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-all active:scale-[0.97] ${
          open || activeCount > 0
            ? "border-[var(--brand)] text-[var(--ink-1)]"
            : "border-[var(--border-strong-c)] text-[var(--ink-3)] hover:bg-[var(--hover-c2)]"
        } bg-[var(--surface-1)]`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {f.button}
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {roomsFilter !== null &&
        chip("rooms", `${roomsFilter} ${t.buildings.roomsFilterShort}`, () => onRoomsChange(null))}
      {gapFilter !== null &&
        chip(
          "gap",
          gapFilter === "no_price" ? t.buildings.noPriceFilter : t.buildings.noAreaFilter,
          () => onGapChange(null)
        )}
      {rareActive && statusFilter !== null &&
        chip("status", t.buildings.legend[statusFilter], () => onStatusChange(null))}
      {anyActive && activeCount > 1 && (
        <button
          type="button"
          onClick={resetAll}
          className="h-8 rounded-lg px-2 text-xs font-medium text-[var(--ink-4)] transition-colors hover:text-[var(--ink-2)]"
        >
          {f.reset}
        </button>
      )}

      {open && (
        <>
          {/* On a phone the panel is a sheet above the tab bar, with the page dimmed behind it;
              from the sm breakpoint up it hangs under the button like a menu. */}
          <button
            type="button"
            aria-label={f.reset}
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
          />
          <div
            role="dialog"
            className="fixed inset-x-3 bottom-20 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-80"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--ink-1)]">{f.button}</p>
              {anyActive && (
                <button
                  type="button"
                  onClick={resetAll}
                  className="text-xs font-medium text-[var(--ink-4)] transition-colors hover:text-[var(--ink-2)]"
                >
                  {f.reset}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {presentRooms.length > 0 && (
                <section>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-5)]">
                    {t.buildings.roomsFilter}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {presentRooms.map((rooms) => {
                      const active = roomsFilter === rooms;
                      return (
                        <button
                          key={rooms}
                          type="button"
                          onClick={() => onRoomsChange(active ? null : rooms)}
                          aria-pressed={active}
                          className={optionClass(active)}
                        >
                          {rooms} {t.buildings.roomsFilterShort}
                          <span className={active ? "text-white/70" : "text-[var(--ink-5)]"}>
                            {roomCounts.get(rooms)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {rareStatuses.length > 0 && (
                <section>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-5)]">
                    {f.statusTitle}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rareStatuses.map((s) => {
                      const active = statusFilter === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => onStatusChange(active ? null : s)}
                          aria-pressed={active}
                          className={optionClass(active)}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 shrink-0 rounded-full ${active ? "ring-1 ring-white/80" : ""}`}
                            style={{ background: STATUS_HUES[s].solid }}
                          />
                          {t.buildings.legend[s]}
                          <span className={active ? "text-white/70" : "text-[var(--ink-5)]"}>
                            {statusCounts.get(s)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {(noPriceCount > 0 || noAreaCount > 0) && (
                <section>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-5)]">
                    {f.gapsTitle}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {noPriceCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onGapChange(gapFilter === "no_price" ? null : "no_price")}
                        aria-pressed={gapFilter === "no_price"}
                        title={t.buildings.noPriceFilterHint}
                        className={optionClass(gapFilter === "no_price")}
                      >
                        {t.buildings.noPriceFilter}
                        <span className={gapFilter === "no_price" ? "text-white/70" : "text-[var(--ink-5)]"}>
                          {noPriceCount}
                        </span>
                      </button>
                    )}
                    {noAreaCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onGapChange(gapFilter === "no_area" ? null : "no_area")}
                        aria-pressed={gapFilter === "no_area"}
                        title={t.buildings.noAreaFilterHint}
                        className={optionClass(gapFilter === "no_area")}
                      >
                        {t.buildings.noAreaFilter}
                        <span className={gapFilter === "no_area" ? "text-white/70" : "text-[var(--ink-5)]"}>
                          {noAreaCount}
                        </span>
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* Not a filter but a view setting: what the cells show next to the number. */}
              <section>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-5)]">
                  {f.cellShows}
                </p>
                <div role="group" className="flex gap-0.5 rounded-xl bg-[var(--hover-c2)] p-0.5">
                  {metricOptions.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setCellMetric(o.value)}
                      aria-pressed={metric === o.value}
                      className={`h-8 flex-1 whitespace-nowrap rounded-[10px] px-2 text-xs font-medium transition-all active:scale-[0.97] ${
                        metric === o.value
                          ? "bg-[var(--surface-1)] text-[var(--ink-1)] shadow-sm"
                          : "text-[var(--ink-4)] hover:text-[var(--ink-2)]"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
