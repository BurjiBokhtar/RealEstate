"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ContractDocument } from "@/components/ContractDocument";
import type { Contract, ContractPayment } from "@/lib/contracts/types";

type ContractWithRelations = Contract & {
  client: {
    name: string;
    phone: string | null;
    passport: string | null;
    passport_issued_by: string | null;
    birth_date: string | null;
    address: string | null;
  } | null;
  object: {
    name: string;
    address: string | null;
    area: number | null;
    building: { address: string | null; price_per_sqm: number | null } | null;
  } | null;
};

export default function ContractPrintPage() {
  const { t } = useLocale();
  const params = useParams<{ id: string }>();
  const [contract, setContract] = useState<ContractWithRelations | null | undefined>(
    undefined
  );
  const [payments, setPayments] = useState<ContractPayment[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("contracts")
      .select(
        "*, client:clients(name, phone, passport, passport_issued_by, birth_date, address), object:objects(name, address, area, building:buildings(address, price_per_sqm))"
      )
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => setContract((data as unknown as ContractWithRelations) ?? null));
    supabase
      .schema("crm")
      .from("contract_payments")
      .select("*")
      .eq("contract_id", params.id)
      .order("due_date", { ascending: true })
      .then(({ data }) => setPayments((data ?? []) as ContractPayment[]));
  }, [params.id]);

  if (contract === undefined) return <p className="text-slate-400">{t.common.loading}</p>;
  if (contract === null) return <p className="text-slate-400">{t.contracts.notFound}</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6 print:py-0">
      <button
        type="button"
        onClick={() => window.print()}
        className="w-fit self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 print:hidden"
      >
        {t.contracts.print.button}
      </button>

      {/* Each copy is a full document in its own right (not a shared half
          page like a receipt), so it gets its own printed page -- no cut
          line between them, that only makes sense when two copies share
          one sheet. */}
      <div id="contract-print-area" className="flex flex-col gap-10 print:gap-0">
        <div className="print:break-after-page">
          <ContractDocument
            contract={contract}
            payments={payments}
            copyLabel={t.contracts.receipt.copyForClient}
          />
        </div>
        <ContractDocument
          contract={contract}
          payments={payments}
          copyLabel={t.contracts.receipt.copyForCompany}
        />
      </div>
    </div>
  );
}
