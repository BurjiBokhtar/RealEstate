"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { BuildingForm } from "@/components/BuildingForm";
import { FloorUnitsBuilder } from "@/components/FloorUnitsBuilder";
import { useRole } from "@/lib/auth/useRole";
import type { Building, BuildingInput } from "@/lib/buildings/types";
import { emptyBuildingInput } from "@/lib/buildings/types";
import type { PropertyObject } from "@/lib/objects/types";

export default function EditBuildingPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();
  const { role, loading: roleLoading } = useRole();

  const [building, setBuilding] = useState<Building | null | undefined>(undefined);
  const [values, setValues] = useState<BuildingInput>(emptyBuildingInput);
  const [units, setUnits] = useState<PropertyObject[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadUnits = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("objects")
      .select("*")
      .eq("building_id", params.id);
    setUnits((data ?? []) as PropertyObject[]);
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
    router.push(`/buildings/${params.id}`);
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
    router.push("/objects");
  };

  if (!roleLoading && role !== "admin") {
    return (
      <div className="flex flex-col gap-3">
        <Link
          href={`/buildings/${params.id}`}
          className="w-fit text-sm text-slate-500 hover:text-slate-900"
        >
          ← {t.buildings.backToList}
        </Link>
        <p className="text-slate-500">{t.users.accessDenied}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/buildings/${params.id}`}
        className="w-fit text-sm text-slate-500 hover:text-slate-900"
      >
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
          {/* Floors count / units-per-floor are hidden: they assume the same
              number of units on every floor, which is wrong for multi-entrance
              buildings. The real structure is defined by the constructor below
              (blocks + floor ranges + per-range type). */}
          <BuildingForm
            values={values}
            onChange={setValues}
            submitting={submitting}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            hideFloorsCount
            hideUnitsPerFloor
          />
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

          <FloorUnitsBuilder
            buildingId={building.id}
            pricePerSqm={building.price_per_sqm}
            existingUnits={units}
            onGenerated={loadUnits}
          />
        </>
      )}
    </div>
  );
}
