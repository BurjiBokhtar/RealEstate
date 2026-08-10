import type { SupabaseClient } from "@supabase/supabase-js";
import { computeApartmentNumbers } from "@/lib/buildings/apartmentNumbers";
import type { PropertyObject } from "@/lib/objects/types";

// Flat numbers for units that are NOT on the shakhmatka screen.
//
// A flat's number ("хонаи 34") isn't stored anywhere: it comes from where the
// unit sits in its building's grid, so it can only be worked out from the
// building's whole unit list. Screens that show a single contract therefore
// have to fetch that list, and three of them were each doing it by hand.
//
// Two things this fixes over the copies it replaces:
//
//  - PostgREST caps a plain select at 1000 rows. A building with more units
//    than that answered with a truncated list, and computeApartmentNumbers
//    would then hand out numbers derived from a building missing its upper
//    floors -- silently, on a printed contract. This pages until the rows run
//    out.
//  - Numbering is computed per building. Block labels repeat across buildings
//    ("Даромадгоҳи 1" exists in every one of them), so pooling units from
//    several buildings into one call would merge unrelated sequences.

const PAGE = 1000;

async function unitsOfBuilding(
  supabase: SupabaseClient,
  buildingId: string
): Promise<PropertyObject[]> {
  const all: PropertyObject[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .schema("crm")
      .from("objects")
      .select("*")
      .eq("building_id", buildingId)
      .range(from, from + PAGE - 1);
    const chunk = (data ?? []) as PropertyObject[];
    all.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return all;
}

/** unit id → flat number, for every unit of the given buildings. */
export async function apartmentNumbersForBuildings(
  supabase: SupabaseClient,
  buildingIds: Array<string | null | undefined>
): Promise<Map<string, number>> {
  const ids = [...new Set(buildingIds.filter((id): id is string => Boolean(id)))];
  const out = new Map<string, number>();
  await Promise.all(
    ids.map(async (id) => {
      const numbers = computeApartmentNumbers(await unitsOfBuilding(supabase, id));
      for (const [unitId, n] of numbers) out.set(unitId, n);
    })
  );
  return out;
}
