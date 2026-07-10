"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { BuildingForm } from "@/components/BuildingForm";
import { FloorRowsEditor } from "@/components/FloorRowsEditor";
import { UnitGridEditor } from "@/components/UnitGridEditor";
import {
  buildUnitsFromRows,
  generateGrid,
  unitDraftsToPayload,
  emptyStructureRow,
  type StructureRow,
  type UnitDraft,
} from "@/lib/buildings/generateUnits";
import { emptyBuildingInput } from "@/lib/buildings/types";

export default function NewBuildingPage() {
  const { t } = useLocale();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState(emptyBuildingInput);
  const [entranceCount, setEntranceCount] = useState("1");
  const [entranceUnitCounts, setEntranceUnitCounts] = useState<string[]>([""]);
  const [grid, setGrid] = useState<UnitDraft[]>([]);
  const [advancedRows, setAdvancedRows] = useState<StructureRow[]>([{ ...emptyStructureRow }]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateEntranceCount = (value: string) => {
    setEntranceCount(value);
    const n = Math.max(1, Number(value) || 1);
    setEntranceUnitCounts((prev) => {
      const next = [...prev];
      while (next.length < n) next.push("");
      return next.slice(0, n);
    });
  };

  const handleGenerate = () => {
    if (grid.length > 0 && !window.confirm(t.buildings.constructor.confirmRegenerate)) return;
    const floorsCount = Number(values.floors_count) || 0;
    setGrid(generateGrid(floorsCount, entranceUnitCounts));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const pricePerSqm = values.price_per_sqm ? Number(values.price_per_sqm) : null;
    const totalPerFloor = entranceUnitCounts.reduce((sum, c) => sum + (Number(c) || 0), 0);

    const { data, error } = await supabase
      .schema("crm")
      .from("buildings")
      .insert({
        name: values.name,
        address: values.address || null,
        floors_count: values.floors_count ? Number(values.floors_count) : null,
        units_per_floor: totalPerFloor || null,
        price_per_sqm: pricePerSqm,
        facade_url: values.facade_url || null,
        plan_url: values.plan_url || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      setSubmitting(false);
      setError(error?.message ?? t.common.error);
      return;
    }

    const entranceCountNum = Number(entranceCount) || 1;
    const gridUnits = unitDraftsToPayload(
      grid,
      data.id,
      pricePerSqm,
      entranceCountNum,
      t.buildings.constructor.entranceLabel
    );
    const advancedUnits = buildUnitsFromRows(advancedRows, data.id, pricePerSqm, []);
    const units = [...gridUnits, ...advancedUnits];
    if (units.length > 0) {
      await supabase.schema("crm").from("objects").insert(units);
    }

    setSubmitting(false);
    router.push(`/buildings/${data.id}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/buildings" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.buildings.backToList}
      </Link>
      <h1 className="text-2xl font-semibold">{t.buildings.newBuilding}</h1>
      {!configured && <SetupNotice />}

      <BuildingForm
        values={values}
        onChange={setValues}
        submitting={submitting}
        onSubmit={handleSubmit}
        hideUnitsPerFloor
      >
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-700">{t.buildings.constructor.title}</p>
          <p className="text-sm text-slate-500">{t.buildings.constructor.hint}</p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                {t.buildings.constructor.entrancesCount}
              </span>
              <input
                type="number"
                min="1"
                value={entranceCount}
                onChange={(e) => updateEntranceCount(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            {entranceUnitCounts.map((count, idx) => (
              <label key={idx} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">
                  {t.buildings.constructor.unitsInEntrance} {idx + 1}
                </span>
                <input
                  type="number"
                  min="0"
                  value={count}
                  onChange={(e) =>
                    setEntranceUnitCounts((prev) =>
                      prev.map((c, i) => (i === idx ? e.target.value : c))
                    )
                  }
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t.buildings.constructor.generate}
          </button>

          <UnitGridEditor
            drafts={grid}
            entranceCount={Number(entranceCount) || 1}
            onChange={setGrid}
          />

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-sm text-slate-500 underline hover:text-slate-900"
            >
              {showAdvanced
                ? t.buildings.constructor.hideAdvanced
                : t.buildings.constructor.showAdvanced}
            </button>
          </div>

          {showAdvanced && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
              <p className="text-sm text-slate-500">{t.buildings.constructor.advancedHint}</p>
              <FloorRowsEditor rows={advancedRows} onChange={setAdvancedRows} />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </BuildingForm>
    </div>
  );
}
