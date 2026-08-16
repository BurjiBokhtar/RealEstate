"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { SetupNotice } from "@/components/SetupNotice";
import { BuildingForm } from "@/components/BuildingForm";
import { FloorUnitsBuilder } from "@/components/FloorUnitsBuilder";
import { useRole } from "@/lib/auth/useRole";
import type { Building, BuildingInput } from "@/lib/buildings/types";
import { emptyBuildingInput } from "@/lib/buildings/types";
import type { PropertyObject } from "@/lib/objects/types";

export default function EditBuildingPage() {
  const { t } = useLocale();
  const confirm = useConfirm();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();
  const { role, loading: roleLoading } = useRole();

  // Seeded from `configured` rather than set from inside the effect: the
  // flag is a build-time env check, constant for the whole session, so the
  // not-configured case is a starting value, not something to synchronise.
  const [building, setBuilding] = useState<Building | null | undefined>(
    configured ? undefined : null
  );
  const [values, setValues] = useState<BuildingInput>(emptyBuildingInput);
  const [units, setUnits] = useState<PropertyObject[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    if (!configured) return;
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
            construction_status: b.construction_status ?? "in_progress",
          });
        }
      });
    loadUnits();
  }, [configured, params.id, loadUnits]);

  const handleSubmit = async () => {
    const nextRate = values.price_per_sqm ? Number(values.price_per_sqm) : null;
    const rateChanged =
      nextRate != null && nextRate > 0 && nextRate !== (building?.price_per_sqm ?? null);

    // The rate used to reach the apartments only at the moment they were
    // generated, so changing it later moved one number in one row and the
    // shakhmatka went on showing the old totals. Ask before rewriting them:
    // an admin who came here to fix the address should not have the whole
    // price list recalculated behind their back. Saying no still saves the
    // new rate -- it then applies to apartments created from now on.
    // Clearing the field is the other half of the same idea, and it used to do
    // nothing at all: the rate went to NULL and every flat kept the price
    // computed from the rate that was there before -- a number with nothing
    // left behind it, still counted in the dashboard's potential. Offer to
    // take those prices away too. Sold flats keep theirs, and so do flats
    // priced in dollars, which never came from this (TJS) rate.
    const rateCleared = nextRate == null && (building?.price_per_sqm ?? null) != null;
    let clearPrices = false;
    if (rateCleared) {
      const affected = units.filter(
        (u) => u.status !== "sold" && u.currency === "TJS" && (u.price ?? 0) > 0
      );
      if (affected.length > 0) {
        clearPrices = await confirm(
          t.buildings.form.clearPricesConfirm.replace("{n}", String(affected.length)),
          { danger: true, confirmLabel: t.buildings.form.clearPricesBtn }
        );
      }
    }

    let reprice = false;
    if (rateChanged) {
      const affected = units.filter((u) => u.status !== "sold" && (u.area ?? 0) > 0);
      const sold = units.filter((u) => u.status === "sold");
      const noArea = units.filter((u) => u.status !== "sold" && !((u.area ?? 0) > 0));
      const message =
        t.buildings.form.repriceConfirm
          .replace("{n}", String(affected.length))
          .replace("{sold}", String(sold.length)) +
        (noArea.length
          ? t.buildings.form.repriceSkipped.replace("{skipped}", String(noArea.length))
          : "");
      reprice = await confirm(message, {
        confirmLabel: t.buildings.form.repriceConfirmBtn,
      });
    }

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
        price_per_sqm: nextRate,
        facade_url: values.facade_url || null,
        plan_url: values.plan_url || null,
        construction_status: values.construction_status,
      })
      .eq("id", params.id);

    let repricedCount: number | null = null;
    if (reprice && nextRate != null) {
      // One UPDATE inside the database. Each apartment's new total is its own
      // area times the shared rate, which REST cannot express -- it can only
      // write one ready-made value to every matching row -- so doing this
      // from here would mean one request per apartment.
      const { data, error } = await supabase.schema("crm").rpc("reprice_building_units", {
        p_building_id: params.id,
        p_price_per_sqm: nextRate,
      });
      if (error) {
        setSubmitting(false);
        // PGRST202 = PostgREST could not find the function. That means the
        // migration has not been run on this database, and it is worth saying
        // exactly that: the previous attempt at this feature (65fbb56) was
        // rolled back precisely because it appeared to do nothing and the
        // reason was never established.
        const missing = error.code === "PGRST202" || /Could not find the function/i.test(error.message);
        setSaveError(
          missing
            ? t.buildings.form.repriceNoFunction
            : t.buildings.form.repriceFailed.replace("{err}", error.message)
        );
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      repricedCount = Number(row?.repriced ?? 0);
    }

    let clearedCount: number | null = null;
    if (clearPrices) {
      // No database function needed here, unlike repricing: this writes the
      // same literal NULL to every matching row, which REST expresses fine.
      // The filter travels as a few query parameters, not as a list of ids,
      // so it does not grow with the building.
      const { error, count } = await supabase
        .schema("crm")
        .from("objects")
        .update({ price: null }, { count: "exact" })
        .eq("building_id", params.id)
        .neq("status", "sold")
        .eq("currency", "TJS");
      if (error) {
        setSubmitting(false);
        setSaveError(t.buildings.form.repriceFailed.replace("{err}", error.message));
        return;
      }
      clearedCount = count ?? 0;
    }

    setSubmitting(false);
    // The shakhmatka is where the new prices are actually visible, so it also
    // carries the confirmation of how many rows moved.
    const receipt =
      repricedCount != null
        ? `?repriced=${repricedCount}`
        : clearedCount != null
          ? `?cleared=${clearedCount}`
          : "";
    router.push(`/buildings/${params.id}${receipt}`);
  };

  const handleDelete = async () => {
    if (!(await confirm(t.buildings.form.confirmDelete, { danger: true }))) return;
    setSaveError(null);
    const supabase = createClient();
    const { error } = await supabase.schema("crm").from("buildings").delete().eq("id", params.id);
    if (error) {
      setSaveError(t.buildings.form.deleteBlocked);
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
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}

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
