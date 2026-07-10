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

// --- Hierarchical constructor: Block -> Entrance -> room-type rows.
// A room-type row describes one apartment layout repeated on every standard
// floor of an entrance ("3 однокомнатных по 45 м²"). Special floors
// (penthouse, parking, basement) are handled separately since they don't
// follow the per-entrance/per-floor pattern. ---

export type RoomRow = {
  rooms: string;
  type: ObjectType;
  count: string;
  area: string;
};

export const emptyRoomRow: RoomRow = { rooms: "", type: "apartment", count: "", area: "" };

export type Entrance = {
  name: string;
  rows: RoomRow[];
};

export function makeEntrance(name: string): Entrance {
  return { name, rows: [{ ...emptyRoomRow }] };
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
  rows: RoomRow[];
};

export function makeSpecialFloor(): SpecialFloor {
  return { label: "", floor: "", rows: [{ ...emptyRoomRow }] };
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

      for (let floor = 1; floor <= floorsCount; floor++) {
        let position = 1;
        for (const row of entrance.rows) {
          const count = Number(row.count) || 0;
          for (let i = 0; i < count; i++) {
            drafts.push({
              groupLabel,
              floor,
              position: position++,
              rooms: row.rooms,
              type: row.type,
              area: row.area,
            });
          }
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
    let position = 1;
    for (const row of special.rows) {
      const count = Number(row.count) || 0;
      for (let i = 0; i < count; i++) {
        drafts.push({
          groupLabel: special.label.trim(),
          floor,
          position: position++,
          rooms: row.rooms,
          type: row.type,
          area: row.area,
        });
      }
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
