"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { BuildingForm } from "@/components/BuildingForm";
import { UnitGridEditor } from "@/components/UnitGridEditor";
import { OBJECT_TYPES, type ObjectType } from "@/lib/objects/types";
import {
  generateFromBlocks,
  generateSpecialFloors,
  unitDraftsToPayload,
  makeBlock,
  makeEntrance,
  makeSpecialFloor,
  type Block,
  type SpecialFloor,
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
  const [blocks, setBlocks] = useState<Block[]>([makeBlock("", "")]);
  const [specialFloors, setSpecialFloors] = useState<SpecialFloor[]>([]);
  const [grid, setGrid] = useState<UnitDraft[]>([]);

  const updateBlock = (blockIdx: number, patch: Partial<Block>) =>
    setBlocks((prev) => prev.map((b, i) => (i === blockIdx ? { ...b, ...patch } : b)));

  const addBlock = () =>
    setBlocks((prev) => [
      ...prev,
      makeBlock(
        `${t.buildings.constructor.blockLabel} ${prev.length + 1}`,
        `${t.buildings.constructor.entranceLabel} 1`
      ),
    ]);

  const removeBlock = (blockIdx: number) =>
    setBlocks((prev) => prev.filter((_, i) => i !== blockIdx));

  const addEntrance = (blockIdx: number) =>
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
              ...b,
              entrances: [
                ...b.entrances,
                makeEntrance(`${t.buildings.constructor.entranceLabel} ${b.entrances.length + 1}`),
              ],
            }
          : b
      )
    );

  const removeEntrance = (blockIdx: number, entranceIdx: number) =>
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? { ...b, entrances: b.entrances.filter((_, j) => j !== entranceIdx) }
          : b
      )
    );

  const updateEntrance = (
    blockIdx: number,
    entranceIdx: number,
    patch: Partial<Block["entrances"][number]>
  ) =>
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? { ...b, entrances: b.entrances.map((e, j) => (j === entranceIdx ? { ...e, ...patch } : e)) }
          : b
      )
    );

  const addSpecialFloor = () => setSpecialFloors((prev) => [...prev, makeSpecialFloor()]);
  const removeSpecialFloor = (idx: number) =>
    setSpecialFloors((prev) => prev.filter((_, i) => i !== idx));
  const updateSpecialFloor = (idx: number, patch: Partial<SpecialFloor>) =>
    setSpecialFloors((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const handleGenerate = () => {
    if (grid.length > 0 && !window.confirm(t.buildings.constructor.confirmRegenerate)) return;
    const fromBlocks = generateFromBlocks(blocks);
    const fromSpecial = generateSpecialFloors(specialFloors);
    setGrid([...fromBlocks, ...fromSpecial]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const pricePerSqm = values.price_per_sqm ? Number(values.price_per_sqm) : null;
    const maxFloors = blocks.reduce((max, b) => Math.max(max, Number(b.floorsCount) || 0), 0);
    const unitsPerFloor = maxFloors > 0 ? Math.round(grid.length / maxFloors) : grid.length || null;

    const { data, error } = await supabase
      .schema("crm")
      .from("buildings")
      .insert({
        name: values.name,
        address: values.address || null,
        floors_count: maxFloors || null,
        units_per_floor: unitsPerFloor || null,
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

    const units = unitDraftsToPayload(grid, data.id, pricePerSqm);
    if (units.length > 0) {
      await supabase.schema("crm").from("objects").insert(units);
    }

    setSubmitting(false);
    router.push(`/buildings/${data.id}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/objects" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.objects.title}
      </Link>
      <h1 className="text-2xl font-semibold">{t.buildings.newBuilding}</h1>
      {!configured && <SetupNotice />}

      <BuildingForm
        values={values}
        onChange={setValues}
        submitting={submitting}
        onSubmit={handleSubmit}
        hideUnitsPerFloor
        hideFloorsCount
      >
        <div className="flex flex-col gap-4 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-700">{t.buildings.constructor.title}</p>
          <p className="text-sm text-slate-500">{t.buildings.constructor.hint}</p>

          <div className="flex flex-col gap-4">
            {blocks.map((block, blockIdx) => (
              <div key={blockIdx} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div className="grid flex-1 grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-slate-700">
                        {t.buildings.constructor.blockName}
                      </span>
                      <input
                        value={block.name}
                        onChange={(e) => updateBlock(blockIdx, { name: e.target.value })}
                        placeholder={`${t.buildings.constructor.blockLabel} ${blockIdx + 1}`}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-slate-700">
                        {t.buildings.constructor.blockFloorsCount}
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={block.floorsCount}
                        onChange={(e) =>
                          updateBlock(blockIdx, { floorsCount: e.target.value })
                        }
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  {blocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBlock(blockIdx)}
                      className="rounded-md border border-red-300 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      {t.buildings.constructor.removeBlock}
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {block.entrances.map((entrance, entranceIdx) => (
                    <div
                      key={entranceIdx}
                      className="grid grid-cols-[1.5fr_1fr_1fr_auto] items-end gap-2 rounded-md bg-slate-50 p-3"
                    >
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-slate-700">
                          {t.buildings.constructor.entranceName}
                        </span>
                        <input
                          value={entrance.name}
                          onChange={(e) =>
                            updateEntrance(blockIdx, entranceIdx, { name: e.target.value })
                          }
                          placeholder={`${t.buildings.constructor.entranceLabel} ${entranceIdx + 1}`}
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-slate-700">
                          {t.buildings.constructor.unitsPerFloor}
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={entrance.unitsPerFloor}
                          onChange={(e) =>
                            updateEntrance(blockIdx, entranceIdx, {
                              unitsPerFloor: e.target.value,
                            })
                          }
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-slate-700">
                          {t.buildings.floorBuilder.type}
                        </span>
                        <select
                          value={entrance.type}
                          onChange={(e) =>
                            updateEntrance(blockIdx, entranceIdx, {
                              type: e.target.value as ObjectType,
                            })
                          }
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          {OBJECT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {t.objects.types[type]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {block.entrances.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEntrance(blockIdx, entranceIdx)}
                          className="rounded-md border border-red-300 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
                        >
                          {t.buildings.constructor.removeEntrance}
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addEntrance(blockIdx)}
                    className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {t.buildings.constructor.addEntrance}
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addBlock}
              className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {t.buildings.constructor.addBlock}
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 p-3">
            <p className="text-sm font-semibold text-slate-700">
              {t.buildings.constructor.specialFloorsTitle}
            </p>
            <p className="text-xs text-slate-500">{t.buildings.constructor.specialFloorsHint}</p>
            {specialFloors.map((special, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1.3fr_1fr_1fr_1fr_auto] items-end gap-2 rounded-md bg-slate-50 p-3"
              >
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-slate-700">
                    {t.buildings.constructor.specialFloorLabel}
                  </span>
                  <input
                    value={special.label}
                    onChange={(e) => updateSpecialFloor(idx, { label: e.target.value })}
                    placeholder={t.buildings.constructor.specialFloorLabelPlaceholder}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-slate-700">
                    {t.buildings.constructor.specialFloorNumber}
                  </span>
                  <input
                    type="number"
                    value={special.floor}
                    onChange={(e) => updateSpecialFloor(idx, { floor: e.target.value })}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-slate-700">
                    {t.buildings.floorBuilder.count}
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={special.count}
                    onChange={(e) => updateSpecialFloor(idx, { count: e.target.value })}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-slate-700">
                    {t.buildings.floorBuilder.type}
                  </span>
                  <select
                    value={special.type}
                    onChange={(e) =>
                      updateSpecialFloor(idx, { type: e.target.value as ObjectType })
                    }
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    {OBJECT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t.objects.types[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => removeSpecialFloor(idx)}
                  className="rounded-md border border-red-300 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  {t.buildings.constructor.removeSpecialFloor}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSpecialFloor}
              className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {t.buildings.constructor.addSpecialFloor}
            </button>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t.buildings.constructor.generate}
          </button>

          <UnitGridEditor drafts={grid} onChange={setGrid} />

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </BuildingForm>
    </div>
  );
}
