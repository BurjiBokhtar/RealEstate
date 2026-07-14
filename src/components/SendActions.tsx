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
      {/* Compact icon chips: recognizable at a glance in a dense row of
          per-payment actions, label kept so the icon never has to be
          guessed. Title carries the full wording. */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => send("whatsapp")}
          disabled={sending !== null}
          title={t.contracts.send.whatsapp}
          className="flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-1.5-.5c-2.6-1.1-4.3-3.7-4.4-3.9-.1-.2-1-1.4-1-2.6s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c0 .2.1.3 0 .5l-.3.5-.4.5c-.2.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.9 1.7 1.1 2 1.3.2.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
          </svg>
          {sending === "whatsapp" ? "…" : "WhatsApp"}
        </button>
        <button
          type="button"
          onClick={() => send("email")}
          disabled={sending !== null}
          title={t.contracts.send.email}
          className="flex items-center gap-1 rounded-lg border border-sky-300 px-2 py-1 text-[11px] font-semibold text-sky-700 transition-all hover:bg-sky-50 active:scale-95 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          {sending === "email" ? "…" : "Email"}
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
