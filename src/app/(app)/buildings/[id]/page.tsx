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
import { Modal } from "@/components/Modal";
import { ContractForm } from "@/components/ContractForm";
import type { Building, BuildingInput } from "@/lib/buildings/types";
import type { PropertyObject } from "@/lib/objects/types";
import type { ContractInput } from "@/lib/contracts/types";

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
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genFloors, setGenFloors] = useState("");
  const [genUnitsPerFloor, setGenUnitsPerFloor] = useState("");
  const [genArea, setGenArea] = useState("");
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
        .select("object_id, amount, paid_amount, client:clients(name)")
        .in(
          "object_id",
          unitRows.map((u) => u.id)
        );
      const map: Record<string, UnitContractInfo> = {};
      for (const c of (contracts ?? []) as unknown as Array<{
        object_id: string;
        amount: number;
        paid_amount: number;
        client: { name: string } | null;
      }>) {
        map[c.object_id] = {
          clientName: c.client?.name ?? "—",
          remaining: c.amount - c.paid_amount,
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
          setGenFloors(b.floors_count?.toString() ?? "");
          setGenUnitsPerFloor(b.units_per_floor?.toString() ?? "");
        }
      });
    loadUnits();
  }, [configured, params.id, loadUnits]);

  const handleSubmit = async (values: BuildingInput) => {
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
    const supabase = createClient();
    await supabase.schema("crm").from("buildings").delete().eq("id", params.id);
    router.push("/buildings");
  };

  const handleGenerate = async () => {
    const floors = Number(genFloors);
    const perFloor = Number(genUnitsPerFloor);
    if (!floors || !perFloor) return;

    setGenerating(true);
    const area = genArea ? Number(genArea) : null;
    const price = area && building?.price_per_sqm ? area * building.price_per_sqm : null;
    const occupied = new Set(units.map((u) => `${u.floor}-${u.position_in_floor}`));
    const toCreate: Array<Record<string, unknown>> = [];
    for (let floor = 1; floor <= floors; floor++) {
      for (let position = 1; position <= perFloor; position++) {
        if (occupied.has(`${floor}-${position}`)) continue;
        toCreate.push({
          name: `№${floor}-${position}`,
          type: "apartment",
          status: "available",
          building_id: params.id,
          floor,
          position_in_floor: position,
          area,
          price,
        });
      }
    }

    if (toCreate.length > 0) {
      const supabase = createClient();
      await supabase.schema("crm").from("objects").insert(toCreate);
      await loadUnits();
    }
    setGenerating(false);
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
        name: `№${unitA.floor}-${unitA.position_in_floor}-${unitB.position_in_floor}`,
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
            initial={{
              name: building.name,
              address: building.address ?? "",
              floors_count: building.floors_count?.toString() ?? "",
              units_per_floor: building.units_per_floor?.toString() ?? "",
              price_per_sqm: building.price_per_sqm?.toString() ?? "",
              facade_url: building.facade_url ?? "",
              plan_url: building.plan_url ?? "",
            }}
            submitting={submitting}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
          />

          <div className="flex max-w-xl flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{t.buildings.generateMatrixHint}</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">
                  {t.buildings.form.floorsCount}
                </span>
                <input
                  type="number"
                  min="1"
                  value={genFloors}
                  onChange={(e) => setGenFloors(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">
                  {t.buildings.form.unitsPerFloor}
                </span>
                <input
                  type="number"
                  min="1"
                  value={genUnitsPerFloor}
                  onChange={(e) => setGenUnitsPerFloor(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">
                  {t.buildings.defaultArea}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={genArea}
                  onChange={(e) => setGenArea(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {t.buildings.generate}
            </button>
          </div>

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
