"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// This used to be a screen of its own -- contract particulars on the left, the
// payment ledger on the right. It showed the same client, the same apartment,
// the same amounts and the same print/share actions as the client's own card,
// just laid out differently, so which of the two you ended up looking at
// depended entirely on which link you happened to click. Everything it offered
// now lives on the client card (particulars, the edit form, delete, and the
// price of the apartment), and this route just forwards there -- pre-expanded
// and scrolled to the right contract, exactly like /contracts/[id]/payments.
//
// Every existing link keeps working: the shakhmatka, the contract tab bar,
// quick search, the booking confirmation. They all land in one place now.
export default function ContractRedirect() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!configured) return;
    // Preserved across the hop so the client card knows where "back" goes.
    const from = new URLSearchParams(window.location.search).get("from");
    createClient()
      .schema("crm")
      .from("contracts")
      .select("client_id")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => {
        const clientId = (data as { client_id: string } | null)?.client_id;
        if (clientId) router.replace(
            `/clients/${clientId}?contract=${params.id}` +
              (from ? `&from=${encodeURIComponent(from)}` : "")
          );
        else setFailed(true);
      });
  }, [configured, params.id, router]);

  if (failed) return <p className="text-slate-400">{t.contracts.notFound}</p>;
  return <p className="text-slate-400">{t.common.loading}</p>;
}
