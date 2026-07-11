"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { Pagination } from "@/components/Pagination";
import { CONTRACT_STATUS_COLORS } from "@/lib/contracts/format";
import { formatCurrency } from "@/lib/currency";
import {
  CONTRACT_STATUSES,
  type Contract,
  type ContractStatus,
} from "@/lib/contracts/types";

const PAGE_SIZE = 25;

type ContractRow = Contract & {
  client: { name: string; source: string | null } | null;
  object: { name: string } | null;
};

export default function ContractsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();

  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "all">("all");
  const [showQuickBookings, setShowQuickBookings] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, showQuickBookings]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    setLoading(true);

    // "!inner" forces the client join to actually filter parent rows (a
    // plain embedded select only filters the embedded object, not which
    // contracts come back) -- needed to hide the placeholder "quick
    // booking" contracts by default so a front-desk quick reservation
    // doesn't look like clutter in the main contracts list before anyone's
    // filled in the real buyer.
    let query = supabase
      .schema("crm")
      .from("contracts")
      .select("*, client:clients!inner(name, source), object:objects(name)", {
        count: "exact",
      });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (!showQuickBookings) query = query.neq("client.source", "quick_booking");
    const from = (page - 1) * PAGE_SIZE;
    query = query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);

    query.then(({ data, count }) => {
      setContracts((data ?? []) as unknown as ContractRow[]);
      setTotalCount(count ?? 0);
      setLoading(false);
    });
  }, [configured, page, statusFilter, showQuickBookings]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.contracts.title}</h1>
        <Link
          href="/contracts/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + {t.contracts.newContract}
        </Link>
      </div>

      {!configured && <SetupNotice />}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ContractStatus | "all")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">{t.contracts.filters.allStatuses}</option>
          {CONTRACT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.contracts.statuses[status]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showQuickBookings}
            onChange={(e) => setShowQuickBookings(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          {t.contracts.filters.showQuickBookings}
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t.contracts.table.number}</th>
              <th className="px-4 py-3 font-medium">{t.contracts.table.client}</th>
              <th className="px-4 py-3 font-medium">{t.contracts.table.object}</th>
              <th className="px-4 py-3 font-medium">{t.contracts.table.amount}</th>
              <th className="px-4 py-3 font-medium">{t.contracts.table.paid}</th>
              <th className="px-4 py-3 font-medium">{t.contracts.table.status}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t.common.loading}
                </td>
              </tr>
            )}
            {!loading && contracts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t.contracts.empty}
                </td>
              </tr>
            )}
            {contracts.map((contract) => (
              <tr
                key={contract.id}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/contracts/${contract.id}`} className="block">
                    {contract.number || "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {contract.client?.source === "quick_booking" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        {t.contracts.badges.quickBooking}
                      </span>
                    </span>
                  ) : (
                    contract.client?.name ?? "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{contract.object?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatCurrency(contract.amount, contract.currency)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatCurrency(contract.paid_amount, contract.currency)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONTRACT_STATUS_COLORS[contract.status]}`}
                  >
                    {t.contracts.statuses[contract.status]}
                  </span>
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
