"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import type { Building } from "@/lib/buildings/types";
import type { PropertyObject } from "@/lib/objects/types";

// Duplicates a building's whole shakhmatka layout (every apartment, shop,
// parking bay -- floor, block, position, span, rooms, area, price) into a
// brand-new building. Every copied unit resets to "available" with no
// client/contract attached -- this clones the LAYOUT, never a sale. Meant
// for a second, identical building in the same complex (twin towers, a
// repeated section) so the whole floor-by-floor setup doesn't have to be
// rebuilt by hand in the constructor.
export function DuplicateBuildingModal({
  building,
  units,
  onClose,
}: {
  building: Building;
  units: PropertyObject[];
  onClose: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [name, setName] = useState(`${building.name} (копия)`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    // New building starts at "planning" -- it's a fresh shell, not yet under
    // construction or on sale, regardless of what stage the original is at.
    const { data: newBuilding, error: buildingError } = await supabase
      .schema("crm")
      .from("buildings")
      .insert({
        name: name.trim(),
        address: building.address,
        floors_count: building.floors_count,
        units_per_floor: building.units_per_floor,
        price_per_sqm: building.price_per_sqm,
        construction_status: "planning",
      })
      .select("id")
      .single();

    if (buildingError || !newBuilding) {
      setSaving(false);
      setError(buildingError?.message ?? t.common.error);
      return;
    }

    if (units.length > 0) {
      const rows = units.map((u) => ({
        name: u.name,
        address: u.address,
        type: u.type,
        status: "available" as const,
        building_id: newBuilding.id,
        block: u.block,
        floor: u.floor,
        position_in_floor: u.position_in_floor,
        span: u.span,
        area: u.area,
        price: u.price,
        currency: u.currency,
        rooms: u.rooms,
        description: u.description,
      }));
      const { error: unitsError } = await supabase.schema("crm").from("objects").insert(rows);
      if (unitsError) {
        setSaving(false);
        setError(unitsError.message);
        return;
      }
    }

    setSaving(false);
    router.push(`/buildings/${newBuilding.id}`);
  };

  return (
    <Modal title={t.buildings.duplicate.title} onClose={onClose} guardClose>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-slate-500">
          {t.buildings.duplicate.hint.replace("{n}", String(units.length))}
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">{t.buildings.duplicate.nameLabel}</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
        {error && <p className="text-red-600">{error}</p>}
        <button
          type="button"
          onClick={duplicate}
          disabled={saving || !name.trim()}
          className="h-10 rounded-lg btn-brand text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "…" : t.buildings.duplicate.confirm}
        </button>
      </div>
    </Modal>
  );
}
