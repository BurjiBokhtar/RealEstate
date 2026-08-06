"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, type Currency } from "@/lib/currency";
import { waLink } from "@/lib/whatsapp";
import { captureNodeAsPngFile } from "@/lib/receiptImage";
import { PrintIcon } from "@/components/icons";
import { IconAction, IconToolbar } from "@/components/ActionBar";

type Kind = "contract" | "receipt";

type ContractInfo = {
  number: string | null;
  amount: number;
  paid_amount: number;
  currency: Currency;
  client: { name: string; phone: string | null; email: string | null } | null;
  object: { name: string } | null;
};

type ShareNavigator = Navigator & {
  share?: (data: { title?: string; text: string; files?: File[] }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
};

// One "Поделиться" button hands the message (and, for a receipt, the
// rendered image) to the OS's own share sheet -- so the client picks
// whichever messenger or mail app they actually have installed, instead of
// being limited to whichever two channels this app happened to hard-code.
// Where the browser has no share sheet at all (most desktop browsers still
// don't), it falls back to a small menu with the old WhatsApp/Email links --
// never a dead end, just one extra tap on unsupported browsers.
//
// Rendered as an IconToolbar -- Share, Печать, and whatever the caller folds
// in via extraActions -- so everything this document row can do reads as one
// control instead of competing buttons scattered across the row.
export function SendActions({
  contractId,
  kind,
  paymentId,
  receiptNodeRef,
  printAction,
  extraActions,
}: {
  contractId: string;
  kind: Kind;
  paymentId?: string;
  // When set (only meaningful for kind="receipt"), share captures this DOM
  // node as an image and hands it to the share sheet alongside the text,
  // instead of text alone. Only the page that actually renders the receipt
  // (the print page) can offer this -- the compact list view has no receipt
  // DOM to capture, so it stays text-only there.
  receiptNodeRef?: RefObject<HTMLElement | null>;
  // Folds a print action into the same toolbar -- wherever
  // print and share are genuinely the same "get this document out" decision.
  printAction?: { label: string } & ({ href: string } | { onClick: () => void });
  // Extra icon segments folded into the SAME toolbar. Everything a document
  // row can do belongs in one control, not in a pill plus a scattering of
  // loose buttons beside it.
  extraActions?: ReactNode;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the fallback menu on an outside click -- it's a lightweight
  // popover, not a modal, so there's no explicit close button.
  useEffect(() => {
    if (!fallbackOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setFallbackOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [fallbackOpen]);

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

  const handleShare = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setFallbackOpen(false);
    const res = await loadInfo();
    if (!res) {
      setBusy(false);
      return setError(t.common.error);
    }
    const msg = buildMessage(res.info, res.paidAmount);
    const title =
      kind === "receipt" ? t.contracts.receipt.title : t.contracts.send.contractSubject;

    let files: File[] | undefined;
    if (kind === "receipt" && receiptNodeRef?.current) {
      try {
        files = [
          await captureNodeAsPngFile(
            receiptNodeRef.current,
            `receipt-${res.info.number ?? paymentId ?? "chek"}.png`
          ),
        ];
      } catch {
        // Capture failed (e.g. a cross-origin logo) -- text-only share is
        // still a complete send, just without the picture.
      }
    }

    const nav = navigator as ShareNavigator;
    const canShareFiles = files ? nav.canShare?.({ files }) : true;

    if (typeof nav.share === "function" && canShareFiles) {
      try {
        await nav.share(canShareFiles && files ? { title, text: msg, files } : { title, text: msg });
        setBusy(false);
        return;
      } catch (err) {
        // The user closing the share sheet is a completed action, not a
        // failure -- respect it silently instead of nagging with a menu.
        if (err instanceof Error && err.name === "AbortError") {
          setBusy(false);
          return;
        }
        // Any other failure (no share target chosen, permission denied)
        // falls through to the manual fallback below.
      }
    }

    setBusy(false);
    setFallbackOpen(true);
  };

  const fallbackWhatsApp = async () => {
    setFallbackOpen(false);
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await loadInfo();
    if (!res) {
      setBusy(false);
      return setError(t.common.error);
    }
    if (!res.info.client?.phone) {
      setBusy(false);
      return setError(t.contracts.send.noPhone);
    }
    const msg = buildMessage(res.info, res.paidAmount);
    // Best-effort: hand over the receipt image as a download too, so it's
    // one drag away from the WhatsApp chat that's about to open (this
    // browser has no share sheet, or the user picked this over it).
    if (kind === "receipt" && receiptNodeRef?.current) {
      try {
        const file = await captureNodeAsPngFile(
          receiptNodeRef.current,
          `receipt-${res.info.number ?? paymentId ?? "chek"}.png`
        );
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        setNotice(t.contracts.send.imageDownloaded);
      } catch {
        // No image -- text-only is still a complete send.
      }
    }
    setBusy(false);
    window.open(waLink(res.info.client.phone, msg), "_blank", "noopener,noreferrer");
  };

  const fallbackEmail = async () => {
    setFallbackOpen(false);
    setBusy(true);
    setError(null);
    const res = await loadInfo();
    setBusy(false);
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
    <div className="relative flex flex-col gap-1.5">
      <IconToolbar>
        <IconAction
          label={t.contracts.send.share}
          onClick={handleShare}
          disabled={busy}
          icon={
            busy ? (
              <span className="text-xs">…</span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-none stroke-current"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3v12M8 7l4-4 4 4" />
                <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
              </svg>
            )
          }
        />
        {printAction && (
          <IconAction
            label={printAction.label}
            tone="brand"
            icon={<PrintIcon className="h-4 w-4" />}
            {...("href" in printAction
              ? { href: printAction.href }
              : { onClick: printAction.onClick })}
          />
        )}
        {extraActions}
      </IconToolbar>

      {/* Fallback menu: only ever shown when the browser has no share sheet
          (or the user backed out of a share attempt that then errored) --
          the same WhatsApp/Email destinations this button used to be. */}
      {fallbackOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-xl"
        >
          <button
            type="button"
            onClick={fallbackWhatsApp}
            className="flex w-full items-center gap-2 px-3 py-2 font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-1.5-.5c-2.6-1.1-4.3-3.7-4.4-3.9-.1-.2-1-1.4-1-2.6s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c0 .2.1.3 0 .5l-.3.5-.4.5c-.2.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.9 1.7 1.1 2 1.3.2.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
            </svg>
            WhatsApp
          </button>
          <button
            type="button"
            onClick={fallbackEmail}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 font-semibold text-sky-700 transition-colors hover:bg-sky-50"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 fill-none stroke-current"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            Email
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {notice && <p className="text-xs text-emerald-600">{notice}</p>}
    </div>
  );
}
