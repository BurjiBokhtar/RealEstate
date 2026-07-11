import type { PropertyObject } from "@/lib/objects/types";

// Apartment numbers run sequentially through the whole entrance, floor by
// floor from the ground up (floor 1 ends on 7, floor 2 starts on 8, ...) --
// not the per-floor position index and not the floor-position pair encoded
// in the unit's internal `name` (e.g. "Даромадгоҳи 1 №17-6" is a block +
// floor/position code, not the real apartment number). Each block/entrance
// numbers its own units starting from 1, since that's how real shakhmatki
// are numbered -- and it's this number, not the internal name, that has to
// end up on a contract.
export function computeApartmentNumbers(units: PropertyObject[]): Map<string, number> {
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
