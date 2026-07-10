"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { OBJECT_TYPES, type ObjectType } from "@/lib/objects/types";
import { copyFloorPattern, type UnitDraft } from "@/lib/buildings/generateUnits";

export function UnitGridEditor({
  drafts,
  entranceCount,
  onChange,
}: {
  drafts: UnitDraft[];
  entranceCount: number;
  onChange: (drafts: UnitDraft[]) => void;
}) {
  const { t } = useLocale();
  const [copyTargets, setCopyTargets] = useState<Record<number, string>>({});

  if (drafts.length === 0) return null;

  const floors = Array.from(new Set(drafts.map((d) => d.floor))).sort((a, b) => b - a);

  const updateDraft = (
    floor: number,
    entrance: number,
    position: number,
    patch: Partial<UnitDraft>
  ) => {
    onChange(
      drafts.map((d) =>
        d.floor === floor && d.entrance === entrance && d.position === position
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

  return (
    <div className="flex flex-col gap-3">
      {floors.map((floor) => {
        const floorUnits = drafts.filter((d) => d.floor === floor);
        const entrances = Array.from(new Set(floorUnits.map((u) => u.entrance))).sort(
          (a, b) => a - b
        );

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
              {entrances.map((entrance) => (
                <div key={entrance} className="flex flex-col gap-1.5">
                  {entranceCount > 1 && (
                    <p className="text-xs font-medium text-slate-500">
                      {t.buildings.constructor.entranceLabel} {entrance}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {floorUnits
                      .filter((u) => u.entrance === entrance)
                      .map((unit) => (
                        <div
                          key={unit.position}
                          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                        >
                          <span className="text-xs text-slate-500">№{unit.position}</span>
                          <select
                            value={unit.type}
                            onChange={(e) =>
                              updateDraft(floor, entrance, unit.position, {
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
                            step="0.01"
                            placeholder={t.buildings.constructor.areaPlaceholder}
                            value={unit.area}
                            onChange={(e) =>
                              updateDraft(floor, entrance, unit.position, {
                                area: e.target.value,
                              })
                            }
                            className="w-20 rounded border border-slate-300 px-1.5 py-1 text-xs"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
