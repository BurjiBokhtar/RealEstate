"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import type { ClientInput } from "@/lib/clients/types";
import type { PropertyObject } from "@/lib/objects/types";

const FIELD_CLASS =
  "h-10 rounded-lg border border-slate-300 px-3 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";
const TEXTAREA_CLASS =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const emptyInput: ClientInput = {
  name: "",
  phone: "",
  email: "",
  passport: "",
  passport_issued_by: "",
  birth_date: "",
  address: "",
  source: "",
  interested_object_id: "",
  notes: "",
};

export function ClientForm({
  initial,
  submitting,
  onSubmit,
  onDelete,
}: {
  initial?: Partial<ClientInput>;
  submitting: boolean;
  onSubmit: (values: ClientInput) => void;
  onDelete?: () => void;
}) {
  const { t } = useLocale();
  const [values, setValues] = useState<ClientInput>({ ...emptyInput, ...initial });
  const [objects, setObjects] = useState<PropertyObject[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("objects")
      .select("*")
      .order("name")
      .then(({ data }) => setObjects((data ?? []) as PropertyObject[]));
  }, []);

  const update = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="flex max-w-xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.clients.form.name}</span>
        <input
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className={FIELD_CLASS}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.phone}</span>
          <input
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.email}</span>
          <input
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.passport}</span>
          <input
            value={values.passport}
            onChange={(e) => update("passport", e.target.value)}
            placeholder={t.clients.form.passportPlaceholder}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">
            {t.clients.form.passportIssuedBy}
          </span>
          <input
            value={values.passport_issued_by}
            onChange={(e) => update("passport_issued_by", e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.birthDate}</span>
          <input
            type="date"
            value={values.birth_date}
            onChange={(e) => update("birth_date", e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.address}</span>
          <input
            value={values.address}
            onChange={(e) => update("address", e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">
          {t.clients.form.interestedObject}
        </span>
        <select
          value={values.interested_object_id}
          onChange={(e) => update("interested_object_id", e.target.value)}
          className={FIELD_CLASS}
        >
          <option value="">{t.clients.form.noneOption}</option>
          {objects.map((obj) => (
            <option key={obj.id} value={obj.id}>
              {obj.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.clients.form.notes}</span>
        <textarea
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={4}
          className={TEXTAREA_CLASS}
        />
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
        >
          {t.clients.form.save}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition-all hover:border-red-400 hover:bg-red-50 active:scale-[0.98]"
          >
            {t.clients.form.delete}
          </button>
        )}
      </div>
    </form>
  );
}
