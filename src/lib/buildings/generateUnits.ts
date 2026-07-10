import type { ObjectType, PropertyObject } from "@/lib/objects/types";

// --- Simple flat rows: used by FloorUnitsBuilder to add a few extra units
// to an already-built building (basement, a forgotten floor, etc). ---

export type StructureRow = {
  block: string;
  floor: string;
  rooms: string;
  type: ObjectType;
  count: string;
  area: string;
};

export const emptyStructureRow: StructureRow = {
  block: "",
  floor: "",
  rooms: "",
  type: "apartment",
  count: "",
  area: "",
};

export function buildUnitsFromRows(
  rows: StructureRow[],
  buildingId: string,
  pricePerSqm: number | null,
  existingUnits: PropertyObject[]
): Array<Record<string, unknown>> {
  const toCreate: Array<Record<string, unknown>> = [];
  const plannedByBlockFloor = new Map<string, number>();

  for (const row of rows) {
    const floor = Number(row.floor);
    const count = Number(row.count);
    const area = row.area ? Number(row.area) : null;
    const rooms = row.rooms ? Number(row.rooms) : null;
    const block = row.block.trim() || null;
    if (Number.isNaN(floor) || !count) continue;

    const key = `${block ?? ""}-${floor}`;
    const existingOnFloor = existingUnits.filter(
      (u) => (u.floor ?? 0) === floor && (u.block ?? null) === block
    );
    const existingMax = existingOnFloor.reduce(
      (max, u) => Math.max(max, (u.position_in_floor ?? 0) + (u.span || 1)),
      0
    );
    const startPosition = Math.max(existingMax, plannedByBlockFloor.get(key) ?? 0) + 1;

    const price = area && pricePerSqm ? area * pricePerSqm : null;

    for (let i = 0; i < count; i++) {
      const position = startPosition + i;
      toCreate.push({
        name: block ? `${block} №${floor}-${position}` : `№${floor}-${position}`,
        type: row.type,
        status: "available",
        building_id: buildingId,
        block,
        floor,
        position_in_floor: position,
        area,
        price,
        rooms,
      });
    }
    plannedByBlockFloor.set(key, startPosition + count - 1);
  }

  return toCreate;
}

// --- Hierarchical constructor: Block -> Entrance. Pick floors + units per
// floor and the grid is generated instantly with blank area/rooms — those
// get filled in afterward directly in the review grid (per unit, per floor
// range, or by merging two adjacent units), not configured up front. ---

export type Entrance = {
  name: string;
  unitsPerFloor: string;
  type: ObjectType;
};

export function makeEntrance(name: string): Entrance {
  return { name, unitsPerFloor: "", type: "apartment" };
}

export type Block = {
  name: string;
  floorsCount: string;
  entrances: Entrance[];
};

export function makeBlock(name: string, entranceName: string): Block {
  return { name, floorsCount: "", entrances: [makeEntrance(entranceName)] };
}

export type SpecialFloor = {
  label: string;
  floor: string;
  count: string;
  type: ObjectType;
};

export function makeSpecialFloor(): SpecialFloor {
  return { label: "", floor: "", count: "", type: "apartment" };
}

export type UnitDraft = {
  groupLabel: string;
  floor: number;
  position: number;
  rooms: string;
  type: ObjectType;
  area: string;
};

export function generateFromBlocks(blocks: Block[]): UnitDraft[] {
  const drafts: UnitDraft[] = [];
  const multiBlock = blocks.length > 1;

  for (const block of blocks) {
    const floorsCount = Number(block.floorsCount) || 0;
    if (!floorsCount) continue;
    const multiEntrance = block.entrances.length > 1;

    for (const entrance of block.entrances) {
      const labelParts: string[] = [];
      if (multiBlock && block.name.trim()) labelParts.push(block.name.trim());
      if (multiEntrance && entrance.name.trim()) labelParts.push(entrance.name.trim());
      const groupLabel = labelParts.join(", ");
      const count = Number(entrance.unitsPerFloor) || 0;
      if (!count) continue;

      for (let floor = 1; floor <= floorsCount; floor++) {
        for (let position = 1; position <= count; position++) {
          drafts.push({
            groupLabel,
            floor,
            position,
            rooms: "",
            type: entrance.type,
            area: "",
          });
        }
      }
    }
  }

  return drafts;
}

export function generateSpecialFloors(specials: SpecialFloor[]): UnitDraft[] {
  const drafts: UnitDraft[] = [];

  for (const special of specials) {
    const floor = Number(special.floor);
    if (Number.isNaN(floor) || !special.floor.trim()) continue;
    const count = Number(special.count) || 0;
    for (let position = 1; position <= count; position++) {
      drafts.push({
        groupLabel: special.label.trim(),
        floor,
        position,
        rooms: "",
        type: special.type,
        area: "",
      });
    }
  }

  return drafts;
}

export function copyFloorPattern(
  drafts: UnitDraft[],
  sourceFloor: number,
  targetFloors: number[]
): UnitDraft[] {
  const sourceByKey = new Map<string, UnitDraft>();
  for (const d of drafts) {
    if (d.floor === sourceFloor) sourceByKey.set(`${d.groupLabel}-${d.position}`, d);
  }
  const targetSet = new Set(targetFloors);

  return drafts.map((d) => {
    if (!targetSet.has(d.floor)) return d;
    const source = sourceByKey.get(`${d.groupLabel}-${d.position}`);
    if (!source) return d;
    return { ...d, type: source.type, area: source.area, rooms: source.rooms };
  });
}

// Takes one unit's current rooms/area/type and applies it to the same
// position on every floor in its group — fill in one apartment, click once,
// and it's set for the whole column instead of retyping it per floor.
export function applyColumn(
  drafts: UnitDraft[],
  groupLabel: string,
  position: number,
  patch: { rooms: string; area: string; type: ObjectType }
): UnitDraft[] {
  return drafts.map((d) =>
    d.groupLabel === groupLabel && d.position === position ? { ...d, ...patch } : d
  );
}

// Combines two adjacent units on the same floor into one (summed area),
// mirroring the merge tool already available on the live shakhmatka grid.
export function mergeAdjacentDrafts(
  drafts: UnitDraft[],
  floor: number,
  groupLabel: string,
  positionA: number,
  positionB: number
): UnitDraft[] {
  const a = drafts.find(
    (d) => d.floor === floor && d.groupLabel === groupLabel && d.position === positionA
  );
  const b = drafts.find(
    (d) => d.floor === floor && d.groupLabel === groupLabel && d.position === positionB
  );
  if (!a || !b) return drafts;
  const combinedArea = (Number(a.area) || 0) + (Number(b.area) || 0);

  return drafts
    .map((d) =>
      d === a
        ? { ...d, area: combinedArea ? String(combinedArea) : "", rooms: "" }
        : d
    )
    .filter((d) => d !== b);
}

export function unitDraftsToPayload(
  drafts: UnitDraft[],
  buildingId: string,
  pricePerSqm: number | null
): Array<Record<string, unknown>> {
  return drafts.map((d) => {
    const block = d.groupLabel || null;
    const area = d.area ? Number(d.area) : null;
    const rooms = d.rooms ? Number(d.rooms) : null;
    const price = area && pricePerSqm ? area * pricePerSqm : null;
    return {
      name: block ? `${block} №${d.floor}-${d.position}` : `№${d.floor}-${d.position}`,
      type: d.type,
      status: "available",
      building_id: buildingId,
      block,
      floor: d.floor,
      position_in_floor: d.position,
      area,
      price,
      rooms,
    };
  });
}
