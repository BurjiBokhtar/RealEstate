"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { OBJECT_TYPES, type ObjectType } from "@/lib/objects/types";
import { emptyRoomRow, type RoomRow } from "@/lib/buildings/generateUnits";

export function RoomRowsEditor({
  rows,
  onChange,
}: {
  rows: RoomRow[];
  onChange: (rows: RoomRow[]) => void;
}) {
  const { t } = useLocale();

  const updateRow = <K extends keyof RoomRow>(index: number, key: K, value: RoomRow[K]) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  };

  const addRow = () => onChange([...rows, { ...emptyRoomRow }]);
  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_1.3fr_1fr_1fr_auto] items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-slate-700">
              {t.buildings.constructor.rowRooms}
            </span>
            <input
              type="number"
              min="0"
              value={row.rooms}
              onChange={(e) => updateRow(index, "rooms", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-slate-700">
              {t.buildings.floorBuilder.type}
            </span>
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
            <span className="font-medium text-slate-700">
              {t.buildings.floorBuilder.count}
            </span>
            <input
              type="number"
              min="1"
              value={row.count}
              onChange={(e) => updateRow(index, "count", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-slate-700">
              {t.buildings.floorBuilder.area}
            </span>
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
      <button
        type="button"
        onClick={addRow}
        className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {t.buildings.constructor.addRowType}
      </button>
    </div>
  );
}
