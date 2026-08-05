"use client";

import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ContractPayments } from "@/components/ContractPayments";
import { ContractTabs } from "@/components/ContractTabs";
import { SendActions } from "@/components/SendActions";
import { ClientIdentity } from "@/components/ClientIdentity";
import { StatTileRow } from "@/components/StatTile";
import { formatCurrency } from "@/lib/currency";
import { CONTRACT_STATUS_COLORS } from "@/lib/contracts/format";
import type { Contract } from "@/lib/contracts/types";

type ContractWithRelations = Contract & {
  client: { name: string; phone: string | null } | null;
  object: { name: string; building: { name: string } | null } | null;
};

// The cash desk: one screen for everyday money work on a contract --
// reached with one click from a booked shakhmatka cell or the client card.
// Stat tiles up top say the state of the deal at a glance; the left column
// is the working area (record a payment, print/send receipts); the right
// keeps who's paying and the contract-level shortcuts one tap away.
export default function ContractPaymentsPage() {
  const { t } = useLocale();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  const [contract, setContract] = useState<ContractWithRelations | null | undefined>(undefined);

  const loadContract = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("contracts")
      .select("*, client:clients(name, phone), object:objects(name, building:buildings(name))")
      .eq("id", params.id)
      .maybeSingle();
    setContract((data as unknown as ContractWithRelations) ?? null);
  }, [params.id]);

  useEffect(() => {
    if (!configured) {
      setContract(null);
      return;
    }
    loadContract();
  }, [configured, loadContract]);

  const remaining = contract ? Math.max(contract.amount - contract.paid_amount, 0) : 0;
  const paidPct =
    contract && contract.amount > 0
      ? Math.min(Math.round((contract.paid_amount / contract.amount) * 100), 100)
      : 0;

  const tiles = contract
    ? [
        {
          label: t.contracts.form.amount,
          value: formatCurrency(contract.amount, contract.currency),
          tone: "text-slate-900",
        },
        {
          label: t.contracts.form.paidAmount,
          value: formatCurrency(contract.paid_amount, contract.currency),
          tone: "text-emerald-600",
        },
        {
          label: t.buildings.hover.remaining,
          value: remaining > 0 ? formatCurrency(remaining, contract.currency) : "0",
          tone: remaining > 0 ? "text-rose-600" : "text-emerald-600",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      {contract?.client_id ? (
        <Link
          href={`/clients/${contract.client_id}`}
          className="w-fit text-sm text-slate-500 hover:text-slate-900"
        >
          ← {t.contracts.backToClient}
        </Link>
      ) : (
        <BackLink href="/clients">{t.clients.backToList}</BackLink>
      )}

      {contract && <ContractTabs id={params.id} active="payments" />}

      {!configured && <SetupNotice />}

      {configured && contract === undefined && (
        <p className="text-slate-400">{t.common.loading}</p>
      )}
      {configured && contract === null && (
        <p className="text-slate-400">{t.contracts.notFound}</p>
      )}

      {contract && (
        <>
          {/* Header: which deal this is + the two everyday actions */}
          <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h1 className="text-2xl font-semibold leading-tight">
                  {t.contracts.cashier.title}
                </h1>
                <p className="text-sm text-slate-500">
                  {contract.number ? `№${contract.number} · ` : ""}
                  {contract.object?.name ?? "—"}
                  {contract.object?.building && ` · ${contract.object.building.name}`}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONTRACT_STATUS_COLORS[contract.status]}`}
              >
                {t.contracts.statuses[contract.status]}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SendActions
                contractId={params.id}
                kind="contract"
                printAction={{
                  href: `/contracts/${params.id}/print`,
                  label: t.clients.purchases.printContract,
                }}
              />
              <Link
                href={`/contracts/${params.id}`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                {t.contracts.cashier.editFull}
              </Link>
            </div>
          </div>

          {/* Deal state at a glance -- same tile language as the client page */}
          <StatTileRow tiles={tiles} />

          <div
            className="animate-fade-up flex flex-col gap-1.5"
            style={{ animationDelay: "150ms" }}
          >
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
                style={{ width: `${paidPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {t.contracts.form.paidAmount}: {paidPct}%
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
            <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
              <ContractPayments contract={contract} onPaymentAdded={loadContract} />
            </div>

            <div
              className="animate-fade-up flex flex-col gap-5 xl:sticky xl:top-5"
              style={{ animationDelay: "250ms" }}
            >
              {/* Who's paying */}
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <ClientIdentity
                  name={contract.client?.name ?? "—"}
                  phone={contract.client?.phone}
                  href={`/clients/${contract.client_id}`}
                  size="md"
                />
                <Link
                  href={`/clients/${contract.client_id}`}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  {t.contracts.backToClient} →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
