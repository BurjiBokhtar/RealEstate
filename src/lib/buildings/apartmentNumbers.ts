import type { PropertyObject } from "@/lib/objects/types";

// Apartment numbers run sequentially through the whole entrance, floor by
// floor from the ground up (floor 1 ends on 7, floor 2 starts on 8, ...) --
// not the per-floor position index and not the floor-position pair encoded
// in the unit's internal `name` (e.g. "Даромадгоҳи 1 №17-6" is a block +
// floor/position code, not the real apartment number). Each block/entrance
// numbers its own units starting from 1, since that's how real shakhmatki
// are numbered -- and it's this number, not the internal name, that has to
// end up on a contract.
//
// Deliberately NOT "index this unit among all currently-existing units" --
// that shifts every later unit's number the moment one earlier unit is
// deleted (and the shakhmatka now has a one-click "restore this cell"
// feature that makes gaps a normal, persistent state, not just a fleeting
// mid-edit blip). A contract printed with "apartment №15" must keep
// meaning the same physical unit even if some other unit gets deleted
// later. Instead, a unit's number is a pure function of its OWN floor and
// position: (how many floors below it) * (widest position any floor in
// this block reaches) + its own position. Neither term depends on which
// OTHER units currently exist, only on which floors exist and this unit's
// own slot -- so deleting a unit elsewhere never renumbers units that
// didn't change.
export function computeApartmentNumbers(units: PropertyObject[]): Map<string, number> {
  const numbers = new Map<string, number>();
  const blocks = Array.from(new Set(units.map((u) => u.block ?? "")));
  for (const block of blocks) {
    const blockUnits = units.filter((u) => (u.block ?? "") === block);
    const floors = Array.from(new Set(blockUnits.map((u) => u.floor ?? 0))).sort(
      (a, b) => a - b
    );
    const floorOrdinal = new Map(floors.map((f, i) => [f, i]));
    const widestPosition = blockUnits.reduce(
      (max, u) => Math.max(max, (u.position_in_floor ?? 1) + (u.span || 1) - 1),
      1
    );
    for (const u of blockUnits) {
      const ordinal = floorOrdinal.get(u.floor ?? 0) ?? 0;
      numbers.set(u.id, ordinal * widestPosition + (u.position_in_floor ?? 1));
    }
  }
  return numbers;
}
