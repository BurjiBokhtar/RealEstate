"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { BuildingForm } from "@/components/BuildingForm";
import { ShakhmatkaGrid, type UnitContractInfo } from "@/components/ShakhmatkaGrid";
import { FloorUnitsBuilder } from "@/components/FloorUnitsBuilder";
import { Modal } from "@/components/Modal";
import { ContractForm } from "@/components/ContractForm";
import type { Building, BuildingInput } from "@/lib/buildings/types";
import { emptyBuildingInput } from "@/lib/buildings/types";
import type { PropertyObject } from "@/lib/objects/types";
import type { ContractInput } from "@/lib/contracts/types";

export default function BuildingDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  const [building, setBuilding] = useState<Building | null | undefined>(undefined);
  const [values, setValues] = useState<BuildingInput>(emptyBuildingInput);
  const [units, setUnits] = useState<PropertyObject[]>([]);
  const [contractsByUnit, setContractsByUnit] = useState<Record<string, UnitContractInfo>>(
    {}
  );
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bookingUnit, setBookingUnit] = useState<PropertyObject | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

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
      .then(({ data }) => {
        const b = (data as Building) ?? null;
        setBuilding(b);
        if (b) {
          setValues({
            name: b.name,
            address: b.address ?? "",
            floors_count: b.floors_count?.toString() ?? "",
            units_per_floor: b.units_per_floor?.toString() ?? "",
            price_per_sqm: b.price_per_sqm?.toString() ?? "",
            facade_url: b.facade_url ?? "",
            plan_url: b.plan_url ?? "",
          });
        }
      });
    loadUnits();
  }, [configured, params.id, loadUnits]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const supabase = createClient();
    await supabase
      .schema("crm")
      .from("buildings")
      .update({
        name: values.name,
        address: values.address || null,
        floors_count: values.floors_count ? Number(values.floors_count) : null,
        units_per_floor: values.units_per_floor ? Number(values.units_per_floor) : null,
        price_per_sqm: values.price_per_sqm ? Number(values.price_per_sqm) : null,
        facade_url: values.facade_url || null,
        plan_url: values.plan_url || null,
      })
      .eq("id", params.id);
    setSubmitting(false);
    router.push("/buildings");
  };

  const handleDelete = async () => {
    if (!window.confirm(t.buildings.form.confirmDelete)) return;
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase.schema("crm").from("buildings").delete().eq("id", params.id);
    if (error) {
      setDeleteError(t.buildings.form.deleteBlocked);
      return;
    }
    router.push("/buildings");
  };

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
      await supabase
        .schema("crm")
        .from("objects")
        .update({ status: "reserved" })
        .eq("id", values.object_id);
      router.push(`/contracts/${data.id}`);
      return;
    }
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
          <h1 className="text-2xl font-semibold">{building.name}</h1>
          <BuildingForm
            values={values}
            onChange={setValues}
            submitting={submitting}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
          />
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

          <FloorUnitsBuilder
            buildingId={building.id}
            pricePerSqm={building.price_per_sqm}
            existingUnits={units}
            onGenerated={loadUnits}
          />

          <ShakhmatkaGrid
            units={units}
            contractsByUnit={contractsByUnit}
            onBookUnit={setBookingUnit}
            onMergeUnits={handleMergeUnits}
          />

          {bookingUnit && (
            <Modal title={t.buildings.bookUnit} onClose={() => setBookingUnit(null)}>
              <ContractForm
                initial={{
                  object_id: bookingUnit.id,
                  amount: bookingUnit.price?.toString() ?? "",
                  currency: bookingUnit.currency,
                }}
                submitting={bookingSubmitting}
                onSubmit={handleBookingSubmit}
              />
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
