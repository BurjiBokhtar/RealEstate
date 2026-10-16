"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { apartmentNumbersForBuildings } from "@/lib/buildings/apartmentNumbersFor";

// Flat numbers for whichever buildings a screen is currently showing.
//
// A flat's number is not stored, it is worked out from its building's whole
// grid (see apartmentNumbers.ts), so a list that wants "квартира 34" has to
// read the grids of the buildings on screen. This hook does that lazily and
// once: a building is fetched the first time it appears and remembered after,
// so paging through a list or toggling a sort does not re-read grids that are
// already in hand. Until a grid arrives the map simply has no entry, and
// unitLabel() falls back to block + floor instead of showing a wrong number.
export function useApartmentNumbers(
  buildingIds: Array<string | null | undefined>
): Map<string, number> {
  const [numbers, setNumbers] = useState<Map<string, number>>(() => new Map());
  const requested = useRef<Set<string>>(new Set());

  // A string key, not the array: callers pass a fresh array every render.
  const key = [...new Set(buildingIds.filter((id): id is string => Boolean(id)))].sort().join(",");

  useEffect(() => {
    if (!key || !isSupabaseConfigured()) return;
    const missing = key.split(",").filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));
    apartmentNumbersForBuildings(createClient(), missing)
      .then((fresh) => {
        setNumbers((prev) => {
          const next = new Map(prev);
          for (const [unitId, n] of fresh) next.set(unitId, n);
          return next;
        });
      })
      // Forget the failure so the next change of `key` tries these again.
      .catch(() => missing.forEach((id) => requested.current.delete(id)));
  }, [key]);

  return numbers;
}
