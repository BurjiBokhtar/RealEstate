"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/currency";
import type { PropertyObject } from "@/lib/objects/types";

// Edit one apartment's own rooms / area / price, then optionally copy those
// same values onto the apartment in the SAME position on a range of floors --
// because in most buildings "apartment 1" is identical on every floor, so you
// fill it once and copy up. Read-only for non-admins.
export function UnitEditModal({
  unit,
  allUnits,
  apartmentNumber,
  pricePerSqm,
  canEdit,
  onClose,
  onSaved,
}: {
  unit: PropertyObject;
  allUnits: PropertyObject[];
  apartmentNumber?: number;
  pricePerSqm?: number | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [rooms, setRooms] = useState(unit.rooms?.toString() ?? "");
  const [area, setArea] = useState(unit.area?.toString() ?? "");
  // Enter the price PER m²; the unit's total price is computed from it and the
  // area. Seeded from this unit's own rate (price/area) if it has one, else
  // the building's default rate.
  const initialRate =
    unit.price != null && unit.area
      ? unit.price / unit.area
      : (pricePerSqm ?? null);
  const [rate, setRate] = useState(
    initialRate != null ? String(Math.round(initialRate * 100) / 100) : ""
  );
  const [copyFrom, setCopyFrom] = useState("");
  const [copyTo, setCopyTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const areaNum = area === "" ? null : Number(area);
  const rateNum = rate === "" ? null : Number(rate);
  const totalPrice = areaNum != null && rateNum != null ? areaNum * rateNum : null;

  const values = () => ({
    rooms: rooms === "" ? null : Number(rooms),
    area: areaNum,
    price: totalPrice,
  });

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .schema("crm")
      .from("objects")
      .update(values())
      .eq("id", unit.id);
    setSaving(false);
    if (error) {
      setMsg({ text: error.message, ok: false });
      return;
    }
    setMsg({ text: t.buildings.unitEdit.saved, ok: true });
    onSaved();
  };

  // Apply the current rooms/area/price to the same-position unit on every
  // floor from..to in the same block.
  const copyToFloors = async () => {
    const from = Number(copyFrom);
    const to = Number(copyTo);
    if (Number.isNaN(from) || Number.isNaN(to)) return;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const targets = allUnits.filter(
      (u) =>
        (u.block ?? "") === (unit.block ?? "") &&
        u.position_in_floor === unit.position_in_floor &&
        u.floor != null &&
        u.floor >= lo &&
        u.floor <= hi &&
        u.id !== unit.id
    );
    if (targets.length === 0) {
      setMsg({ text: t.buildings.unitEdit.noTargets, ok: false });
      return;
    }
    setSaving(true);
    setMsg(null);
    const supabase = createClient();
    const v = values();
    const { error } = await supabase
      .schema("crm")
      .from("objects")
      .update(v)
      .in(
        "id",
        targets.map((u) => u.id)
      );
    setSaving(false);
    if (error) {
      setMsg({ text: error.message, ok: false });
      return;
    }
    setMsg({
      text: t.buildings.unitEdit.copied.replace("{n}", String(targets.length)),
      ok: true,
    });
    onSaved();
  };

  const FIELD =
    "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

  const title =
    apartmentNumber != null ? `№${apartmentNumber} · ${unit.name}` : unit.name;

  if (!canEdit) {
    return (
      <Modal title={title} onClose={onClose}>
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-slate-400">{t.buildings.viewOnlyHint}</p>
          <Row label={t.buildings.hover.rooms} value={unit.rooms ?? "—"} />
          <Row label={t.buildings.hover.area} value={unit.area ?? "—"} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-slate-600">{t.buildings.hover.rooms}</span>
            <input
              type="number"
              min="0"
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-slate-600">
              {t.buildings.floorBuilder.area}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-slate-600">
              {t.buildings.unitEdit.pricePerSqm}
            </span>
            <input
              type="number"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        {/* Total is computed from area × price/m², never typed directly. */}
        <div className="flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">
            {t.buildings.unitEdit.totalPrice}
          </span>
          <span className="text-lg font-bold text-[#5b3468]">
            {totalPrice != null
              ? formatCurrency(totalPrice, unit.currency)
              : "—"}
          </span>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-10 rounded-lg bg-gradient-to-r from-[#1c1a3a] to-[#5b3468] text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "…" : t.buildings.unitEdit.save}
        </button>

        {/* Copy the values above to the same position on a range of floors. */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600">
            {t.buildings.unitEdit.copyTitle}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {t.buildings.unitEdit.copyHint}
          </p>
          <div className="mt-2 flex items-end gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-slate-500">{t.buildings.floorBuilder.floorsFrom}</span>
              <input
                type="number"
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
                className={`${FIELD} w-20`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-slate-500">{t.buildings.floorBuilder.floorsTo}</span>
              <input
                type="number"
                value={copyTo}
                onChange={(e) => setCopyTo(e.target.value)}
                className={`${FIELD} w-20`}
              />
            </label>
            <button
              type="button"
              onClick={copyToFloors}
              disabled={saving || !copyFrom || !copyTo}
              className="h-10 rounded-lg border border-[#5b3468] px-3 text-sm font-medium text-[#5b3468] transition-all hover:bg-purple-50 active:scale-[0.98] disabled:opacity-40"
            >
              {t.buildings.unitEdit.copyBtn}
            </button>
          </div>
        </div>

        {msg && (
          <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
