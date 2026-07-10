"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";

type Kind = "contract" | "receipt";

export function SendActions({ contractId, kind, paymentId }: { contractId: string; kind: Kind; paymentId?: string }) {
  const { t } = useLocale();
  const [sending, setSending] = useState<"email" | "whatsapp" | null>(null);
  const [result, setResult] = useState<{ channel: string; ok: boolean; message: string } | null>(
    null
  );

  const send = async (channel: "email" | "whatsapp") => {
    setSending(channel);
    setResult(null);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const res = await fetch(`/api/send/${channel}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ contractId, kind, paymentId }),
      });
      const data = await res.json();
      setResult({
        channel,
        ok: res.ok,
        message: res.ok ? t.contracts.send.success : data.error || t.common.error,
      });
    } catch {
      setResult({ channel, ok: false, message: t.common.error });
    }
    setSending(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => send("whatsapp")}
          disabled={sending !== null}
          className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {sending === "whatsapp" ? t.contracts.send.sending : t.contracts.send.whatsapp}
        </button>
        <button
          type="button"
          onClick={() => send("email")}
          disabled={sending !== null}
          className="rounded-md border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50"
        >
          {sending === "email" ? t.contracts.send.sending : t.contracts.send.email}
        </button>
      </div>
      {result && (
        <p className={`text-xs ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
