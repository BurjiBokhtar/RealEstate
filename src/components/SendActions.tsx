"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, type Currency } from "@/lib/currency";
import { waLink } from "@/lib/whatsapp";

type Kind = "contract" | "receipt";

type ContractInfo = {
  number: string | null;
  amount: number;
  paid_amount: number;
  currency: Currency;
  client: { name: string; phone: string | null; email: string | null } | null;
  object: { name: string } | null;
};

// Notify the client over WhatsApp or e-mail with ZERO server setup: both
// buttons open the manager's own WhatsApp (wa.me) or mail app (mailto) with a
// ready message. No WhatsApp Business API, no SMTP env vars -- so they just
// work. (The full styled document is still printed/saved separately.)
export function SendActions({
  contractId,
  kind,
  paymentId,
}: {
  contractId: string;
  kind: Kind;
  paymentId?: string;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState<"whatsapp" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load just what the message needs, on click, as the logged-in user (RLS).
  const loadInfo = async (): Promise<{ info: ContractInfo; paidAmount: number } | null> => {
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("contracts")
      .select(
        "number, amount, paid_amount, currency, client:clients(name, phone, email), object:objects(name)"
      )
      .eq("id", contractId)
      .maybeSingle();
    if (!data) return null;
    const info = data as unknown as ContractInfo;
    let paidAmount = info.paid_amount;
    if (kind === "receipt" && paymentId) {
      const { data: pay } = await supabase
        .schema("crm")
        .from("contract_payments")
        .select("amount")
        .eq("id", paymentId)
        .maybeSingle();
      if (pay) paidAmount = (pay as { amount: number }).amount;
    }
    return { info, paidAmount };
  };

  const buildMessage = (info: ContractInfo, paidAmount: number): string => {
    const name = info.client?.name ?? "";
    const cur = info.currency;
    const remaining = Math.max(0, info.amount - info.paid_amount);
    const num = info.number ?? "—";
    const obj = info.object?.name ?? "";
    if (kind === "receipt") {
      return t.contracts.send.receiptMsg
        .replace("{name}", name)
        .replace("{amount}", formatCurrency(paidAmount, cur))
        .replace("{contract}", num)
        .replace("{remaining}", formatCurrency(remaining, cur));
    }
    return t.contracts.send.contractMsg
      .replace("{name}", name)
      .replace("{contract}", num)
      .replace("{object}", obj)
      .replace("{amount}", formatCurrency(info.amount, cur))
      .replace("{remaining}", formatCurrency(remaining, cur));
  };

  const openWhatsApp = async () => {
    setBusy("whatsapp");
    setError(null);
    const res = await loadInfo();
    setBusy(null);
    if (!res) return setError(t.common.error);
    if (!res.info.client?.phone) return setError(t.contracts.send.noPhone);
    const msg = buildMessage(res.info, res.paidAmount);
    window.open(waLink(res.info.client.phone, msg), "_blank", "noopener,noreferrer");
  };

  const openEmail = async () => {
    setBusy("email");
    setError(null);
    const res = await loadInfo();
    setBusy(null);
    if (!res) return setError(t.common.error);
    if (!res.info.client?.email) return setError(t.contracts.send.noEmail);
    const subject =
      kind === "receipt"
        ? `${t.contracts.send.receiptSubject} ${res.info.number ?? ""}`
        : `${t.contracts.send.contractSubject} ${res.info.number ?? ""}`;
    const body = buildMessage(res.info, res.paidAmount);
    window.location.href = `mailto:${res.info.client.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={openWhatsApp}
          disabled={busy !== null}
          title={t.contracts.send.whatsapp}
          className="flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-1.5-.5c-2.6-1.1-4.3-3.7-4.4-3.9-.1-.2-1-1.4-1-2.6s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c0 .2.1.3 0 .5l-.3.5-.4.5c-.2.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.9 1.7 1.1 2 1.3.2.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
          </svg>
          {busy === "whatsapp" ? "…" : "WhatsApp"}
        </button>
        <button
          type="button"
          onClick={openEmail}
          disabled={busy !== null}
          title={t.contracts.send.email}
          className="flex items-center gap-1 rounded-lg border border-sky-300 px-2 py-1 text-[11px] font-semibold text-sky-700 transition-all hover:bg-sky-50 active:scale-95 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          {busy === "email" ? "…" : "Email"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
