"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { BuildingForm } from "@/components/BuildingForm";
import { FloorRowsEditor } from "@/components/FloorRowsEditor";
import {
  buildUnitsFromRows,
  emptyStructureRow,
  type StructureRow,
} from "@/lib/buildings/generateUnits";
import type { BuildingInput } from "@/lib/buildings/types";

export default function NewBuildingPage() {
  const { t } = useLocale();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<StructureRow[]>([{ ...emptyStructureRow }]);

  const handleSubmit = async (values: BuildingInput) => {
    setSubmitting(true);
    const supabase = createClient();
    const pricePerSqm = values.price_per_sqm ? Number(values.price_per_sqm) : null;
    const { data, error } = await supabase
      .schema("crm")
      .from("buildings")
      .insert({
        name: values.name,
        address: values.address || null,
        floors_count: values.floors_count ? Number(values.floors_count) : null,
        units_per_floor: values.units_per_floor ? Number(values.units_per_floor) : null,
        price_per_sqm: pricePerSqm,
        facade_url: values.facade_url || null,
        plan_url: values.plan_url || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      setSubmitting(false);
      return;
    }

    const units = buildUnitsFromRows(rows, data.id, pricePerSqm, []);
    if (units.length > 0) {
      await supabase.schema("crm").from("objects").insert(units);
    }

    setSubmitting(false);
    router.push(`/buildings/${data.id}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/buildings" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.buildings.backToList}
      </Link>
      <h1 className="text-2xl font-semibold">{t.buildings.newBuilding}</h1>
      {!configured && <SetupNotice />}
      <BuildingForm submitting={submitting} onSubmit={handleSubmit}>
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-700">
            {t.buildings.floorBuilder.title}
          </p>
          <p className="text-sm text-slate-500">{t.buildings.floorBuilder.hint}</p>
          <FloorRowsEditor rows={rows} onChange={setRows} />
        </div>
      </BuildingForm>
    </div>
  );
}
