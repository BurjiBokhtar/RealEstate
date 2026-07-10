"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { BuildingForm } from "@/components/BuildingForm";
import { ShakhmatkaGrid } from "@/components/ShakhmatkaGrid";
import type { Building, BuildingInput } from "@/lib/buildings/types";
import type { PropertyObject } from "@/lib/objects/types";

export default function BuildingDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  const [building, setBuilding] = useState<Building | null | undefined>(undefined);
  const [units, setUnits] = useState<PropertyObject[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genFloors, setGenFloors] = useState("");
  const [genUnitsPerFloor, setGenUnitsPerFloor] = useState("");

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

          <ShakhmatkaGrid units={units} />
        </>
      )}
    </div>
  );
}
