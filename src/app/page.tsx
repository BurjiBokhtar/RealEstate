"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import type { ObjectStatus } from "@/lib/objects/types";

type Counts = {
  total: number;
  available: number;
  sold: number;
  in_progress: number;
};

export default function DashboardPage() {
  const { t } = useLocale();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("objects")
      .select("status")
      .then(({ data }) => {
        const rows = (data ?? []) as { status: ObjectStatus }[];
        setCounts({
          total: rows.length,
          available: rows.filter((r) => r.status === "available").length,
          sold: rows.filter((r) => r.status === "sold").length,
          in_progress: rows.filter((r) => r.status === "in_progress").length,
        });
        setLoading(false);
      });
  }, [configured]);

  const cards = [
    { label: t.dashboard.totalObjects, value: counts?.total },
    { label: t.dashboard.available, value: counts?.available },
    { label: t.dashboard.sold, value: counts?.sold },
    { label: t.dashboard.inProgress, value: counts?.in_progress },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">{t.dashboard.title}</h1>

      {!configured && <SetupNotice />}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold">
              {loading ? "…" : (card.value ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/objects"
        className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        {t.nav.objects} →
      </Link>
    </div>
  );
}
