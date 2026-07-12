"use client";

import { formatCurrency, type Currency } from "@/lib/currency";
import { amountToWordsTj } from "@/lib/contracts/amountToWordsTj";
import type { Settings } from "@/lib/settings/types";
import type { ContractPayment } from "@/lib/contracts/types";

export type ReceiptContractData = {
  number: string | null;
  amount: number;
  paid_amount: number;
  currency: Currency;
  client: { name: string } | null;
  object: { name: string; area: number | null; floor: number | null } | null;
};

const SERIF = { fontFamily: "'Times New Roman', Georgia, serif" };

// One copy of a payment receipt in the company's official document style:
// header band with the receipt number, payer block, a small details table,
// the payment amount big with its words underneath, the remaining-balance
// strip, and two signature lines. Printed twice per A4 sheet (buyer copy /
// company copy) by the receipt page. Document text is fixed Tajik (official
// language), independent of the UI locale -- same policy as the contract.
export function ReceiptDocument({
  settings,
  contract,
  payment,
  receiptNo,
  copyLabel,
}: {
  settings: Settings;
  contract: ReceiptContractData;
  payment: ContractPayment;
  receiptNo: number | null;
  copyLabel: string;
}) {
  const remaining = Math.max(contract.amount - contract.paid_amount, 0);
  const dateStr = payment.paid_date ?? payment.due_date;

  return (
    <div
      style={SERIF}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-[13px] leading-[1.55] text-slate-900 shadow-sm print:break-inside-avoid print:rounded-none print:border-0 print:shadow-none"
    >
      {/* Header: company left, КВИТАНСИЯ № + copy chip right */}
      <div className="flex items-start justify-between gap-3 border-b-2 border-slate-900 px-6 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          {settings.company_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.company_logo_url}
              alt=""
              className="h-11 w-11 rounded-lg border border-slate-200 object-contain p-0.5"
            />
          )}
          <div>
            <p className="text-[15px] font-bold leading-tight">
              {settings.company_name || "—"}
            </p>
            {settings.company_address && (
              <p className="text-[10.5px] text-slate-500">{settings.company_address}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[14px] font-bold tracking-wide">КВИТАНСИЯ</p>
          <p className="text-[12px]">№ {receiptNo ?? "—"}</p>
          <p className="text-[10.5px] text-slate-500">{dateStr}</p>
          <span className="mt-0.5 inline-block rounded border border-slate-300 px-1.5 py-px text-[9.5px] text-slate-500">
            {copyLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-6 py-3.5">
        {/* Payer */}
        <div className="rounded bg-slate-50 px-3 py-2 print:border print:border-slate-200 print:bg-transparent">
          <p className="text-[10.5px] text-slate-500">Пардозанда</p>
          <p className="text-[14px] font-bold leading-tight">
            {contract.client?.name ?? "—"}
          </p>
          <p className="text-[11px] text-slate-500">
            {contract.object?.name ?? "—"}
            {contract.object?.area != null && ` · ${contract.object.area} м²`}
            {contract.object?.floor != null && ` · ${contract.object.floor}-ошёна`}
          </p>
        </div>

        {/* Details */}
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            <tr>
              <td className="w-[45%] py-0.5 text-slate-500">Рақами шартнома</td>
              <td className="py-0.5 text-right font-semibold">{contract.number || "—"}</td>
            </tr>
            <tr>
              <td className="py-0.5 text-slate-500">Нархи умумии шартнома</td>
              <td className="py-0.5 text-right font-semibold">
                {formatCurrency(contract.amount, contract.currency)}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 text-slate-500">Санаи пардохт</td>
              <td className="py-0.5 text-right">{dateStr}</td>
            </tr>
            <tr>
              <td className="py-0.5 text-slate-500">Ҳолати пардохт</td>
              <td className="py-0.5 text-right">
                {payment.paid ? "тасдиқ шудааст" : "ҳанӯз тасдиқ нашудааст"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Amount */}
        <div>
          <div className="flex items-baseline justify-between border-t border-slate-900 pt-1.5">
            <span className="text-[13px] font-bold">Маблағи пардохт</span>
            <span className="text-[20px] font-bold">
              {formatCurrency(payment.amount, contract.currency)}
            </span>
          </div>
          <p className="text-[11px] italic text-slate-500">
            {amountToWordsTj(payment.amount, contract.currency)}
          </p>
        </div>

        {/* Balance strip */}
        {remaining > 0 ? (
          <div className="flex items-center justify-between rounded border border-rose-200 bg-rose-50 px-3 py-1 text-[12px] print:bg-transparent">
            <span className="text-rose-700">Боқимондаи қарз</span>
            <span className="font-bold text-rose-700">
              {formatCurrency(remaining, contract.currency)}
            </span>
          </div>
        ) : (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-center text-[12px] font-semibold text-emerald-700 print:bg-transparent">
            ✓ Пурра пардохт шуд
          </div>
        )}

        {/* Signatures */}
        <div className="mt-1 grid grid-cols-2 gap-8">
          <div>
            <p className="mb-4 text-[10.5px] text-slate-500">Намояндаи Фурӯшанда</p>
            <div className="border-b border-slate-900" />
            <p className="mt-0.5 text-[9.5px] text-slate-400">имзо / М. П.</p>
          </div>
          <div>
            <p className="mb-4 text-[10.5px] text-slate-500">Харидор</p>
            <div className="border-b border-slate-900" />
            <p className="mt-0.5 text-[9.5px] text-slate-400">имзо</p>
          </div>
        </div>
      </div>
      <div className="border-t-2 border-slate-900" />
    </div>
  );
}
