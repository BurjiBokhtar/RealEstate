"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { FloorRowsEditor } from "@/components/FloorRowsEditor";
import {
  buildUnitsFromRows,
  emptyStructureRow,
  type StructureRow,
} from "@/lib/buildings/generateUnits";
import type { PropertyObject } from "@/lib/objects/types";

export function FloorUnitsBuilder({
  buildingId,
  pricePerSqm,
  existingUnits,
  onGenerated,
}: {
  buildingId: string;
  pricePerSqm: number | null;
  existingUnits: PropertyObject[];
  onGenerated: () => Promise<void> | void;
}) {
  const { t } = useLocale();
  const [rows, setRows] = useState<StructureRow[]>([{ ...emptyStructureRow }]);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    const toCreate = buildUnitsFromRows(rows, buildingId, pricePerSqm, existingUnits);
    if (toCreate.length === 0) return;

    setGenerating(true);
    const supabase = createClient();
    await supabase.schema("crm").from("objects").insert(toCreate);
    await onGenerated();
    setRows([{ ...emptyStructureRow }]);
    setGenerating(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-700">{t.buildings.floorBuilder.title}</p>
      <p className="text-sm text-slate-500">{t.buildings.floorBuilder.hint}</p>

      <FloorRowsEditor rows={rows} onChange={setRows} />

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {t.buildings.floorBuilder.generate}
      </button>
    </div>
  );
}
