"use client";

import { Fragment, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { OBJECT_TYPES, type ObjectType } from "@/lib/objects/types";
import {
  copyFloorPattern,
  fillPositionRange,
  mergeAdjacentDrafts,
  type UnitDraft,
} from "@/lib/buildings/generateUnits";

export function UnitGridEditor({
  drafts,
  onChange,
}: {
  drafts: UnitDraft[];
  onChange: (drafts: UnitDraft[]) => void;
}) {
  const { t } = useLocale();
  const [copyTargets, setCopyTargets] = useState<Record<number, string>>({});
  const [bulk, setBulk] = useState({
    group: "",
    position: "",
    fromFloor: "",
    toFloor: "",
    rooms: "",
    area: "",
  });

  if (drafts.length === 0) return null;

  const floors = Array.from(new Set(drafts.map((d) => d.floor))).sort((a, b) => b - a);
  const groupOptions = Array.from(new Set(drafts.map((d) => d.groupLabel)));
  const showGroups = groupOptions.length > 1;
  const positionOptions = Array.from(new Set(drafts.map((d) => d.position))).sort(
    (a, b) => a - b
  );

  const updateDraft = (
    floor: number,
    groupLabel: string,
    position: number,
    patch: Partial<UnitDraft>
  ) => {
    onChange(
      drafts.map((d) =>
        d.floor === floor && d.groupLabel === groupLabel && d.position === position
          ? { ...d, ...patch }
          : d
      )
    );
  };

  const handleCopy = (sourceFloor: number) => {
    const target = copyTargets[sourceFloor];
    if (!target) return;
    const targets =
      target === "all" ? floors.filter((f) => f !== sourceFloor) : [Number(target)];
    onChange(copyFloorPattern(drafts, sourceFloor, targets));
  };

  const handleMerge = (floor: number, groupLabel: string, posA: number, posB: number) => {
    onChange(mergeAdjacentDrafts(drafts, floor, groupLabel, posA, posB));
  };

  const applyBulk = () => {
    const position = Number(bulk.position);
    const from = Number(bulk.fromFloor);
    const to = Number(bulk.toFloor);
    if (!position || !bulk.fromFloor || !bulk.toFloor) return;
    const patch: { rooms?: string; area?: string } = {};
    if (bulk.rooms) patch.rooms = bulk.rooms;
    if (bulk.area) patch.area = bulk.area;
    if (Object.keys(patch).length === 0) return;
    onChange(fillPositionRange(drafts, showGroups ? bulk.group : "", position, from, to, patch));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="w-full text-xs font-semibold text-slate-600">
          {t.buildings.constructor.bulkFillTitle}
        </p>
        {showGroups && (
          <select
            value={bulk.group}
            onChange={(e) => setBulk((b) => ({ ...b, group: e.target.value }))}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          >
            {groupOptions.map((g) => (
              <option key={g || "_"} value={g}>
                {g || "—"}
              </option>
            ))}
          </select>
        )}
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-slate-500">{t.buildings.constructor.bulkPosition}</span>
          <select
            value={bulk.position}
            onChange={(e) => setBulk((b) => ({ ...b, position: e.target.value }))}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="">—</option>
            {positionOptions.map((p) => (
              <option key={p} value={p}>
                №{p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-slate-500">{t.buildings.constructor.bulkFromFloor}</span>
          <input
            type="number"
            value={bulk.fromFloor}
            onChange={(e) => setBulk((b) => ({ ...b, fromFloor: e.target.value }))}
            className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-slate-500">{t.buildings.constructor.bulkToFloor}</span>
          <input
            type="number"
            value={bulk.toFloor}
            onChange={(e) => setBulk((b) => ({ ...b, toFloor: e.target.value }))}
            className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-slate-500">{t.buildings.constructor.rowRooms}</span>
          <input
            type="number"
            min="0"
            value={bulk.rooms}
            onChange={(e) => setBulk((b) => ({ ...b, rooms: e.target.value }))}
            className="w-14 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="text-slate-500">{t.buildings.constructor.areaPlaceholder}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={bulk.area}
            onChange={(e) => setBulk((b) => ({ ...b, area: e.target.value }))}
            className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          />
        </label>
        <button
          type="button"
          onClick={applyBulk}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          {t.buildings.constructor.bulkApply}
        </button>
      </div>

      {floors.map((floor) => {
        const floorUnits = drafts.filter((d) => d.floor === floor);
        const groups = Array.from(new Set(floorUnits.map((u) => u.groupLabel)));

        return (
          <div key={floor} className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">
                {t.buildings.constructor.floorLabel} {floor}
              </p>
              {floors.length > 1 && (
                <div className="flex items-center gap-2">
                  <select
                    value={copyTargets[floor] ?? ""}
                    onChange={(e) =>
                      setCopyTargets((c) => ({ ...c, [floor]: e.target.value }))
                    }
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="">{t.buildings.constructor.copyTo}</option>
                    <option value="all">{t.buildings.constructor.copyToAll}</option>
                    {floors
                      .filter((f) => f !== floor)
                      .map((f) => (
                        <option key={f} value={f}>
                          {t.buildings.constructor.floorLabel} {f}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleCopy(floor)}
                    disabled={!copyTargets[floor]}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {t.buildings.constructor.copyButton}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {groups.map((groupLabel) => {
                const units = floorUnits
                  .filter((u) => u.groupLabel === groupLabel)
                  .sort((a, b) => a.position - b.position);
                return (
                  <div key={groupLabel || "_"} className="flex flex-col gap-1.5">
                    {showGroups && groupLabel && (
                      <p className="text-xs font-medium text-slate-500">{groupLabel}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1">
                      {units.map((unit, idx) => (
                        <Fragment key={unit.position}>
                          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                            <span className="text-xs text-slate-500">№{unit.position}</span>
                            <select
                              value={unit.type}
                              onChange={(e) =>
                                updateDraft(floor, groupLabel, unit.position, {
                                  type: e.target.value as ObjectType,
                                })
                              }
                              className="rounded border border-slate-300 px-1 py-1 text-xs"
                            >
                              {OBJECT_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {t.objects.types[type]}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="0"
                              placeholder={t.buildings.constructor.rowRooms}
                              value={unit.rooms}
                              onChange={(e) =>
                                updateDraft(floor, groupLabel, unit.position, {
                                  rooms: e.target.value,
                                })
                              }
                              className="w-12 rounded border border-slate-300 px-1.5 py-1 text-xs"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={t.buildings.constructor.areaPlaceholder}
                              value={unit.area}
                              onChange={(e) =>
                                updateDraft(floor, groupLabel, unit.position, {
                                  area: e.target.value,
                                })
                              }
                              className="w-20 rounded border border-slate-300 px-1.5 py-1 text-xs"
                            />
                          </div>
                          {idx < units.length - 1 &&
                            units[idx + 1].position === unit.position + 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleMerge(
                                    floor,
                                    groupLabel,
                                    unit.position,
                                    units[idx + 1].position
                                  )
                                }
                                title={t.buildings.merge}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs text-white hover:bg-slate-700"
                              >
                                +
                              </button>
                            )}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
