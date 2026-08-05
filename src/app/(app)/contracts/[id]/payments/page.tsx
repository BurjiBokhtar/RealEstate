"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// This used to be its own "cash desk" page -- the exact same payment
// ledger (record a payment, schedule, print/share) now lives inline on the
// client's own page as an expandable card per contract, so there's one
// place for "everything about this client and their deals" instead of two
// screens showing mostly the same client/money summary. Every existing
// link here (a booked shakhmatka cell, the contract tab bar) keeps working
// unchanged -- they just land one hop further, pre-expanded and scrolled
// to this contract.
export default function ContractPaymentsRedirect() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("contracts")
      .select("client_id")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => {
        const clientId = (data as { client_id: string } | null)?.client_id;
        if (clientId) {
          router.replace(`/clients/${clientId}?contract=${params.id}`);
        } else {
          setFailed(true);
        }
      });
  }, [configured, params.id, router]);

  if (failed) return <p className="text-slate-400">{t.contracts.notFound}</p>;
  return <p className="text-slate-400">{t.common.loading}</p>;
}
