"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { OBJECT_TYPES, type ObjectType, type PropertyObject } from "@/lib/objects/types";

type Row = {
  block: string;
  floor: string;
  type: ObjectType;
  count: string;
  area: string;
};

const emptyRow: Row = { block: "", floor: "", type: "apartment", count: "", area: "" };

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
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const [generating, setGenerating] = useState(false);

  const updateRow = <K extends keyof Row>(index: number, key: K, value: Row[K]) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { ...emptyRow }]);
  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  const handleGenerate = async () => {
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

    if (toCreate.length === 0) return;

    setGenerating(true);
    const supabase = createClient();
    await supabase.schema("crm").from("objects").insert(toCreate);
    await onGenerated();
    setRows([{ ...emptyRow }]);
    setGenerating(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-700">{t.buildings.floorBuilder.title}</p>
      <p className="text-sm text-slate-500">{t.buildings.floorBuilder.hint}</p>

      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_1fr_1.3fr_1fr_1fr_auto] items-end gap-2"
          >
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-700">{t.buildings.floorBuilder.block}</span>
              <input
                value={row.block}
                onChange={(e) => updateRow(index, "block", e.target.value)}
                placeholder={t.buildings.floorBuilder.blockPlaceholder}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-700">{t.buildings.floorBuilder.floor}</span>
              <input
                type="number"
                value={row.floor}
                onChange={(e) => updateRow(index, "floor", e.target.value)}
                placeholder={t.buildings.floorBuilder.floorPlaceholder}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-700">{t.buildings.floorBuilder.type}</span>
              <select
                value={row.type}
                onChange={(e) => updateRow(index, "type", e.target.value as ObjectType)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {OBJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t.objects.types[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-700">{t.buildings.floorBuilder.count}</span>
              <input
                type="number"
                min="1"
                value={row.count}
                onChange={(e) => updateRow(index, "count", e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-700">{t.buildings.floorBuilder.area}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.area}
                onChange={(e) => updateRow(index, "area", e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="rounded-md border border-red-300 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                {t.buildings.floorBuilder.removeRow}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t.buildings.floorBuilder.addRow}
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {t.buildings.floorBuilder.generate}
        </button>
      </div>
    </div>
  );
}
