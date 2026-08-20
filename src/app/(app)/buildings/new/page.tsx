"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { BuildingForm } from "@/components/BuildingForm";
import { useRole } from "@/lib/auth/useRole";
import { emptyBuildingInput } from "@/lib/buildings/types";

// Creating a building is now a single clean step: its details. The floors
// themselves are built on the next screen with the one flexible constructor
// (block + floor ranges "с…по…" + a type per range) -- the same one used to
// edit a building later. Before, this page had a second, less-capable
// constructor (fixed units-per-floor, no per-floor type ranges), which meant
// two different builders and the confusion the user hit.
export default function NewBuildingPage() {
  const { t } = useLocale();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const { role, loading: roleLoading } = useRole();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState(emptyBuildingInput);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .schema("crm")
      .from("buildings")
      .insert({
        name: values.name,
        address: values.address || null,
        floors_count: values.floors_count ? Number(values.floors_count) : null,
        units_per_floor: values.units_per_floor ? Number(values.units_per_floor) : null,
        price_per_sqm: values.price_per_sqm ? Number(values.price_per_sqm) : null,
        facade_url: values.facade_url || null,
        plan_url: values.plan_url || null,
        construction_status: values.construction_status,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setSubmitting(false);
      setError(insertError?.message ?? t.common.error);
      return;
    }
    // Straight into the floor constructor for the fresh building.
    router.push(`/buildings/${data.id}/edit`);
  };

  if (!roleLoading && role !== "admin") {
    return (
      <div className="flex flex-col gap-3">
        <BackLink href="/objects">{t.objects.title}</BackLink>
        <p className="text-[var(--ink-4)]">{t.users.accessDenied}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/objects">{t.objects.title}</BackLink>
      <div>
        <h1 className="text-2xl font-semibold">{t.buildings.newBuilding}</h1>
        <p className="mt-1 text-sm text-[var(--ink-4)]">{t.buildings.newBuildingHint}</p>
      </div>
      {!configured && <SetupNotice />}

      <BuildingForm
        values={values}
        onChange={setValues}
        submitting={submitting}
        onSubmit={handleSubmit}
        hideFloorsCount
        hideUnitsPerFloor
      />
      {error && <p className="text-sm text-[var(--wash-rose-ink)]">{error}</p>}
    </div>
  );
}
