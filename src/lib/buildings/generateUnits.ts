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
