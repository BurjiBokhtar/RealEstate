import type { ObjectType, PropertyObject } from "@/lib/objects/types";

export type StructureRow = {
  block: string;
  floor: string;
  type: ObjectType;
  count: string;
  area: string;
};

export const emptyStructureRow: StructureRow = {
  block: "",
  floor: "",
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
      });
    }
    plannedByBlockFloor.set(key, startPosition + count - 1);
  }

  return toCreate;
}

export type UnitDraft = {
  entrance: number;
  floor: number;
  position: number;
  type: ObjectType;
  area: string;
};

export function generateGrid(floorsCount: number, entranceCounts: string[]): UnitDraft[] {
  const drafts: UnitDraft[] = [];
  if (!floorsCount || floorsCount < 1) return drafts;

  for (let floor = floorsCount; floor >= 1; floor--) {
    entranceCounts.forEach((countStr, idx) => {
      const count = Number(countStr) || 0;
      for (let position = 1; position <= count; position++) {
        drafts.push({ entrance: idx + 1, floor, position, type: "apartment", area: "" });
      }
    });
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
    if (d.floor === sourceFloor) sourceByKey.set(`${d.entrance}-${d.position}`, d);
  }
  const targetSet = new Set(targetFloors);

  return drafts.map((d) => {
    if (!targetSet.has(d.floor)) return d;
    const source = sourceByKey.get(`${d.entrance}-${d.position}`);
    if (!source) return d;
    return { ...d, type: source.type, area: source.area };
  });
}

export function unitDraftsToPayload(
  drafts: UnitDraft[],
  buildingId: string,
  pricePerSqm: number | null,
  entranceCount: number,
  entranceLabel: string
): Array<Record<string, unknown>> {
  return drafts.map((d) => {
    const block = entranceCount > 1 ? `${entranceLabel} ${d.entrance}` : null;
    const area = d.area ? Number(d.area) : null;
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
    };
  });
}
