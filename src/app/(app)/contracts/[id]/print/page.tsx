"use client";

import { COPY_FOR_CLIENT, COPY_FOR_COMPANY } from "@/lib/contracts/copyLabels";
import { printDocument } from "@/lib/print";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ContractDocument } from "@/components/ContractDocument";
import { ContractTabs } from "@/components/ContractTabs";
import { computeApartmentNumbers } from "@/lib/buildings/apartmentNumbers";
import type { PropertyObject } from "@/lib/objects/types";
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
    id: string;
    building_id: string | null;
    name: string;
    address: string | null;
    area: number | null;
    floor: number | null;
    block: string | null;
    rooms: number | null;
    building: { name: string; address: string | null; price_per_sqm: number | null } | null;
  } | null;
};

export default function ContractPrintPage() {
  const { t } = useLocale();
  const params = useParams<{ id: string }>();
  const [contract, setContract] = useState<ContractWithRelations | null | undefined>(
    undefined
  );
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [apartmentNumber, setApartmentNumber] = useState<number | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("contracts")
      .select(
        "*, client:clients(name, phone, passport, passport_issued_by, birth_date, address), object:objects(id, name, address, area, floor, block, rooms, building_id, building:buildings(name, address, price_per_sqm))"
      )
      .eq("id", params.id)
      .maybeSingle()
      .then(async ({ data }) => {
        const row = (data as unknown as ContractWithRelations) ?? null;
        setContract(row);
        // The apartment number printed on the contract ("ҳуҷраи №157") isn't
        // stored on the unit -- it's derived from where the unit sits in its
        // building's grid, so it has to be computed from the building's whole
        // unit list, exactly the way the shakhmatka does it.
        const buildingId = row?.object?.building_id;
        const objectId = row?.object?.id;
        if (!buildingId || !objectId) return;
        const { data: units } = await supabase
          .schema("crm")
          .from("objects")
          .select("*")
          .eq("building_id", buildingId);
        if (!units) return;
        setApartmentNumber(
          computeApartmentNumbers(units as PropertyObject[]).get(objectId)
        );
      });
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
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <ContractTabs id={params.id} active="print" />
        <button
          type="button"
          onClick={() => printDocument()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-[0.98]"
        >
          {t.contracts.print.button}
        </button>
      </div>

      {/* Each copy is a full document in its own right (not a shared half
          page like a receipt), so it gets its own printed page -- no cut
          line between them, that only makes sense when two copies share
          one sheet. */}
      <div id="contract-print-area" className="flex flex-col gap-10 print:gap-0">
        <div className="print:break-after-page">
          <ContractDocument
            contract={contract}
            payments={payments}
            apartmentNumber={apartmentNumber}
            copyLabel={COPY_FOR_CLIENT}
          />
        </div>
        <ContractDocument
          contract={contract}
          payments={payments}
          apartmentNumber={apartmentNumber}
          copyLabel={COPY_FOR_COMPANY}
        />
      </div>
    </div>
  );
}
