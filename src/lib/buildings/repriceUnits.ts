import type { PropertyObject } from "@/lib/objects/types";

// A flat's price is a STORED number, not a formula: it is written once, when
// the constructor generates the units (see generateUnits.ts), and from then on
// it lives on its own. So changing the building's rate used to move nothing --
// the shakhmatka and the dashboard's "potential" both read the stored prices.
//
// This works out which flats may follow the new rate. The rule is about money
// that has already changed hands: a flat nobody has paid anything for is still
// just a price tag, so it re-prices; a flat with payments behind it is a deal,
// and a deal is not re-priced by editing a building.

// PostgREST puts `id=in.(...)` in the URL even on a PATCH, and a uuid costs
// ~37 characters there. A big block can put hundreds of flats at the same
// price, which is how a single update grows into a URL the gateway rejects.
const MAX_IDS_PER_UPDATE = 100;

export type RepricePlan = {
  // Grouped by resulting price: flats of the same type share an area, so a
  // 200-flat building is a handful of updates, not 200 round trips. A price
  // can appear in more than one group -- see MAX_IDS_PER_UPDATE.
  groups: Array<{ price: number; ids: string[] }>;
  // How many flats the groups add up to -- what the confirmation promises.
  count: number;
  // Eligible, but left alone, and why. Shown so the numbers are not silently
  // short: "why did it only re-price 46 of 60?"
  skippedNoArea: number;
  skippedCurrency: number;
  // Sold, rented, or booked with payments already made.
  locked: number;
};

export const RATE_CURRENCY = "TJS";

// Available: a price tag, nothing behind it. Reserved: only while nobody has
// paid anything against it. Sold, rented, or booked-and-paid: a deal, and a
// deal is not re-priced by editing a building.
function isRepricable(
  unit: PropertyObject,
  paidByUnitId: Record<string, number>
): boolean {
  if (unit.status === "available") return true;
  if (unit.status === "reserved") return (paidByUnitId[unit.id] ?? 0) === 0;
  return false;
}

export function planReprice(
  units: PropertyObject[],
  pricePerSqm: number,
  paidByUnitId: Record<string, number>
): RepricePlan {
  const byPrice = new Map<number, string[]>();
  let skippedNoArea = 0;
  let skippedCurrency = 0;
  let locked = 0;

  for (const unit of units) {
    if (!isRepricable(unit, paidByUnitId)) {
      locked += 1;
      continue;
    }
    // The building's rate is quoted in TJS -- the form's own label says so --
    // so it cannot be applied to a flat priced in dollars.
    if (unit.currency !== RATE_CURRENCY) {
      skippedCurrency += 1;
      continue;
    }
    if (!unit.area || unit.area <= 0) {
      skippedNoArea += 1;
      continue;
    }
    // Two decimals: raw float multiplication produces prices like
    // 388195.00000000006, which then show up in contracts and receipts.
    const price = Math.round(unit.area * pricePerSqm * 100) / 100;
    // Already at the new rate -- not an update, and not something to count in
    // a confirmation that says "re-price N flats".
    if (unit.price === price) continue;
    const ids = byPrice.get(price);
    if (ids) ids.push(unit.id);
    else byPrice.set(price, [unit.id]);
  }

  const groups: RepricePlan["groups"] = [];
  for (const [price, ids] of byPrice) {
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_UPDATE) {
      groups.push({ price, ids: ids.slice(i, i + MAX_IDS_PER_UPDATE) });
    }
  }

  return {
    groups,
    count: groups.reduce((n, g) => n + g.ids.length, 0),
    skippedNoArea,
    skippedCurrency,
    locked,
  };
}
