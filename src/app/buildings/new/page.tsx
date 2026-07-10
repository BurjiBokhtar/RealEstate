"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { BuildingForm } from "@/components/BuildingForm";
import type { BuildingInput } from "@/lib/buildings/types";

export default function NewBuildingPage() {
  const { t } = useLocale();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: BuildingInput) => {
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("crm")
      .from("buildings")
      .insert({
        name: values.name,
        address: values.address || null,
        floors_count: values.floors_count ? Number(values.floors_count) : null,
        units_per_floor: values.units_per_floor ? Number(values.units_per_floor) : null,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (!error && data) {
      router.push(`/buildings/${data.id}`);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/buildings" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.buildings.backToList}
      </Link>
      <h1 className="text-2xl font-semibold">{t.buildings.newBuilding}</h1>
      {!configured && <SetupNotice />}
      <BuildingForm submitting={submitting} onSubmit={handleSubmit} />
    </div>
  );
}
