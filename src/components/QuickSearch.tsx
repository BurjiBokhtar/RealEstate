"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

type ClientHit = { kind: "client"; id: string; title: string; subtitle: string | null };
type ObjectHit = { kind: "object"; id: string; title: string; subtitle: string | null };
type ContractHit = { kind: "contract"; id: string; title: string; subtitle: string | null };
type Hit = ClientHit | ObjectHit | ContractHit;

// Reachable from anywhere via Ctrl/Cmd+K or the header button -- staff on
// the phone with a client shouldn't have to guess which of five sections
// that client, unit, or contract lives under.
export function QuickSearch() {
  const { t } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const supabase = createClient();
    Promise.all([
      supabase
        .schema("crm")
        .from("clients")
        .select("id, name, phone")
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%,phone2.ilike.%${q}%`)
        .limit(5),
      supabase
        .schema("crm")
        .from("objects")
        .select("id, name, address")
        .or(`name.ilike.%${q}%,address.ilike.%${q}%`)
        .limit(5),
      supabase
        .schema("crm")
        .from("contracts")
        .select("id, number, client:clients(name), object:objects(name)")
        .ilike("number", `%${q}%`)
        .limit(5),
    ]).then(([clientsRes, objectsRes, contractsRes]) => {
      if (cancelled) return;
      const clientHits: Hit[] = (clientsRes.data ?? []).map((c) => ({
        kind: "client",
        id: c.id,
        title: c.name,
        subtitle: c.phone,
      }));
      const objectHits: Hit[] = (objectsRes.data ?? []).map((o) => ({
        kind: "object",
        id: o.id,
        title: o.name,
        subtitle: o.address,
      }));
      const contractHits: Hit[] = (
        (contractsRes.data ?? []) as unknown as Array<{
          id: string;
          number: string | null;
          client: { name: string } | null;
          object: { name: string } | null;
        }>
      ).map((c) => ({
        kind: "contract",
        id: c.id,
        title: `№${c.number ?? "—"}`,
        subtitle: [c.client?.name, c.object?.name].filter(Boolean).join(" · ") || null,
      }));
      setResults([...clientHits, ...objectHits, ...contractHits]);
      setSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const go = (hit: Hit) => {
    setOpen(false);
    if (hit.kind === "client") router.push(`/clients/${hit.id}`);
    else if (hit.kind === "object") router.push(`/objects/${hit.id}`);
    else router.push(`/contracts/${hit.id}`);
  };

  const groups: Array<{ label: string; hits: Hit[] }> = [
    { label: t.search.clients, hits: results.filter((r) => r.kind === "client") },
    { label: t.search.objects, hits: results.filter((r) => r.kind === "object") },
    { label: t.search.contracts, hits: results.filter((r) => r.kind === "contract") },
  ].filter((g) => g.hits.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t.search.hint}
        className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="m14 14 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">{t.search.hint}</span>
        <span className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
          ⌘K
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh] backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-up w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-slate-400">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="m14 14 4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.search.placeholder}
                className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {query.trim().length < 2 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">
                  {t.search.typeToSearch}
                </p>
              )}
              {query.trim().length >= 2 && !searching && groups.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">{t.search.empty}</p>
              )}
              {groups.map((group) => (
                <div key={group.label} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {group.label}
                  </p>
                  {group.hits.map((hit) => (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      type="button"
                      onClick={() => go(hit)}
                      className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
                    >
                      <span className="text-sm font-medium text-slate-900">{hit.title}</span>
                      {hit.subtitle && (
                        <span className="text-xs text-slate-500">{hit.subtitle}</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
