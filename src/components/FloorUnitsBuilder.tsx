"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { OBJECT_TYPES, type ObjectType } from "@/lib/objects/types";
import { buildUnitsFromRows, type StructureRow } from "@/lib/buildings/generateUnits";
import type { PropertyObject } from "@/lib/objects/types";

// Atlas accents, same as the hero and the contract.
const PLUM = "#5b3468";

const FIELD =
  "h-9 rounded-lg border border-slate-300 px-2.5 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

// One stretch of identical floors inside a block: "floors 2..9, four
// 2-room apartments of 53.5 m² each". A block is described by a few of
// these instead of one hand-typed row per floor.
type FloorRange = {
  from: string;
  to: string;
  count: string;
  rooms: string;
  type: ObjectType;
  area: string;
};

type BlockDraft = {
  name: string;
  ranges: FloorRange[];
};

const emptyRange = (): FloorRange => ({
  from: "",
  to: "",
  count: "",
  rooms: "",
  type: "apartment",
  area: "",
});

const emptyBlock = (): BlockDraft => ({ name: "", ranges: [emptyRange()] });

// Expand block cards into the flat per-floor rows the existing generator
// understands -- it already knows how to continue positions next to
// whatever units the building has.
function expandBlocks(blocks: BlockDraft[]): StructureRow[] {
  const rows: StructureRow[] = [];
  for (const b of blocks) {
    for (const r of b.ranges) {
      const from = Number(r.from);
      const to = r.to === "" ? from : Number(r.to);
      if (r.from === "" || Number.isNaN(from) || Number.isNaN(to) || !Number(r.count))
        continue;
      const step = to >= from ? 1 : -1;
      for (let f = from; step > 0 ? f <= to : f >= to; f += step) {
        rows.push({
          block: b.name.trim(),
          floor: String(f),
          rooms: r.rooms,
          type: r.type,
          count: r.count,
          area: r.area,
        });
      }
    }
  }
  return rows;
}

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
  const [blocks, setBlocks] = useState<BlockDraft[]>([emptyBlock()]);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  // What the building looks like right now, grouped by block -- so whoever
  // is editing sees what's already there before adding to it, and so a new
  // block's name can be checked against existing ones.
  const existingBlocks = useMemo(() => {
    const map = new Map<string, { floors: Set<number>; count: number }>();
    for (const u of existingUnits) {
      const key = u.block?.trim() || "";
      const entry = map.get(key) ?? { floors: new Set<number>(), count: 0 };
      if (u.floor != null) entry.floors.add(u.floor);
      entry.count++;
      map.set(key, entry);
    }
    return [...map.entries()].map(([name, v]) => ({
      name,
      floors: v.floors.size,
      count: v.count,
    }));
  }, [existingUnits]);

  const existingNames = useMemo(
    () => new Set(existingBlocks.map((b) => b.name).filter(Boolean)),
    [existingBlocks]
  );

  const previewCount = useMemo(
    () => expandBlocks(blocks).reduce((sum, r) => sum + Number(r.count), 0),
    [blocks]
  );

  const patchBlock = (i: number, patch: Partial<BlockDraft>) =>
    setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const patchRange = (i: number, k: number, patch: Partial<FloorRange>) =>
    setBlocks((bs) =>
      bs.map((b, j) =>
        j === i
          ? { ...b, ranges: b.ranges.map((r, m) => (m === k ? { ...r, ...patch } : r)) }
          : b
      )
    );

  const handleGenerate = async () => {
    const toCreate = buildUnitsFromRows(
      expandBlocks(blocks),
      buildingId,
      pricePerSqm,
      existingUnits
    );
    if (toCreate.length === 0) return;

    setGenerating(true);
    const supabase = createClient();
    const { error } = await supabase.schema("crm").from("objects").insert(toCreate);
    if (!error) {
      await onGenerated();
      setBlocks([emptyBlock()]);
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    }
    setGenerating(false);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-[15px] font-semibold text-slate-800">
          {t.buildings.floorBuilder.title}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">{t.buildings.floorBuilder.hint}</p>
      </div>

      {existingBlocks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.buildings.floorBuilder.existing}
          </span>
          {existingBlocks.map((b) => (
            <span
              key={b.name || "__none"}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
            >
              <span className="font-semibold text-slate-800">
                {b.name || t.buildings.floorBuilder.noBlockName}
              </span>
              {b.floors} {t.buildings.floorBuilder.floorsShort} · {b.count}{" "}
              {t.buildings.floorBuilder.unitsShort}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {blocks.map((block, i) => {
          const joinsExisting = existingNames.has(block.name.trim());
          return (
            <div
              key={i}
              style={{ borderColor: `${PLUM}55` }}
              className="flex flex-col gap-3 rounded-xl border bg-slate-50/60 p-4"
            >
              <div className="flex flex-wrap items-end justify-between gap-2">
                <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs">
                  <span style={{ color: PLUM }} className="font-semibold">
                    {t.buildings.floorBuilder.blockName}
                  </span>
                  <input
                    value={block.name}
                    onChange={(e) => patchBlock(i, { name: e.target.value })}
                    placeholder={t.buildings.floorBuilder.blockPlaceholder}
                    list="existing-blocks"
                    className={`${FIELD} bg-white font-medium`}
                  />
                  {joinsExisting && (
                    <span className="text-[11px] text-emerald-600">
                      ✓ {t.buildings.floorBuilder.existingBlockHint}
                    </span>
                  )}
                </label>
                {blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBlocks((bs) => bs.filter((_, j) => j !== i))}
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50"
                  >
                    {t.buildings.floorBuilder.removeBlock}
                  </button>
                )}
              </div>

              {block.ranges.map((r, k) => (
                <div
                  key={k}
                  className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[auto_auto_1fr_0.8fr_1.2fr_1fr_auto]"
                >
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-slate-600">
                      {t.buildings.floorBuilder.floorsFrom}
                    </span>
                    <input
                      type="number"
                      value={r.from}
                      onChange={(e) => patchRange(i, k, { from: e.target.value })}
                      placeholder="1"
                      className={`${FIELD} w-20 bg-white`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-slate-600">
                      {t.buildings.floorBuilder.floorsTo}
                    </span>
                    <input
                      type="number"
                      value={r.to}
                      onChange={(e) => patchRange(i, k, { to: e.target.value })}
                      placeholder={r.from || "9"}
                      className={`${FIELD} w-20 bg-white`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-slate-600">
                      {t.buildings.floorBuilder.perFloor}
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={r.count}
                      onChange={(e) => patchRange(i, k, { count: e.target.value })}
                      className={`${FIELD} bg-white`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-slate-600">
                      {t.buildings.floorBuilder.rooms}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={r.rooms}
                      onChange={(e) => patchRange(i, k, { rooms: e.target.value })}
                      className={`${FIELD} bg-white`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-slate-600">
                      {t.buildings.floorBuilder.type}
                    </span>
                    <select
                      value={r.type}
                      onChange={(e) =>
                        patchRange(i, k, { type: e.target.value as ObjectType })
                      }
                      className={`${FIELD} bg-white`}
                    >
                      {OBJECT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t.objects.types[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-slate-600">
                      {t.buildings.floorBuilder.area}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={r.area}
                      onChange={(e) => patchRange(i, k, { area: e.target.value })}
                      className={`${FIELD} bg-white`}
                    />
                  </label>
                  {block.ranges.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        patchBlock(i, { ranges: block.ranges.filter((_, m) => m !== k) })
                      }
                      className="h-9 rounded-lg border border-red-200 px-2.5 text-xs text-red-500 transition-colors hover:bg-red-50"
                    >
                      ✕
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => patchBlock(i, { ranges: [...block.ranges, emptyRange()] })}
                className="w-fit rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-white"
              >
                {t.buildings.floorBuilder.addRange}
              </button>
            </div>
          );
        })}
      </div>

      {/* Datalist backs the block-name input: picking an existing name adds
          floors to that block instead of creating a lookalike. */}
      <datalist id="existing-blocks">
        {[...existingNames].map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setBlocks((bs) => [...bs, emptyBlock()])}
          style={{ borderColor: PLUM, color: PLUM }}
          className="rounded-lg border px-3.5 py-2 text-sm font-medium transition-all hover:bg-purple-50 active:scale-[0.98]"
        >
          {t.buildings.floorBuilder.addBlock}
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || previewCount === 0}
          className="rounded-lg bg-gradient-to-r from-[#1c1a3a] to-[#5b3468] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-40"
        >
          {generating ? t.common.loading : t.buildings.floorBuilder.generate}
        </button>
        {previewCount > 0 && !done && (
          <span className="text-sm text-slate-500">
            {t.buildings.floorBuilder.willCreate}{" "}
            <span className="font-bold text-slate-800">{previewCount}</span>
          </span>
        )}
        {done && (
          <span className="text-sm font-medium text-emerald-600">
            ✓ {t.buildings.floorBuilder.created}
          </span>
        )}
      </div>
    </div>
  );
}
