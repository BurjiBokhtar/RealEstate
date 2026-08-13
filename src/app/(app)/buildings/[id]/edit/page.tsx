"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { planReprice, RATE_CURRENCY, type RepricePlan } from "@/lib/buildings/repriceUnits";
import { formatCurrency } from "@/lib/currency";
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
  // How much has been paid against each flat. A booking nobody has paid for is
  // still just a price tag and follows the building's rate; one with money
  // behind it does not. Flats with no contract simply aren't in here.
  const [paidByUnit, setPaidByUnit] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [repriceError, setRepriceError] = useState<string | null>(null);

  const loadUnits = useCallback(async () => {
    const supabase = createClient();
    const [unitsRes, contractsRes] = await Promise.all([
      supabase.schema("crm").from("objects").select("*").eq("building_id", params.id),
      supabase
        .schema("crm")
        .from("contracts")
        .select("object_id, paid_amount, object:objects!inner(building_id)")
        .eq("object.building_id", params.id),
    ]);
    setUnits((unitsRes.data ?? []) as PropertyObject[]);
    const paid: Record<string, number> = {};
    for (const c of (contractsRes.data ?? []) as Array<{
      object_id: string;
      paid_amount: number;
    }>) {
      // Summed, not overwritten: a flat can carry more than one contract row
      // (a cancelled deal and its replacement), and "has been paid for" means
      // any of them has money against it.
      paid[c.object_id] = (paid[c.object_id] ?? 0) + c.paid_amount;
    }
    setPaidByUnit(paid);
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

  // Flats standing at a price the SAVED rate no longer produces. Drives the
  // banner below the form: the way back for a building whose rate was already
  // changed before this screen learned to carry the prices along, and for
  // prices that drift apart for any other reason later.
  const drift = useMemo(() => {
    const rate = building?.price_per_sqm ?? null;
    if (!rate || rate <= 0) return null;
    const plan = planReprice(units, rate, paidByUnit);
    return plan.count > 0 ? { rate, plan } : null;
  }, [building?.price_per_sqm, units, paidByUnit]);

  // Both entry points -- saving a changed rate, and the banner -- end up here.
  // `headline` is the one sentence that differs: on save it is "the rate went
  // from X to Y", from the banner it is "these prices are not at the rate".
  //
  // Returns the failure to show, or null. Returned as a value rather than left
  // in state: setRepriceError() is not visible to the caller in the same tick,
  // and the caller has to decide right there whether to navigate away.
  const confirmAndApply = async (plan: RepricePlan, headline: string) => {
    // Each clause only appears when it has something to report, so the dialog
    // stays short in the ordinary case and explains itself when the number of
    // re-priced flats is smaller than the building.
    const lines = [headline];
    if (plan.locked > 0) {
      lines.push(t.buildings.reprice.locked.replace("{n}", String(plan.locked)));
    }
    if (plan.skippedNoArea > 0) {
      lines.push(t.buildings.reprice.skippedNoArea.replace("{n}", String(plan.skippedNoArea)));
    }
    if (plan.skippedCurrency > 0) {
      lines.push(t.buildings.reprice.skippedCurrency.replace("{n}", String(plan.skippedCurrency)));
    }

    const ok = await confirm(lines.join(" "), {
      confirmLabel: t.buildings.reprice.confirmBtn,
      cancelLabel: t.buildings.reprice.skipBtn,
    });
    if (!ok) return null;

    // One request per resulting price, not per flat: identical layouts share
    // an area, so a 200-flat building is a handful of round trips.
    const supabase = createClient();
    for (const group of plan.groups) {
      const { error } = await supabase
        .schema("crm")
        .from("objects")
        .update({ price: group.price })
        .in("id", group.ids);
      if (error) {
        // Partial: earlier groups did go through. Reloading below would be
        // wrong here -- the message matters more than a refreshed list.
        return t.buildings.reprice.failed.replace("{error}", error.message);
      }
    }
    await loadUnits();
    return null;
  };

  // Called AFTER the building row is saved, never before, so the dialog is
  // only ever about the flats: cancelling it (or pressing Esc) leaves the new
  // rate saved and the old prices standing -- which is exactly what "leave
  // them as they are" should mean.
  const offerReprice = async (oldRate: number | null, newRate: number) => {
    const plan = planReprice(units, newRate, paidByUnit);
    if (plan.count === 0) return null;
    return confirmAndApply(
      plan,
      t.buildings.reprice.confirm
        .replace("{old}", formatCurrency(oldRate, RATE_CURRENCY))
        .replace("{new}", formatCurrency(newRate, RATE_CURRENCY))
        .replace("{n}", String(plan.count))
    );
  };

  const handleDriftReprice = async () => {
    if (!drift) return;
    setRepriceError(
      await confirmAndApply(
        drift.plan,
        t.buildings.reprice.driftConfirm
          .replace("{rate}", formatCurrency(drift.rate, RATE_CURRENCY))
          .replace("{n}", String(drift.plan.count))
      )
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setRepriceError(null);
    const newRate = values.price_per_sqm ? Number(values.price_per_sqm) : null;
    const supabase = createClient();
    const { error } = await supabase
      .schema("crm")
      .from("buildings")
      .update({
        name: values.name,
        address: values.address || null,
        floors_count: values.floors_count ? Number(values.floors_count) : null,
        units_per_floor: values.units_per_floor ? Number(values.units_per_floor) : null,
        price_per_sqm: newRate,
        facade_url: values.facade_url || null,
        plan_url: values.plan_url || null,
        construction_status: values.construction_status,
      })
      .eq("id", params.id);

    // Truthy, not `!== null`: a rate of 0 is a field cleared mid-edit, not a
    // decision to make every free flat free. It saves, but it re-prices nothing.
    const oldRate = building?.price_per_sqm ?? null;
    let failure: string | null = null;
    if (!error && newRate && newRate !== oldRate) {
      failure = await offerReprice(oldRate, newRate);
      setRepriceError(failure);
      // Whatever the answer was, the rate on screen is now the saved one --
      // so a second save doesn't re-offer a re-price that already happened.
      setBuilding((prev) => (prev ? { ...prev, price_per_sqm: newRate } : prev));
    }

    setSubmitting(false);
    // Staying put on failure: the message is on this page, and the shakhmatka
    // would just show the unchanged prices with no explanation.
    if (!failure) router.push(`/buildings/${params.id}`);
  };

  const handleDelete = async () => {
    if (!(await confirm(t.buildings.form.confirmDelete, { danger: true }))) return;
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
          {repriceError && <p className="text-sm text-red-600">{repriceError}</p>}

          {/* Passive, not a dialog: a price set by hand (a discount on a
              corner flat) is a legitimate reason to sit off the rate, so this
              states the fact and offers the button rather than interrupting
              every save with a question. */}
          {drift && (
            <div className="flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-900">
                {t.buildings.reprice.drift
                  .replace("{n}", String(drift.plan.count))
                  .replace("{rate}", formatCurrency(drift.rate, RATE_CURRENCY))}
              </p>
              <button
                type="button"
                onClick={handleDriftReprice}
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition-all hover:bg-amber-100 active:scale-[0.98]"
              >
                {t.buildings.reprice.driftBtn}
              </button>
            </div>
          )}

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
