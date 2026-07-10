"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { LEAD_STATUSES, type ClientInput } from "@/lib/clients/types";
import type { PropertyObject } from "@/lib/objects/types";

const emptyInput: ClientInput = {
  name: "",
  phone: "",
  email: "",
  passport: "",
  source: "",
  status: "new",
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
      className="flex max-w-xl flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.clients.form.name}</span>
        <input
          required
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.phone}</span>
          <input
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.email}</span>
          <input
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.clients.form.passport}</span>
        <input
          value={values.passport}
          onChange={(e) => update("passport", e.target.value)}
          placeholder={t.clients.form.passportPlaceholder}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.source}</span>
          <input
            value={values.source}
            onChange={(e) => update("source", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.status}</span>
          <select
            value={values.status}
            onChange={(e) => update("status", e.target.value as ClientInput["status"])}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t.clients.statuses[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">
          {t.clients.form.interestedObject}
        </span>
        <select
          value={values.interested_object_id}
          onChange={(e) => update("interested_object_id", e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
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
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {t.clients.form.save}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            {t.clients.form.delete}
          </button>
        )}
      </div>
    </form>
  );
}
