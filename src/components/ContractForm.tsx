"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, CURRENCIES } from "@/lib/currency";
import { CONTRACT_STATUSES, PAYMENT_TYPES, type ContractInput } from "@/lib/contracts/types";
import { amountToWordsTj } from "@/lib/contracts/amountToWordsTj";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";
import type { Client, ClientInput } from "@/lib/clients/types";
import type { PropertyObject } from "@/lib/objects/types";

type ObjectWithBuilding = PropertyObject & { building: { name: string } | null };

// Contract numbers are system-generated, not typed by staff: building/object
// initial + unit position + day of month, e.g. "Rudaki Residence" unit №1
// today on the 11th -> "R-1-11".
function computeContractNumber(object: ObjectWithBuilding | undefined): string {
  if (!object) return "";
  const source = (object.building?.name || object.name).trim();
  if (!source) return "";
  const initial = source.charAt(0).toUpperCase();
  const day = new Date().getDate();
  return object.position_in_floor != null
    ? `${initial}-${object.position_in_floor}-${day}`
    : `${initial}-${day}`;
}

const emptyInput: ContractInput = {
  number: "",
  client_id: "",
  object_id: "",
  amount: "",
  paid_amount: "",
  currency: "TJS",
  amount_words: "",
  status: "draft",
  signed_date: "",
  notes: "",
  payment_type: "full",
  installment_months: "",
  barter_details: "",
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
  const [objects, setObjects] = useState<ObjectWithBuilding[]>([]);
  const [newClient, setNewClient] = useState<ClientInput | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const isExistingContract = Boolean(initial?.number);

  const amountNum = Number(values.amount) || 0;
  const paidNum = Number(values.paid_amount) || 0;
  const pct = amountNum > 0 ? (paidNum / amountNum) * 100 : 0;
  const lastAutoWords = useRef("");

  const handlePercentChange = (pctValue: string) => {
    const p = Number(pctValue) || 0;
    const newPaid = amountNum > 0 ? Math.round(((amountNum * p) / 100) * 100) / 100 : 0;
    update("paid_amount", newPaid.toString());
  };

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
      .select("*, building:buildings(name)")
      .order("name")
      .then(({ data }) => setObjects((data ?? []) as unknown as ObjectWithBuilding[]));
  }, []);

  const update = <K extends keyof ContractInput>(key: K, value: ContractInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // Booking flow arrives with object_id already set (before `objects` has
  // loaded) — fill in the auto-generated number as soon as both are ready.
  useEffect(() => {
    if (isExistingContract || values.number || !values.object_id) return;
    const selected = objects.find((o) => o.id === values.object_id);
    if (!selected) return;
    update("number", computeContractNumber(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, values.object_id]);

  // Auto-suggest the Tajik amount-in-words whenever the amount/currency
  // changes, but only while the field still matches our last suggestion —
  // once staff edit it by hand, further amount changes leave it alone.
  useEffect(() => {
    if (!amountNum) return;
    if (values.amount_words && values.amount_words !== lastAutoWords.current) return;
    const generated = amountToWordsTj(amountNum, values.currency);
    lastAutoWords.current = generated;
    update("amount_words", generated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountNum, values.currency]);

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newClient) {
      onSubmit(values);
      return;
    }
    setCreatingClient(true);
    setClientError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("crm")
      .from("clients")
      .insert({
        name: newClient.name,
        phone: newClient.phone || null,
        email: newClient.email || null,
        passport: newClient.passport || null,
        passport_issued_by: newClient.passport_issued_by || null,
        birth_date: newClient.birth_date || null,
        address: newClient.address || null,
        source: newClient.source || null,
        status: newClient.status,
        notes: newClient.notes || null,
      })
      .select("id")
      .single();
    setCreatingClient(false);
    if (error || !data) {
      setClientError(error?.message ?? t.common.error);
      return;
    }
    onSubmit({ ...values, client_id: data.id });
  };

  return (
    <form onSubmit={handleFormSubmit} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.contracts.form.number}</span>
        <input
          value={values.number}
          onChange={(e) => update("number", e.target.value)}
          readOnly={!isExistingContract}
          placeholder={isExistingContract ? "" : t.contracts.form.numberAuto}
          className={`rounded-md border border-slate-300 px-3 py-2 ${
            isExistingContract ? "" : "bg-slate-50 text-slate-500"
          }`}
        />
      </label>

      <div className="grid grid-cols-2 gap-4 items-start">
        <ClientAutocomplete
          clients={clients}
          value={values.client_id}
          onChange={(id) => update("client_id", id)}
          newClient={newClient}
          onNewClientChange={setNewClient}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.contracts.form.object}</span>
          <select
            required
            value={values.object_id}
            onChange={(e) => {
              const objectId = e.target.value;
              const selected = objects.find((o) => o.id === objectId);
              setValues((v) => ({
                ...v,
                object_id: objectId,
                amount: v.amount || selected?.price?.toString() || v.amount,
                currency: selected?.currency ?? v.currency,
                number: isExistingContract ? v.number : computeContractNumber(selected),
              }));
            }}
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

      <div className="grid grid-cols-[2fr_2fr_1fr] gap-4">
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.contracts.form.currency}</span>
          <select
            value={values.currency}
            onChange={(e) => update("currency", e.target.value as ContractInput["currency"])}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {amountNum > 0 && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">
            {pct.toFixed(1)}% {t.contracts.form.percentOfAmount} ·{" "}
            {formatCurrency(paidNum, values.currency)}
          </span>
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{t.contracts.form.enterPercent}</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={pct ? Math.round(pct * 10) / 10 : ""}
              onChange={(e) => handlePercentChange(e.target.value)}
              className="w-20 rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
        </div>
      )}

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

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.contracts.form.paymentType}</span>
          <select
            value={values.payment_type}
            onChange={(e) =>
              update("payment_type", e.target.value as ContractInput["payment_type"])
            }
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {PAYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t.contracts.paymentTypes[type]}
              </option>
            ))}
          </select>
        </label>
        {values.payment_type === "installment" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">
              {t.contracts.form.installmentMonths}
            </span>
            <input
              type="number"
              min="1"
              value={values.installment_months}
              onChange={(e) => update("installment_months", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        )}
      </div>

      {values.payment_type === "barter" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">
            {t.contracts.form.barterDetails}
          </span>
          <textarea
            value={values.barter_details}
            onChange={(e) => update("barter_details", e.target.value)}
            rows={2}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.contracts.form.amountWords}</span>
        <input
          value={values.amount_words}
          onChange={(e) => update("amount_words", e.target.value)}
          placeholder={t.contracts.form.amountWordsPlaceholder}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t.contracts.form.notes}</span>
        <textarea
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={4}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      {clientError && <p className="text-sm text-red-600">{clientError}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || creatingClient}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isExistingContract ? t.contracts.form.save : t.contracts.form.create}
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
