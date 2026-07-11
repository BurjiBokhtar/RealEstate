"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ShakhmatkaGrid, type UnitContractInfo } from "@/components/ShakhmatkaGrid";
import { Modal } from "@/components/Modal";
import { ContractForm } from "@/components/ContractForm";
import type { Building } from "@/lib/buildings/types";
import type { PropertyObject } from "@/lib/objects/types";
import type { ContractInput } from "@/lib/contracts/types";
import { useRole } from "@/lib/auth/useRole";
import { formatCurrency } from "@/lib/currency";
import { formatArea } from "@/lib/objects/format";

export default function BuildingDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  const [building, setBuilding] = useState<Building | null | undefined>(undefined);
  const [units, setUnits] = useState<PropertyObject[]>([]);
  const [contractsByUnit, setContractsByUnit] = useState<Record<string, UnitContractInfo>>(
    {}
  );
  const [bookingUnit, setBookingUnit] = useState<PropertyObject | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [viewingUnit, setViewingUnit] = useState<PropertyObject | null>(null);
  const { role } = useRole();

  const loadUnits = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("objects")
      .select("*")
      .eq("building_id", params.id);
    const unitRows = (data ?? []) as PropertyObject[];
    setUnits(unitRows);

    if (unitRows.length > 0) {
      const { data: contracts } = await supabase
        .schema("crm")
        .from("contracts")
        .select("object_id, amount, paid_amount, currency, client:clients(name)")
        .in(
          "object_id",
          unitRows.map((u) => u.id)
        );
      const map: Record<string, UnitContractInfo> = {};
      for (const c of (contracts ?? []) as unknown as Array<{
        object_id: string;
        amount: number;
        paid_amount: number;
        currency: UnitContractInfo["currency"];
        client: { name: string } | null;
      }>) {
        map[c.object_id] = {
          clientName: c.client?.name ?? "—",
          remaining: c.amount - c.paid_amount,
          currency: c.currency,
        };
      }
      setContractsByUnit(map);
    }
  }, [params.id]);

  useEffect(() => {
    if (!configured) {
      setBuilding(null);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("buildings")
      .select("*")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => setBuilding((data as Building) ?? null));
    loadUnits();
  }, [configured, params.id, loadUnits]);

  const handleMergeUnits = async (unitA: PropertyObject, unitB: PropertyObject) => {
    const combinedArea = (unitA.area ?? 0) + (unitB.area ?? 0) || null;
    const combinedPrice =
      combinedArea && building?.price_per_sqm
        ? combinedArea * building.price_per_sqm
        : (unitA.price ?? 0) + (unitB.price ?? 0) || null;
    const supabase = createClient();
    await supabase
      .schema("crm")
      .from("objects")
      .update({
        name: unitA.block
          ? `${unitA.block} №${unitA.floor}-${unitA.position_in_floor}-${unitB.position_in_floor}`
          : `№${unitA.floor}-${unitA.position_in_floor}-${unitB.position_in_floor}`,
        area: combinedArea,
        price: combinedPrice,
        span: (unitA.span || 1) + (unitB.span || 1),
      })
      .eq("id", unitA.id);
    await supabase.schema("crm").from("objects").delete().eq("id", unitB.id);
    await loadUnits();
  };

  const handleBookingSubmit = async (values: ContractInput) => {
    if (!bookingUnit) return;
    setBookingSubmitting(true);
    setBookingError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("crm")
      .from("contracts")
      .insert({
        number: values.number || null,
        client_id: values.client_id,
        object_id: values.object_id,
        amount: values.amount ? Number(values.amount) : 0,
        paid_amount: values.paid_amount ? Number(values.paid_amount) : 0,
        currency: values.currency,
        amount_words: values.amount_words || null,
        status: values.status,
        signed_date: values.signed_date || null,
        notes: values.notes || null,
        payment_type: values.payment_type,
        installment_months: values.installment_months
          ? Number(values.installment_months)
          : null,
        barter_details: values.barter_details || null,
      })
      .select("id")
      .single();

    if (!error && data) {
      // Object status (available/reserved/sold) is derived automatically by
      // a DB trigger from the contract's paid_amount -- no manual update
      // needed here, and setting it here would race with that trigger.
      const paidAmount = values.paid_amount ? Number(values.paid_amount) : 0;
      if (paidAmount > 0) {
        const paidDate = values.signed_date || new Date().toISOString().slice(0, 10);
        await supabase.schema("crm").from("contract_payments").insert({
          contract_id: data.id,
          due_date: paidDate,
          amount: paidAmount,
          paid: true,
          paid_date: paidDate,
        });
      }

      router.push(`/contracts/${data.id}`);
      return;
    }
    setBookingError(error?.message ?? t.common.error);
    setBookingSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/buildings" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.buildings.backToList}
      </Link>

      {!configured && <SetupNotice />}

      {configured && building === undefined && (
        <p className="text-slate-400">{t.common.loading}</p>
      )}
      {configured && building === null && (
        <p className="text-slate-400">{t.buildings.notFound}</p>
      )}

      {building && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{building.name}</h1>
              {building.address && <p className="text-sm text-slate-500">{building.address}</p>}
            </div>
            {role === "admin" && (
              <Link
                href={`/buildings/${building.id}/edit`}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t.buildings.configure}
              </Link>
            )}
          </div>

          <ShakhmatkaGrid
            units={units}
            contractsByUnit={contractsByUnit}
            onBookUnit={setBookingUnit}
            onMergeUnits={handleMergeUnits}
            canEditSold={role === "admin"}
            onViewUnit={setViewingUnit}
          />

          {bookingUnit && (
            <Modal
              title={t.buildings.bookUnit}
              onClose={() => {
                setBookingUnit(null);
                setBookingError(null);
              }}
            >
              <ContractForm
                initial={{
                  object_id: bookingUnit.id,
                  amount: bookingUnit.price?.toString() ?? "",
                  currency: bookingUnit.currency,
                }}
                submitting={bookingSubmitting}
                onSubmit={handleBookingSubmit}
              />
              {bookingError && <p className="mt-2 text-sm text-red-600">{bookingError}</p>}
            </Modal>
          )}

          {viewingUnit && (
            <Modal title={viewingUnit.name} onClose={() => setViewingUnit(null)}>
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-xs text-slate-400">{t.buildings.viewOnlyHint}</p>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.objects.form.status}</span>
                  <span className="font-medium text-slate-900">
                    {t.buildings.legend[viewingUnit.status]}
                  </span>
                </div>
                {viewingUnit.rooms != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t.buildings.hover.rooms}</span>
                    <span className="font-medium text-slate-900">{viewingUnit.rooms}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.buildings.hover.area}</span>
                  <span className="font-medium text-slate-900">
                    {formatArea(viewingUnit.area)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.buildings.hover.price}</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(viewingUnit.price, viewingUnit.currency)}
                  </span>
                </div>
                {contractsByUnit[viewingUnit.id] && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t.buildings.hover.owner}</span>
                      <span className="font-medium text-slate-900">
                        {contractsByUnit[viewingUnit.id].clientName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t.buildings.hover.remaining}</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(
                          contractsByUnit[viewingUnit.id].remaining,
                          contractsByUnit[viewingUnit.id].currency
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
