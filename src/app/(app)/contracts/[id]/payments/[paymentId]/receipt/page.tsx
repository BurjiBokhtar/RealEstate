"use client";

import { COPY_FOR_CLIENT, COPY_FOR_COMPANY } from "@/lib/contracts/copyLabels";
import { printDocument } from "@/lib/print";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { receiptNumberFor } from "@/lib/contracts/receiptNumber";
import { ReceiptDocument } from "@/components/ReceiptDocument";
import { SendActions } from "@/components/SendActions";
import { computeApartmentNumbers } from "@/lib/buildings/apartmentNumbers";
import type { PropertyObject } from "@/lib/objects/types";
import type { Contract, ContractPayment } from "@/lib/contracts/types";

type ContractWithRelations = Contract & {
  client: { name: string } | null;
  object: {
    id: string;
    building_id: string | null;
    name: string;
    area: number | null;
    floor: number | null;
    block: string | null;
  } | null;
};

export default function PaymentReceiptPage() {
  const { t } = useLocale();
  const { settings } = useSettings();
  const router = useRouter();
  const params = useParams<{ id: string; paymentId: string }>();
  const [contract, setContract] = useState<ContractWithRelations | null | undefined>(
    undefined
  );
  const [payment, setPayment] = useState<ContractPayment | null | undefined>(undefined);
  const [receiptNo, setReceiptNo] = useState<number | null>(null);
  const [apartmentNumber, setApartmentNumber] = useState<number | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("contracts")
      .select("*, client:clients(name), object:objects(id, building_id, name, area, floor, block)")
      .eq("id", params.id)
      .maybeSingle()
      .then(async ({ data }) => {
        const row = (data as unknown as ContractWithRelations) ?? null;
        setContract(row);
        // The receipt prints the building-wide apartment number, same as the
        // contract -- derived from the whole unit grid, not stored per unit.
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
      .eq("id", params.paymentId)
      .maybeSingle()
      .then(({ data }) => setPayment((data as ContractPayment) ?? null));
    supabase
      .schema("crm")
      .from("contract_payments")
      .select("id, due_date")
      .eq("contract_id", params.id)
      .then(({ data }) =>
        setReceiptNo(receiptNumberFor((data ?? []) as ContractPayment[], params.paymentId))
      );
  }, [params.id, params.paymentId]);

  if (contract === undefined || payment === undefined) {
    return <p className="text-slate-400">{t.common.loading}</p>;
  }
  if (contract === null || payment === null) {
    return <p className="text-slate-400">{t.contracts.notFound}</p>;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-6 print:max-w-none print:py-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98]"
        >
          ← {t.common.back}
        </button>
        <div className="flex items-center gap-2">
          <SendActions contractId={params.id} kind="receipt" paymentId={params.paymentId} />
          <button
            type="button"
            onClick={() => printDocument()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
          >
            🖨 {t.contracts.print.button}
          </button>
        </div>
      </div>

      {/* Both copies share one A4 sheet, so each gets exactly half its
          printable height (297mm minus the @page top/bottom margins) rather
          than however tall its own content happens to be -- otherwise a
          short receipt leaves the second copy nowhere near the fold, or a
          slightly taller one pushes it onto a second page. */}
      <div
        id="contract-print-area"
        className="mx-auto flex w-full max-w-md flex-col gap-4 print:h-[273mm] print:max-w-none print:gap-0"
      >
        <div className="print:flex print:h-1/2 print:flex-col print:justify-center print:overflow-hidden">
          <ReceiptDocument
            settings={settings}
            contract={contract}
            payment={payment}
            receiptNo={receiptNo}
            copyLabel={COPY_FOR_CLIENT}
            apartmentNumber={apartmentNumber}
          />
        </div>

        <div
          aria-hidden="true"
          className="flex items-center gap-2 text-slate-300 print:text-slate-400"
        >
          <span className="flex-1 border-t border-dashed border-current" />
          <span className="text-xs">✂</span>
          <span className="flex-1 border-t border-dashed border-current" />
        </div>

        <div className="print:flex print:h-1/2 print:flex-col print:justify-center print:overflow-hidden">
          <ReceiptDocument
            settings={settings}
            contract={contract}
            payment={payment}
            receiptNo={receiptNo}
            copyLabel={COPY_FOR_COMPANY}
            apartmentNumber={apartmentNumber}
          />
        </div>
      </div>
    </div>
  );
}
