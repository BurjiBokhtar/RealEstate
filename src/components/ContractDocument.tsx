"use client";

import { useSettings } from "@/lib/settings/SettingsProvider";
import { formatCurrency, type Currency } from "@/lib/currency";
import { amountToWordsTj } from "@/lib/contracts/amountToWordsTj";
import type { ContractPayment, PaymentType } from "@/lib/contracts/types";

export type ContractDocumentData = {
  number: string | null;
  signed_date: string | null;
  amount: number;
  paid_amount: number;
  amount_words: string | null;
  currency: Currency;
  payment_type: PaymentType;
  installment_months: number | null;
  client: {
    name: string;
    phone: string | null;
    passport: string | null;
    passport_issued_by: string | null;
    birth_date: string | null;
    address: string | null;
  } | null;
  object: {
    name: string;
    address: string | null;
    area: number | null;
    floor: number | null;
    block: string | null;
    rooms: number | null;
    building: { name: string; address: string | null; price_per_sqm: number | null } | null;
  } | null;
};

// The one accent the paper document carries: the hero's plum, used for
// rules and section markers. Prints as a dignified dark tone on mono
// printers; everything else is ink-on-white.
const PLUM = "#5b3468";

function SectionHeader({ num, title }: { num: number; title: string }) {
  return (
    <div className="mb-2 flex items-center gap-2.5">
      {/* Outlined, not filled: a filled circle disappears when the print
          dialog's "background graphics" is off (the default). */}
      <span
        style={{ borderColor: PLUM, color: PLUM }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold"
      >
        {num}
      </span>
      <span className="text-[14px] font-bold uppercase tracking-wide text-slate-900">
        {title}
      </span>
    </div>
  );
}

function SpecRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <tr
      style={highlight ? { borderTop: `2px solid ${PLUM}`, borderBottom: `2px solid ${PLUM}` } : undefined}
      className={highlight ? "" : "border-b border-slate-200"}
    >
      <td className="w-[42%] py-2 pr-3 align-top text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </td>
      <td
        style={highlight ? { color: PLUM } : undefined}
        className={`py-2 ${highlight ? "text-[16px] font-bold" : "text-[13px] font-medium text-slate-900"}`}
      >
        {value}
      </td>
    </tr>
  );
}

// Printable contract in the company's official document style: clean
// modern type, numbered sections, an apartment spec table, full signature
// blocks with requisites and a seal box. Shared by the standalone print
// page and the in-modal preview after booking so both produce the same
// document. The legal wording is fixed Tajik (official contract language)
// regardless of the UI locale.
export function ContractDocument({
  contract,
  payments,
  copyLabel,
}: {
  contract: ContractDocumentData;
  payments: ContractPayment[];
  copyLabel?: string;
}) {
  const { settings } = useSettings();

  const companyName = settings.company_name || "—";
  const buildingName = contract.object?.building?.name ?? contract.object?.name ?? "—";
  const buildingAddress =
    contract.object?.building?.address ?? contract.object?.address ?? "—";
  const pricePerSqm = contract.object?.building?.price_per_sqm ?? null;

  const monthly =
    contract.payment_type === "installment" && contract.installment_months
      ? Math.floor(
          ((contract.amount - contract.paid_amount) / contract.installment_months) * 100
        ) / 100
      : null;

  const payText =
    contract.payment_type === "full"
      ? "пурра ҳангоми имзои шартнома"
      : contract.payment_type === "installment"
        ? `пардохти аввал ${formatCurrency(contract.paid_amount, contract.currency)}, боқимонда дар ${contract.installment_months ?? "—"} моҳ${monthly ? `, ҳар моҳ тақрибан ${formatCurrency(monthly, contract.currency)}` : ""}`
        : "тавассути мубодила (бартер)";

  const amountWords =
    contract.amount_words || amountToWordsTj(contract.amount, contract.currency);

  const scheduleTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-[13px] leading-[1.65] text-slate-900 shadow-sm print:rounded-none print:border-0 print:shadow-none">
      {copyLabel && (
        <p className="bg-slate-50 px-6 py-1 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 print:bg-transparent">
          {copyLabel}
        </p>
      )}

      {/* Header: company block left, contract number block right */}
      <div
        style={{ borderBottom: `3px solid ${PLUM}` }}
        className="flex items-start justify-between gap-4 px-8 pb-4 pt-6"
      >
        <div className="flex items-center gap-3.5">
          {settings.company_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.company_logo_url}
              alt=""
              className="h-16 w-16 rounded-xl border border-slate-200 object-contain p-1"
            />
          )}
          <div>
            <p className="text-[17px] font-bold tracking-tight text-slate-900">
              {companyName}
            </p>
            {settings.company_address && (
              <p className="text-[11px] text-slate-500">{settings.company_address}</p>
            )}
            {settings.company_bank_details && (
              <p className="text-[10.5px] text-slate-400">{settings.company_bank_details}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Шартнома
          </p>
          <p style={{ color: PLUM }} className="text-[20px] font-bold">
            № {contract.number || "—"}
          </p>
          {contract.signed_date && (
            <p className="text-[11px] text-slate-500">{contract.signed_date}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-8 py-6">
        {/* Title */}
        <div className="text-center">
          <p className="text-[17px] font-bold uppercase tracking-[0.22em] text-slate-900">
            Шартномаи ҳамкорӣ
          </p>
          <p className="mt-0.5 text-[11.5px] tracking-wide text-slate-500">
            {buildingName} · {buildingAddress}
          </p>
        </div>

        {/* Parties */}
        <div
          style={{ borderLeft: `3px solid ${PLUM}` }}
          className="rounded-r-lg bg-slate-50 px-4 py-3 text-[12.5px] leading-[1.7] print:bg-transparent"
        >
          <strong>{companyName}</strong> дар шахсияти роҳбари ҷамъият{" "}
          <strong>{settings.company_director || "—"}</strong>, ки дар асоси Оинномаи ҷамъият
          амал мекунад, аз як тараф, минбаъд <strong>«Фурӯшанда»</strong> ва аз тарафи дигар
          шаҳрванди Ҷумҳурии Тоҷикистон <strong>{contract.client?.name ?? "—"}</strong>
          {contract.client?.birth_date ? `, таваллуди ${contract.client.birth_date}` : ""}
          {contract.client?.passport ? `, шиноснома № ${contract.client.passport}` : ""}
          {contract.client?.passport_issued_by
            ? `, додашуда аз ҷониби ${contract.client.passport_issued_by}`
            : ""}
          {contract.client?.address ? `, суроға: ${contract.client.address}` : ""}, минбаъд{" "}
          <strong>«Харидор»</strong>, ҳамин шартномаро бо шартҳои зерин бастанд.
        </div>

        {/* 1. Purpose + spec table */}
        <section>
          <SectionHeader num={1} title="Мақсади шартнома" />
          <div className="pl-[34px] text-[12.5px]">
            <p>
              1.1. Бо мақсади вусъат бахшидани рафти сохтмони иншооти {buildingName}, воқеъ
              дар {buildingAddress}, тарафҳо уҳдадор шуданд, ки бо шартҳои манфиати
              мутақобила ҳамкорӣ намоянд.
            </p>
            <p className="mt-1">
              1.2. «Фурӯшанда» имконият медиҳад, ки «Харидор» дар маблағгузории иншоот
              ширкат намуда, ба моликияти худ хонаи зеринро ба расмият дарорад:
            </p>
            <table className="mt-2 w-full border-collapse">
              <tbody>
                <SpecRow label="Объект" value={buildingName} />
                <SpecRow label="Хона" value={contract.object?.name ?? "—"} />
                {(contract.object?.floor != null || contract.object?.block) && (
                  <SpecRow
                    label="Ошёна / даромадгоҳ"
                    value={[
                      contract.object?.floor != null ? `${contract.object.floor}-ошёна` : null,
                      contract.object?.block || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                )}
                {(contract.object?.rooms != null || contract.object?.area != null) && (
                  <SpecRow
                    label="Намуд / майдон"
                    value={
                      <>
                        {contract.object?.rooms != null && `${contract.object.rooms}-хона · `}
                        <strong>{contract.object?.area ?? "—"} м²</strong>
                      </>
                    }
                  />
                )}
                {pricePerSqm != null && (
                  <SpecRow
                    label="Нарх барои 1 м²"
                    value={formatCurrency(pricePerSqm, contract.currency)}
                  />
                )}
                <SpecRow
                  label="Маблағи умумӣ"
                  value={formatCurrency(contract.amount, contract.currency)}
                  highlight
                />
                <SpecRow label="Маблағ бо ҳарф" value={<em>{amountWords}</em>} />
                <SpecRow label="Тарзи пардохт" value={payText} />
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. Obligations */}
        <section>
          <SectionHeader num={2} title="Уҳдадориҳои тарафҳо" />
          <div className="flex flex-col gap-0.5 pl-[34px] text-[12.5px]">
            <p className="font-semibold">2.1. «Фурӯшанда» уҳдадор мешавад:</p>
            <p>а) корҳои сохтмониро дар мӯҳлати муқарраршуда ба анҷом расонад;</p>
            <p>
              б) баъди қабули иншоот ба баҳрабардорӣ шиносномаи техникии манзилро ба
              «Харидор» диҳад;
            </p>
            <p>в) ба «Харидор» дар ба расмият даровардани моликият ёрӣ расонад.</p>
            <p className="mt-1.5 font-semibold">2.2. «Харидор» уҳдадор мешавад:</p>
            <p>а) маблағи умумии шартномаро тибқи тартиби муқарраршуда пардохт намояд;</p>
            <p>
              б) хароҷоти ҳуҷҷатгузории нотариалӣ ва бақайдгирии давлатиро мустақилона
              пардохт намояд;
            </p>
            <p>в) аз лаҳзаи имзои шартнома иҷрои саривақтии пардохтҳоро таъмин намояд.</p>
          </div>
        </section>

        {/* 3. Penalties */}
        <section>
          <SectionHeader num={3} title="Масъулият ва чораҳои ҷаримавӣ" />
          <div className="flex flex-col gap-1.5 pl-[34px] text-[12.5px]">
            {[
              <>
                Таъхири пардохт аз як моҳ зиёд — ҷарима <strong>0,1%</strong> аз маблағи
                умумии шартнома барои ҳар рӯзи таъхир, вале на зиёда аз <strong>10%</strong>{" "}
                маблағи умумӣ.
              </>,
              <>
                Дар сурати 2 (ду) моҳ пардохт накардани маблағ «Фурӯшанда» ҳуқуқ дорад
                шартномаро бекор созад ва хонаро ба муштарии дигар фурӯшад.
              </>,
            ].map((item, i) => (
              <div key={i} className="flex gap-2">
                <span
                  style={{ background: PLUM }}
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Force majeure & disputes */}
        <section>
          <SectionHeader num={4} title="Форс-мажор ва ҳалли баҳсҳо" />
          <div className="flex flex-col gap-0.5 pl-[34px] text-[12.5px]">
            <p>
              4.1. Ҳолатҳои фавқулода (сӯхтор, обхезӣ, заминҷунбӣ ва дигар офатҳои табиӣ)
              тарафҳоро аз масъулият озод мекунанд ва мӯҳлатҳоро ба таври мувофиқ дароз
              мекунанд.
            </p>
            <p>
              4.2. Баҳсҳо аввал бо роҳи гуфтушунид ҳал мегарданд; дар сурати ба натиҷа
              нарасидан — дар суди дахлдор тибқи қонунгузории Ҷумҳурии Тоҷикистон.
            </p>
            <p>
              4.3. Шартнома аз лаҳзаи имзои ҳар ду тараф эътибор пайдо мекунад ва дар ду
              нусхаи дорои қувваи баробар тартиб дода шудааст.
            </p>
          </div>
        </section>

        {/* Payments annex (only when a schedule/payments exist) */}
        {payments.length > 0 && (
          <section style={{ borderTop: `2px solid ${PLUM}` }} className="pt-3">
            <p className="mb-2 text-center text-[12.5px] font-bold uppercase tracking-[0.18em] text-slate-900">
              Замима — ҷадвали пардохтҳо
            </p>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-300 text-left text-[10.5px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-1.5 font-semibold">№</th>
                  <th className="px-2 py-1.5 font-semibold">Сана</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Маблағ</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Пардохт шуд</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1.5">{p.due_date}</td>
                    <td className="px-2 py-1.5 text-right font-medium">
                      {formatCurrency(p.amount, contract.currency)}
                    </td>
                    <td className="px-2 py-1.5 text-center">{p.paid ? "✓" : "—"}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${PLUM}` }}>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                    Ҷамъ
                  </td>
                  <td style={{ color: PLUM }} className="px-2 py-1.5 text-right font-bold">
                    {formatCurrency(scheduleTotal, contract.currency)}
                  </td>
                  <td className="px-2 py-1.5" />
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* Signatures */}
        <div className="mt-1 grid grid-cols-2 gap-10">
          <div>
            <p
              style={{ borderBottom: `2px solid ${PLUM}` }}
              className="pb-1 text-[12.5px] font-bold tracking-wide"
            >
              «ФУРӮШАНДА»
            </p>
            <div className="mt-1.5 text-[11px] leading-[1.6] text-slate-600">
              <p className="font-semibold text-slate-900">{companyName}</p>
              {settings.company_director && <p>{settings.company_director}</p>}
              {settings.company_address && <p>{settings.company_address}</p>}
              {settings.company_bank_details && <p>{settings.company_bank_details}</p>}
            </div>
            <div className="mt-6 border-b border-slate-400" />
            <p className="mt-0.5 text-[10px] text-slate-400">
              имзо · {settings.company_director || companyName}
            </p>
            <div className="mt-3 flex h-14 w-40 items-center justify-center rounded-lg border-[1.5px] border-dashed border-slate-300 text-[11px] tracking-widest text-slate-300">
              М. П.
            </div>
          </div>
          <div>
            <p
              style={{ borderBottom: `2px solid ${PLUM}` }}
              className="pb-1 text-[12.5px] font-bold tracking-wide"
            >
              «ХАРИДОР»
            </p>
            <div className="mt-1.5 text-[11px] leading-[1.6] text-slate-600">
              <p className="font-semibold text-slate-900">{contract.client?.name ?? "—"}</p>
              {contract.client?.passport && <p>Шиноснома: {contract.client.passport}</p>}
              {contract.client?.passport_issued_by && (
                <p>Додашуда: {contract.client.passport_issued_by}</p>
              )}
              {contract.client?.phone && <p>Тел: {contract.client.phone}</p>}
              {contract.client?.address && <p>{contract.client.address}</p>}
            </div>
            <div className="mt-6 border-b border-slate-400" />
            <p className="mt-0.5 text-[10px] text-slate-400">
              имзо · {contract.client?.name ?? "—"}
            </p>
            <div className="mt-4 w-32 border-b border-slate-400" />
            <p className="mt-0.5 text-[10px] text-slate-400">сана</p>
          </div>
        </div>
      </div>

      {/* Footer requisites strip */}
      <div className="border-t border-slate-200 px-8 py-2 text-center text-[9.5px] tracking-wide text-slate-400">
        {[companyName, settings.company_address, settings.company_bank_details]
          .filter(Boolean)
          .join(" · ")}
      </div>
      <div style={{ borderTop: `3px solid ${PLUM}` }} />
    </div>
  );
}
