"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { FileUploadField } from "@/components/FileUploadField";
import type { BuildingInput } from "@/lib/buildings/types";

const emptyInput: BuildingInput = {
  name: "",
  address: "",
  floors_count: "",
  units_per_floor: "",
  price_per_sqm: "",
  facade_url: "",
  plan_url: "",
};

export function BuildingForm({
  initial,
  submitting,
  onSubmit,
  onDelete,
}: {
  initial?: Partial<BuildingInput>;
  submitting: boolean;
  onSubmit: (values: BuildingInput) => void;
  onDelete?: () => void;
}) {
  const { t } = useLocale();
  const [values, setValues] = useState<BuildingInput>({ ...emptyInput, ...initial });

  const update = <K extends keyof BuildingInput>(key: K, value: BuildingInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="flex max-w-xl flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.buildings.form.name}</span>
        <input
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.buildings.form.address}</span>
        <input
          value={values.address}
          onChange={(e) => update("address", e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.buildings.form.floorsCount}</span>
          <input
            type="number"
            min="1"
            value={values.floors_count}
            onChange={(e) => update("floors_count", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">
            {t.buildings.form.unitsPerFloor}
          </span>
          <input
            type="number"
            min="1"
            value={values.units_per_floor}
            onChange={(e) => update("units_per_floor", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.buildings.form.pricePerSqm}</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={values.price_per_sqm}
          onChange={(e) => update("price_per_sqm", e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <FileUploadField
          label={t.buildings.form.facade}
          value={values.facade_url}
          onChange={(url) => update("facade_url", url)}
          folder="building-facades"
          uploadLabel={t.buildings.form.upload}
          uploadingLabel={t.buildings.form.uploading}
        />
        <FileUploadField
          label={t.buildings.form.plan}
          value={values.plan_url}
          onChange={(url) => update("plan_url", url)}
          folder="building-plans"
          uploadLabel={t.buildings.form.upload}
          uploadingLabel={t.buildings.form.uploading}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {t.buildings.form.save}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            {t.buildings.form.delete}
          </button>
        )}
      </div>
    </form>
  );
}
