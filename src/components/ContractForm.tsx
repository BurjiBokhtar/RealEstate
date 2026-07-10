"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { CONTRACT_STATUSES, type ContractInput } from "@/lib/contracts/types";
import type { Client } from "@/lib/clients/types";
import type { PropertyObject } from "@/lib/objects/types";

const emptyInput: ContractInput = {
  number: "",
  client_id: "",
  object_id: "",
  amount: "",
  paid_amount: "",
  status: "draft",
  signed_date: "",
  notes: "",
};

export function ContractForm({
  initial,
  submitting,
  onSubmit,
  onDelete,
}: {
  initial?: Partial<ContractInput>;
  submitting: boolean;
  onSubmit: (values: ContractInput) => void;
  onDelete?: () => void;
}) {
  const { t } = useLocale();
  const [values, setValues] = useState<ContractInput>({ ...emptyInput, ...initial });
  const [clients, setClients] = useState<Client[]>([]);
  const [objects, setObjects] = useState<PropertyObject[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("clients")
      .select("*")
      .order("name")
      .then(({ data }) => setClients((data ?? []) as Client[]));
    supabase
      .schema("crm")
      .from("objects")
      .select("*")
      .order("name")
      .then(({ data }) => setObjects((data ?? []) as PropertyObject[]));
  }, []);

  const update = <K extends keyof ContractInput>(key: K, value: ContractInput[K]) =>
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
        <span className="font-medium text-slate-700">{t.contracts.form.number}</span>
        <input
          value={values.number}
          onChange={(e) => update("number", e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.contracts.form.client}</span>
          <select
            required
            value={values.client_id}
            onChange={(e) => update("client_id", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">{t.contracts.form.selectClient}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.contracts.form.object}</span>
          <select
            required
            value={values.object_id}
            onChange={(e) => update("object_id", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">{t.contracts.form.selectObject}</option>
            {objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.contracts.form.amount}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.amount}
            onChange={(e) => update("amount", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.contracts.form.paidAmount}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.paid_amount}
            onChange={(e) => update("paid_amount", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.contracts.form.status}</span>
          <select
            value={values.status}
            onChange={(e) => update("status", e.target.value as ContractInput["status"])}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {CONTRACT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t.contracts.statuses[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.contracts.form.signedDate}</span>
          <input
            type="date"
            value={values.signed_date}
            onChange={(e) => update("signed_date", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.contracts.form.notes}</span>
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
          {t.contracts.form.save}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            {t.contracts.form.delete}
          </button>
        )}
      </div>
    </form>
  );
}
