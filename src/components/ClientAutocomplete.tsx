"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Client } from "@/lib/clients/types";

export function ClientAutocomplete({
  clients,
  value,
  onChange,
}: {
  clients: Client[];
  value: string;
  onChange: (clientId: string) => void;
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
    </div>
  );
}
