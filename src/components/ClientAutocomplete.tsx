"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LEAD_STATUSES, type Client, type ClientInput } from "@/lib/clients/types";

const emptyNewClient: ClientInput = {
  name: "",
  phone: "",
  email: "",
  passport: "",
  passport_issued_by: "",
  birth_date: "",
  address: "",
  source: "",
  status: "client",
  interested_object_id: "",
  notes: "",
};

export function ClientAutocomplete({
  clients,
  value,
  onChange,
  newClient,
  onNewClientChange,
}: {
  clients: Client[];
  value: string;
  onChange: (clientId: string) => void;
  newClient: ClientInput | null;
  onNewClientChange: (value: ClientInput | null) => void;
}) {
  const { t } = useLocale();
  const selected = clients.find((c) => c.id === value) ?? null;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selected?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === selected?.name.toLowerCase()) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [clients, query, selected]);

  const updateNew = <K extends keyof ClientInput>(key: K, val: ClientInput[K]) => {
    if (!newClient) return;
    onNewClientChange({ ...newClient, [key]: val });
  };

  if (newClient) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">{t.clients.form.addNew}</span>
          <button
            type="button"
            onClick={() => onNewClientChange(null)}
            className="text-xs text-slate-500 hover:text-slate-900 hover:underline"
          >
            {t.clients.form.backToSearch}
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.name}</span>
          <input
            required
            autoFocus
            value={newClient.name}
            onChange={(e) => updateNew("name", e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.clients.form.phone}</span>
            <input
              value={newClient.phone}
              onChange={(e) => updateNew("phone", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.clients.form.email}</span>
            <input
              type="email"
              value={newClient.email}
              onChange={(e) => updateNew("email", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.clients.form.passport}</span>
            <input
              value={newClient.passport}
              onChange={(e) => updateNew("passport", e.target.value)}
              placeholder={t.clients.form.passportPlaceholder}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">
              {t.clients.form.passportIssuedBy}
            </span>
            <input
              value={newClient.passport_issued_by}
              onChange={(e) => updateNew("passport_issued_by", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.clients.form.birthDate}</span>
            <input
              type="date"
              value={newClient.birth_date}
              onChange={(e) => updateNew("birth_date", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.clients.form.address}</span>
            <input
              value={newClient.address}
              onChange={(e) => updateNew("address", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.clients.form.source}</span>
            <input
              value={newClient.source}
              onChange={(e) => updateNew("source", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.clients.form.status}</span>
            <select
              value={newClient.status}
              onChange={(e) => updateNew("status", e.target.value as ClientInput["status"])}
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
          <span className="font-medium text-slate-700">{t.clients.form.notes}</span>
          <textarea
            value={newClient.notes}
            onChange={(e) => updateNew("notes", e.target.value)}
            rows={2}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{t.contracts.form.client}</span>
      <input
        required
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        placeholder={t.contracts.form.selectClient}
        autoComplete="off"
        className="rounded-md border border-slate-300 px-3 py-2"
      />

      {open && matches.length > 0 && (
        <div className="absolute top-full z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.id);
                setQuery(c.name);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">{c.name}</span>
              {c.phone && <span className="text-xs text-slate-500">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <span>
            {t.clients.form.phone}: {selected.phone || "—"}
          </span>
          <span>
            {t.clients.form.birthDate}: {selected.birth_date || "—"}
          </span>
          <span className="col-span-2">
            {t.clients.form.address}: {selected.address || "—"}
          </span>
          <span>
            {t.clients.form.passport}: {selected.passport || "—"}
          </span>
          <span>
            {t.clients.form.passportIssuedBy}: {selected.passport_issued_by || "—"}
          </span>
        </div>
      )}

      {!selected && (
        <button
          type="button"
          onClick={() => onNewClientChange({ ...emptyNewClient, name: query.trim() })}
          className="mt-1 w-fit text-xs text-slate-500 hover:text-slate-900 hover:underline"
        >
          {t.clients.form.addNew}
        </button>
      )}
    </div>
  );
}
