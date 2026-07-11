"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { Pagination } from "@/components/Pagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { LEAD_STATUS_COLORS } from "@/lib/clients/format";
import { LEAD_STATUSES, type Client, type LeadStatus } from "@/lib/clients/types";

const PAGE_SIZE = 25;

export default function ClientsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();

  const [clients, setClients] = useState<Client[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    setLoading(true);

    let query = supabase.schema("crm").from("clients").select("*", { count: "exact" });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (search.trim()) {
      const q = search.trim();
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    }
    const from = (page - 1) * PAGE_SIZE;
    query = query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);

    query.then(({ data, count }) => {
      setClients((data ?? []) as Client[]);
      setTotalCount(count ?? 0);
      setLoading(false);
    });
  }, [configured, page, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.clients.title}</h1>
        <Link
          href="/clients/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + {t.clients.newClient}
        </Link>
      </div>

      {!configured && <SetupNotice />}

      <div className="flex flex-wrap gap-3">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t.clients.search}
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">{t.clients.filters.allStatuses}</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.clients.statuses[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t.clients.table.name}</th>
              <th className="px-4 py-3 font-medium">{t.clients.table.phone}</th>
              <th className="px-4 py-3 font-medium">{t.clients.table.status}</th>
              <th className="px-4 py-3 font-medium">{t.clients.table.source}</th>
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
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/clients/${client.id}`} className="block">
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{client.phone || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${LEAD_STATUS_COLORS[client.status]}`}
                  >
                    {t.clients.statuses[client.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{client.source || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
