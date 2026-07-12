"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Client, ClientInput } from "@/lib/clients/types";

const FIELD_CLASS =
  "h-10 rounded-lg border border-slate-300 px-3 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

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
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-sm font-semibold text-slate-800">{t.clients.form.addNew}</span>
          <button
            type="button"
            onClick={() => onNewClientChange(null)}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
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
            className={FIELD_CLASS}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.clients.form.phone}</span>
            <input
              value={newClient.phone}
              onChange={(e) => updateNew("phone", e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.clients.form.email}</span>
            <input
              type="email"
              value={newClient.email}
              onChange={(e) => updateNew("email", e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">
              {t.clients.form.passport} <span className="text-red-500">*</span>
            </span>
            <input
              required
              value={newClient.passport}
              onChange={(e) => updateNew("passport", e.target.value)}
              placeholder={t.clients.form.passportPlaceholder}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">
              {t.clients.form.passportIssuedBy} <span className="text-red-500">*</span>
            </span>
            <input
              required
              value={newClient.passport_issued_by}
              onChange={(e) => updateNew("passport_issued_by", e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">
              {t.clients.form.birthDate} <span className="text-red-500">*</span>
            </span>
            <input
              required
              type="date"
              value={newClient.birth_date}
              onChange={(e) => updateNew("birth_date", e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.clients.form.address}</span>
            <input
              value={newClient.address}
              onChange={(e) => updateNew("address", e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.clients.form.notes}</span>
          <textarea
            value={newClient.notes}
            onChange={(e) => updateNew("notes", e.target.value)}
            rows={2}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
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
        className={FIELD_CLASS}
      />

      {open && matches.length > 0 && (
        <div className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.id);
                setQuery(c.name);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">{c.name}</span>
              {c.phone && <span className="text-xs text-slate-500">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-1 flex flex-col gap-2">
          {(!selected.passport || !selected.passport_issued_by || !selected.birth_date) && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              ⚠ {t.contracts.form.missingRequiredClientFields}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.clients.form.phone}
              </span>
              <span className="text-sm text-slate-700">{selected.phone || "—"}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.clients.form.birthDate}
              </span>
              <span
                className={`text-sm ${selected.birth_date ? "text-slate-700" : "font-medium text-amber-600"}`}
              >
                {selected.birth_date || "—"}
              </span>
            </div>
            <div className="col-span-2 flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.clients.form.address}
              </span>
              <span className="text-sm text-slate-700">{selected.address || "—"}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.clients.form.passport}
              </span>
              <span
                className={`text-sm ${selected.passport ? "text-slate-700" : "font-medium text-amber-600"}`}
              >
                {selected.passport || "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.clients.form.passportIssuedBy}
              </span>
              <span
                className={`text-sm ${selected.passport_issued_by ? "text-slate-700" : "font-medium text-amber-600"}`}
              >
                {selected.passport_issued_by || "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {!selected && (
        <button
          type="button"
          onClick={() => onNewClientChange({ ...emptyNewClient, name: query.trim() })}
          className="mt-1 w-fit rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          {t.clients.form.addNew}
        </button>
      )}
    </div>
  );
}
