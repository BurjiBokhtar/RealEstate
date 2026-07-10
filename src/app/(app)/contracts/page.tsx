"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { CONTRACT_STATUS_COLORS } from "@/lib/contracts/format";
import { formatCurrency } from "@/lib/currency";
import {
  CONTRACT_STATUSES,
  type Contract,
  type ContractStatus,
} from "@/lib/contracts/types";

type ContractRow = Contract & {
  client: { name: string } | null;
  object: { name: string } | null;
};

export default function ContractsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();

  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "all">("all");

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("contracts")
      .select("*, client:clients(name), object:objects(name)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setContracts((data ?? []) as unknown as ContractRow[]);
        setLoading(false);
      });
  }, [configured]);

  const filtered = useMemo(() => {
    return contracts.filter((c) => statusFilter === "all" || c.status === statusFilter);
  }, [contracts, statusFilter]);

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

      <div className="flex flex-wrap gap-3">
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
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t.contracts.empty}
                </td>
              </tr>
            )}
            {filtered.map((contract) => (
              <tr
                key={contract.id}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/contracts/${contract.id}`} className="block">
                    {contract.number || "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{contract.client?.name ?? "—"}</td>
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
    </div>
  );
}
