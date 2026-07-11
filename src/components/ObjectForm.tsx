"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { FileUploadField } from "@/components/FileUploadField";
import { CURRENCIES } from "@/lib/currency";
import { STATUS_COLORS } from "@/lib/objects/format";
import { OBJECT_TYPES, type PropertyObjectInput } from "@/lib/objects/types";

const emptyInput: PropertyObjectInput = {
  name: "",
  address: "",
  type: "apartment",
  status: "available",
  area: "",
  price: "",
  currency: "TJS",
  description: "",
  plan_url: "",
  rooms: "",
};

export function ObjectForm({
  initial,
  submitting,
  onSubmit,
  onDelete,
}: {
  initial?: Partial<PropertyObjectInput>;
  submitting: boolean;
  onSubmit: (values: PropertyObjectInput) => void;
  onDelete?: () => void;
}) {
  const { t } = useLocale();
  const [values, setValues] = useState<PropertyObjectInput>({
    ...emptyInput,
    ...initial,
  });

  const update = <K extends keyof PropertyObjectInput>(
    key: K,
    value: PropertyObjectInput[K]
  ) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="flex max-w-xl flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.objects.form.name}</span>
        <input
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.objects.form.address}</span>
        <input
          value={values.address}
          onChange={(e) => update("address", e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.objects.form.type}</span>
          <select
            value={values.type}
            onChange={(e) =>
              update("type", e.target.value as PropertyObjectInput["type"])
            }
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {OBJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t.objects.types[type]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.objects.form.status}</span>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLORS[values.status].split(" ")[0]}`}
            />
            {t.objects.statuses[values.status]}
          </div>
          <span className="text-xs text-slate-400">{t.objects.form.statusAutoHint}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.objects.form.rooms}</span>
          <input
            type="number"
            min="0"
            value={values.rooms}
            onChange={(e) => update("rooms", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.objects.form.area}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.area}
            onChange={(e) => update("area", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.objects.form.price}</span>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.price}
              onChange={(e) => update("price", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <select
              value={values.currency}
              onChange={(e) =>
                update("currency", e.target.value as PropertyObjectInput["currency"])
              }
              className="rounded-md border border-slate-300 px-2 py-2"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.objects.form.description}</span>
        <textarea
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          rows={4}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <FileUploadField
        label={t.objects.form.plan}
        value={values.plan_url}
        onChange={(url) => update("plan_url", url)}
        folder="unit-plans"
        uploadLabel={t.objects.form.upload}
        uploadingLabel={t.objects.form.uploading}
      />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? t.objects.form.saving : t.objects.form.save}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            {t.objects.form.delete}
          </button>
        )}
      </div>
    </form>
  );
}
