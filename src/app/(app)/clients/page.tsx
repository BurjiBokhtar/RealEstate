"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { Pagination } from "@/components/Pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { formatCurrency, type Currency } from "@/lib/currency";
import { ExportMenu } from "@/components/ExportMenu";
import type { Client } from "@/lib/clients/types";

// Paid/total across a client's active contracts, per currency -- fetched
// only for the 25 clients on the current page, so the list stays fast no
// matter how big the client base grows.
type ClientDebt = {
  byCurrency: Record<string, { total: number; paid: number }>;
};

const PAGE_SIZE = 25;

export default function ClientsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();

  const [clients, setClients] = useState<Client[]>([]);
  const [debts, setDebts] = useState<Record<string, ClientDebt>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput);
  const [sort, setSort] = useState<"new" | "old" | "az" | "za">("new");

  useEffect(() => {
    setPage(1);
  }, [search, sort]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    setLoading(true);

    let query = supabase.schema("crm").from("clients").select("*", { count: "exact" });
    if (search.trim()) {
      const q = search.trim();
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,phone2.ilike.%${q}%`);
    }
    const from = (page - 1) * PAGE_SIZE;
    const orderBy =
      sort === "az" || sort === "za"
        ? { col: "name", asc: sort === "az" }
        : { col: "created_at", asc: sort === "old" };
    query = query
      .order(orderBy.col, { ascending: orderBy.asc })
      .range(from, from + PAGE_SIZE - 1);

    query.then(async ({ data, count }) => {
      const rows = (data ?? []) as Client[];
      setClients(rows);
      setTotalCount(count ?? 0);
      setLoading(false);

      if (rows.length === 0) {
        setDebts({});
        return;
      }
      const { data: contractRows } = await supabase
        .schema("crm")
        .from("contracts")
        .select("client_id, amount, paid_amount, currency, status")
        .in(
          "client_id",
          rows.map((c) => c.id)
        )
        .neq("status", "cancelled");
      const map: Record<string, ClientDebt> = {};
      for (const c of (contractRows ?? []) as Array<{
        client_id: string;
        amount: number;
        paid_amount: number;
        currency: Currency;
      }>) {
        const entry = (map[c.client_id] ??= { byCurrency: {} });
        const cur = (entry.byCurrency[c.currency] ??= { total: 0, paid: 0 });
        cur.total += c.amount;
        cur.paid += Math.min(c.paid_amount, c.amount);
      }
      setDebts(map);
    });
  }, [configured, page, search, sort]);

  // Build the export rows on demand (every client, per-currency debt), fed
  // to the Excel/PDF menu.
  const getExportRows = async () => {
    const supabase = createClient();
    const all: Client[] = [];
    const stepSize = 1000;
    for (let from = 0; ; from += stepSize) {
      const { data } = await supabase
        .schema("crm")
        .from("clients")
        .select("id, name, phone, email")
        .order("name")
        .range(from, from + stepSize - 1);
      const chunk = (data ?? []) as Client[];
      all.push(...chunk);
      if (chunk.length < stepSize) break;
    }
    const { data: contractRows } = await supabase
      .schema("crm")
      .from("contracts")
      .select("client_id, amount, paid_amount, currency, status")
      .neq("status", "cancelled");
    const byClient: Record<string, { count: number; tjsPaid: number; tjsDebt: number; usdPaid: number; usdDebt: number }> = {};
    for (const c of (contractRows ?? []) as Array<{ client_id: string; amount: number; paid_amount: number; currency: Currency }>) {
      const e = (byClient[c.client_id] ??= { count: 0, tjsPaid: 0, tjsDebt: 0, usdPaid: 0, usdDebt: 0 });
      e.count += 1;
      const paid = Math.min(c.paid_amount, c.amount);
      const debt = Math.max(0, c.amount - c.paid_amount);
      if (c.currency === "USD") { e.usdPaid += paid; e.usdDebt += debt; }
      else { e.tjsPaid += paid; e.tjsDebt += debt; }
    }
    const num = (v: number) => (v ? v.toFixed(2).replace(".", ",") : "");
    return all.map((cl) => {
      const e = byClient[cl.id];
      return [cl.name, cl.phone ?? "", cl.email ?? "", e?.count ?? 0, num(e?.tjsPaid ?? 0), num(e?.tjsDebt ?? 0), num(e?.usdPaid ?? 0), num(e?.usdDebt ?? 0)];
    });
  };

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.clients.title}</h1>
        <div className="flex items-center gap-2">
          <ExportMenu
            getData={getExportRows}
            headers={[
              t.clients.table.name,
              t.clients.table.phone,
              t.clients.form.email,
              t.clients.stats.bought,
              "Оплачено TJS",
              "Долг TJS",
              "Оплачено USD",
              "Долг USD",
            ]}
            filenameBase="clients"
            title={t.clients.title}
          />
          <Link
            href="/clients/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md active:scale-[0.98]"
          >
            + {t.clients.newClient}
          </Link>
        </div>
      </div>

      {!configured && <SetupNotice />}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t.clients.search}
          className="h-10 min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        {/* Sort pills: a small segmented control with a sort glyph. */}
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <span className="pl-2 pr-1 text-slate-400" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M3 6h13M3 12h9M3 18h5M17 8l3-3 3 3M20 5v14" /></svg>
          </span>
          {(
            [
              { id: "new", label: t.clients.sort.newest },
              { id: "old", label: t.clients.sort.oldest },
              { id: "az", label: t.clients.sort.az },
              { id: "za", label: t.clients.sort.za },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSort(opt.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                sort === opt.id
                  ? "bg-brand-strong text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-up overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t.clients.table.name}</th>
              <th className="px-4 py-3 font-medium">{t.clients.table.phone}</th>
              <th className="px-4 py-3 font-medium">{t.clients.form.email}</th>
              <th className="w-56 px-4 py-3 font-medium">{t.clients.stats.debt}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {t.common.loading}
                </td>
              </tr>
            )}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {t.clients.empty}
                </td>
              </tr>
            )}
            {clients.map((client) => (
              <tr
                key={client.id}
                className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/clients/${client.id}`} className="block">
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{client.phone || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{client.email || "—"}</td>
                <td className="px-4 py-3">
                  <Link href={`/clients/${client.id}`} className="block">
                    <DebtBar debt={debts[client.id]} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

// The debt cell: one bar per currency (TJS and USD don't mix into one
// percentage), green fill = share paid, red figure = what's still owed.
function DebtBar({ debt }: { debt: ClientDebt | undefined }) {
  if (!debt) return <span className="text-slate-300">—</span>;
  const entries = Object.entries(debt.byCurrency).filter(([, v]) => v.total > 0);
  if (entries.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([currency, v]) => {
        const pct = Math.min(100, Math.round((v.paid / v.total) * 100));
        const remaining = Math.max(0, v.total - v.paid);
        return (
          <div key={currency}>
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className={pct === 100 ? "font-semibold text-emerald-600" : "text-slate-400"}>
                {pct}%
              </span>
              {remaining > 0 ? (
                <span className="font-semibold text-rose-600">
                  −{formatCurrency(remaining, currency as Currency)}
                </span>
              ) : (
                <span className="font-semibold text-emerald-600">✓</span>
              )}
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  pct === 100
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
