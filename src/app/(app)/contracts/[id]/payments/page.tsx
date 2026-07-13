"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ContractPayments } from "@/components/ContractPayments";
import { formatCurrency } from "@/lib/currency";
import type { Contract } from "@/lib/contracts/types";

type ContractWithRelations = Contract & {
  client: { name: string; phone: string | null } | null;
  object: { name: string; building: { name: string } | null } | null;
};

// A lean "cash desk" view: just who's paying, for which unit, how much is
// left, and the payment/receipt controls -- reached with one click from a
// booked cell on the shakhmatka, without wading through the full contract
// edit form (which most staff can't save anyway -- editing a contract is
// admin-only, while recording a payment is routine work for everyone).
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

  const remaining = contract ? contract.amount - contract.paid_amount : 0;

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
        <Link href="/clients" className="w-fit text-sm text-slate-500 hover:text-slate-900">
          ← {t.clients.backToList}
        </Link>
      )}

      {!configured && <SetupNotice />}

      {configured && contract === undefined && (
        <p className="text-slate-400">{t.common.loading}</p>
      )}
      {configured && contract === null && (
        <p className="text-slate-400">{t.contracts.notFound}</p>
      )}

      {contract && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{t.contracts.cashier.title}</h1>
              <p className="text-sm text-slate-500">{t.contracts.cashier.subtitle}</p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/contracts/${params.id}/print`}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t.contracts.print.button}
              </Link>
              <Link
                href={`/contracts/${params.id}`}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t.contracts.cashier.editFull}
              </Link>
            </div>
          </div>

          <div className="grid max-w-xl grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.contracts.table.number}
              </span>
              <span className="font-medium text-slate-900">{contract.number || "—"}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.contracts.form.status}
              </span>
              <span className="font-medium text-slate-900">
                {t.contracts.statuses[contract.status]}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.contracts.form.client}
              </span>
              <Link
                href={`/clients/${contract.client_id}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {contract.client?.name ?? "—"}
              </Link>
              {contract.client?.phone && (
                <span className="text-xs text-slate-500">{contract.client.phone}</span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.contracts.form.object}
              </span>
              <span className="font-medium text-slate-900">{contract.object?.name ?? "—"}</span>
              {contract.object?.building && (
                <span className="text-xs text-slate-500">{contract.object.building.name}</span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.contracts.form.amount}
              </span>
              <span className="font-medium text-slate-900">
                {formatCurrency(contract.amount, contract.currency)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.contracts.form.paidAmount}
              </span>
              <span className="font-medium text-emerald-600">
                {formatCurrency(contract.paid_amount, contract.currency)}
              </span>
            </div>
            <div className="col-span-2 flex flex-col gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {t.buildings.hover.remaining}
              </span>
              <span className="font-semibold text-amber-600">
                {formatCurrency(remaining, contract.currency)}
              </span>
            </div>
          </div>

          <ContractPayments contract={contract} onPaymentAdded={loadContract} />
        </>
      )}
    </div>
  );
}
