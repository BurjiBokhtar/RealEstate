"use client";

import { useSettings } from "@/lib/settings/SettingsProvider";
import { bareCompanyName } from "@/lib/settings/companyName";
import type { Currency } from "@/lib/currency";
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

const SERIF = { fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif" };

// Tajik month names -- the paper contract dates in words, not 2026-03-14.
const TJ_MONTHS = [
  "январ",
  "феврал",
  "март",
  "апрел",
  "май",
  "июн",
  "июл",
  "август",
  "сентябр",
  "октябр",
  "ноябр",
  "декабр",
];

function tjLongDate(iso: string | null): string {
  if (!iso) return "____________";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${TJ_MONTHS[d.getMonth()]} ${d.getFullYear()} с.`;
}

// The paper contract writes sums as "340000 сомонӣ" / "6355,14 сомонӣ" --
// the Tajik currency word, not the TJS ticker that formatCurrency emits for
// the screen, and a decimal comma with no thousands spaces.
const CURRENCY_WORD: Record<Currency, string> = {
  TJS: "сомонӣ",
  USD: "доллари ИМА",
};

function docAmount(value: number, currency: Currency): string {
  const hasFraction = Math.round(value * 100) % 100 !== 0;
  const num = hasFraction ? value.toFixed(2).replace(".", ",") : String(Math.round(value));
  return `${num} ${CURRENCY_WORD[currency]}`;
}

// Areas print as "53,50 м²" -- two decimals, decimal comma.
function docArea(value: number | null): string {
  return value == null ? "__" : value.toFixed(2).replace(".", ",");
}

function shortDate(iso: string | null): string {
  if (!iso) return "__.__.____";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const PLUM = "#5b3468";

// Numbered section heading: a plum numeral in an outlined disc, the title,
// then a hairline rule running to the margin. Outlined rather than filled
// because a filled disc vanishes when the print dialog's "background
// graphics" box is unticked -- which is the default.
function Section({ num, title }: { num: number; title: string }) {
  return (
    <div className="mt-2.5 flex items-center gap-2 break-inside-avoid break-after-avoid">
      <span
        style={{ borderColor: PLUM, color: PLUM }}
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[10px] font-bold"
      >
        {num}
      </span>
      <span className="shrink-0 text-[12px] font-bold uppercase tracking-[0.07em]">
        {title}
      </span>
      <span style={{ backgroundColor: PLUM }} className="h-px flex-1 opacity-30" />
    </div>
  );
}

// Data that changes with every deal -- buyer, apartment, sums, dates.
// Rendered like a filled-in field (bold, dotted plum underline) so the
// document reads as a completed form rather than a wall of prose, and so
// staff can eyeball the substituted values before signing. The company's
// own details are deliberately NOT marked this way: they're constant.
function Var({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{ borderBottom: `1px dotted ${PLUM}` }}
      className="font-bold text-slate-900"
    >
      {children}
    </span>
  );
}

// One clean key/value row inside the deal-summary panel (no table borders,
// just a hairline divider). The legal clauses below reference this panel
// instead of restating every number.
function SummaryRow({
  label,
  value,
  big,
  last,
}: {
  label: string;
  value: React.ReactNode;
  big?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1.5 ${
        last ? "" : "border-b border-slate-100"
      }`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </span>
      <span
        className={`text-right font-bold ${big ? "text-[15px]" : "text-[12.5px]"}`}
        style={big ? { color: PLUM } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

// A tiny stacked stat for the accent rail (label above, value below).
function RailStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="text-[13px] font-bold leading-tight">{value}</p>
    </div>
  );
}

// The company's official cooperation contract (ШАРТНОМАИ ҲАМКОРӢ), wording
// taken verbatim from Намунаи шартномаи Бурҷи Бохтар.docx -- only the
// party/apartment/amount specifics are substituted from the deal. Section
// and clause numbers are kept exactly as in the paper original, because the
// text itself cross-references them ("дар банди 2.2 шартномаи мазкур").
export function ContractDocument({
  contract,
  payments,
  copyLabel,
  apartmentNumber,
}: {
  contract: ContractDocumentData;
  payments: ContractPayment[];
  copyLabel?: string;
  apartmentNumber?: number;
}) {
  const { settings } = useSettings();

  // Bare name: the document supplies the legal form itself, so a stored
  // "ЧДММ «Х»" would otherwise print as "ҶДММ «ЧДММ «Х»»".
  const companyName = bareCompanyName(settings.company_name) || "____________";
  const director = settings.company_director || "____________";
  const buildingAddress =
    contract.object?.building?.address ?? contract.object?.address ?? "____________";
  // The price per m² printed on the contract is THIS deal's individually
  // negotiated rate -- the contract's own total divided by the unit's area --
  // not the building's default listing rate. So a client given a special
  // price sees that price on paper, and re-editing the contract amount
  // re-derives it. Falls back to the building default only when the deal has
  // no usable amount/area yet.
  const dealArea = contract.object?.area ?? null;
  const pricePerSqm =
    dealArea && dealArea > 0 && contract.amount > 0
      ? Math.round((contract.amount / dealArea) * 100) / 100
      : contract.object?.building?.price_per_sqm ?? null;

  const amountWords =
    contract.amount_words || amountToWordsTj(contract.amount, contract.currency);

  const aptNo = apartmentNumber != null ? String(apartmentNumber) : "____";
  const paymentLabel =
    contract.payment_type === "installment"
      ? `Бо қисм · ${contract.installment_months ?? "__"} моҳ`
      : contract.payment_type === "barter"
        ? "Бартер"
        : "Якбора";
  // Order matters here: block/entrance first (which entrance the buyer walks
  // into), then floor, then area, then room count -- matches how the company
  // reads out a unit verbally and how the paper contract should read too.
  const railSub = [
    contract.object?.block ?? null,
    contract.object?.floor != null ? `ошёнаи ${contract.object.floor}` : null,
    dealArea != null ? `${docArea(dealArea)} м²` : null,
    contract.object?.rooms != null ? `${contract.object.rooms} ҳуҷра` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const scheduleTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  // Schedule summary derived from the ACTUAL rows, not recomputed from
  // amount/installment_months -- otherwise a hand-edited plan (irregular down
  // payments, extra one-off payments) printed a headline that contradicted the
  // table below it. Paid-so-far and the remaining count/typical monthly all
  // come straight from the payment rows the table renders.
  const paidRows = payments.filter((p) => p.paid);
  const unpaidRows = payments.filter((p) => !p.paid);
  const paidSoFar = paidRows.reduce((sum, p) => sum + p.amount, 0);
  const remainingSchedule = unpaidRows.reduce((sum, p) => sum + p.amount, 0);
  const typicalMonthly =
    unpaidRows.length > 0
      ? Math.round((remainingSchedule / unpaidRows.length) * 100) / 100
      : null;

  const worksList = [
    "Ороиши намо тибқи лоиҳа.",
    "Ороиши пурраи даромадгоҳи бино.",
    "Зинаҳои печдор бо тахтасангҳо (кафел).",
    "Насбкунии лифт.",
    "Насби таҷҳизотҳои рӯшноӣ дар зинапояҳо ва даромадгоҳ.",
    "Ободонии гирду атрофи бино.",
    "Сохт ва омодасозии майдончаи бозиҳои кӯдакона.",
    "Насби дарҳои хонаҳо аз масолеҳи оҳанӣ.",
    "Тирезаҳо аз ПВХ, истеҳсоли Туркия.",
    "Нуқтаи пайвасти синамо (телевизион).",
    "Пайвасти ноқилҳои барқӣ то нуқтаи аввал.",
    "Нуқтаи пайвасти обу корези (канализатсия).",
    "Ноқили пайвасти дар даромадгоҳ бо дамафон (domofon).",
    "Ноқилҳои пайвасти телефон, интернет ва WiFi.",
  ];

  return (
    <div
      style={SERIF}
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-[11px] leading-[1.4] text-slate-900 shadow-sm print:rounded-none print:border-0 print:shadow-none"
    >
      {/* Watermark: the company logo, washed out and centred behind the text,
          same as the Word original. Deliberately an <img> rather than a CSS
          background -- browsers skip background graphics when printing
          unless the user ticks that box, but real images always print. */}
      {settings.company_logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={settings.company_logo_url}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.12]"
        />
      )}

      {/* Everything sits above the watermark */}
      <div className="relative">
        {copyLabel && (
          <p className="px-6 py-1 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            {copyLabel}
          </p>
        )}

        {/* Letterhead: the company's fixed identity, left; the contract's
            own identity, right. Everything here except the number/date is
            constant across every contract the company ever prints. */}
        <div
          style={{ borderBottom: `2.5px solid ${PLUM}` }}
          className="flex items-start justify-between gap-6 px-10 pb-4 pt-7"
        >
          <div className="flex items-start gap-3">
            {settings.company_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.company_logo_url}
                alt=""
                className="h-14 w-14 shrink-0 object-contain"
              />
            )}
            <div className="leading-[1.45]">
              <p className="text-[15px] font-bold tracking-tight">
                ҶДММ «{companyName}»
              </p>
              {settings.company_address && (
                <p className="text-[10px] text-slate-500">{settings.company_address}</p>
              )}
              {settings.company_bank_details && (
                <p className="text-[9.5px] text-slate-400">{settings.company_bank_details}</p>
              )}
            </div>
          </div>
          <div
            style={{ borderColor: PLUM }}
            className="shrink-0 rounded-lg border-[1.5px] px-3 py-1.5 text-right"
          >
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Шартнома
            </p>
            <p style={{ color: PLUM }} className="text-[17px] font-bold leading-tight">
              №{contract.number || "____"}
            </p>
          </div>
        </div>

        {/* print:block: this is the whole letter body (all 9 sections + the
            payment table), routinely taller than one printed page. Chrome's
            print engine doesn't fragment display:flex containers across
            page breaks the way it does plain block content -- content got
            cut off mid-line or an entire remaining stretch jumped whole to
            the next page. Block flow lets the page-break-inside/orphans/
            widows rules on #contract-print-area (globals.css) do their job. */}
        <div className="flex flex-col gap-1.5 px-9 pb-6 pt-4 print:block">
          {/* Title */}
          <div className="flex items-center gap-3">
            <span style={{ backgroundColor: PLUM }} className="h-px flex-1 opacity-25" />
            <p className="shrink-0 text-center text-[18px] font-bold tracking-[0.14em]">
              ШАРТНОМАИ ҲАМКОРӢ
            </p>
            <span style={{ backgroundColor: PLUM }} className="h-px flex-1 opacity-25" />
          </div>

          <div className="flex items-baseline justify-between text-[12.5px] print:mt-1">
            <span>
              <Var>{shortDate(contract.signed_date)}</Var>{" "}
              <span className="text-slate-500">({tjLongDate(contract.signed_date)})</span>
            </span>
            <span className="font-bold">ш. Бохтар</span>
          </div>

          {/* Deal summary ("Маълумоти аҳд") -- an accent rail with the flat
              number + its key specs, and clean data rows beside it. Every
              figure lives here; the clauses below reference it instead of
              repeating the numbers. */}
          <div
            style={{ borderColor: PLUM }}
            className="mt-3 overflow-hidden rounded-lg border break-inside-avoid"
          >
            <p
              style={{ borderColor: PLUM, color: PLUM }}
              className="border-b px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em]"
            >
              Маълумоти аҳд
            </p>
            <div className="flex">
            <div
              style={{ borderColor: PLUM }}
              className="flex w-36 shrink-0 flex-col gap-2.5 border-r bg-slate-50 p-3 print:bg-white"
            >
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Хона
                </p>
                <p style={{ color: PLUM }} className="text-[30px] font-bold leading-none">
                  №{aptNo}
                </p>
              </div>
              {railSub && <p className="text-[10.5px] text-slate-600">{railSub}</p>}
              <div className="mt-auto flex flex-col gap-2 pt-1">
                <RailStat
                  label="Масоҳат"
                  value={`${docArea(contract.object?.area ?? null)} м²`}
                />
                {pricePerSqm != null && (
                  <RailStat label="Нарх/м²" value={docAmount(pricePerSqm, contract.currency)} />
                )}
              </div>
            </div>

            <div className="flex-1 px-3.5 py-1.5">
              <SummaryRow label="Фурӯшанда" value={`ҶДММ «${companyName}»`} />
              <SummaryRow label="Харидор" value={contract.client?.name ?? "____________"} />
              <SummaryRow label="Шиноснома" value={contract.client?.passport ?? "—"} />
              <SummaryRow label="Навъи пардохт" value={paymentLabel} />
              <SummaryRow
                label="Маблағи умумӣ"
                value={docAmount(contract.amount, contract.currency)}
                big
                last
              />
            </div>
            </div>
          </div>

          <Section num={1} title="Тарафҳои аҳдкунанда" />
          <p className="text-justify">
            Ҷамъияти дорои масъулияти маҳдуди «{companyName}» дар шахсияти роҳбари ҷамъият{" "}
            <b>{director}</b>, ки дар асоси Оинномаи ҷамъият амал мекунад, аз як тараф,
            минбаъд <b>«Фурӯшанда»</b> ва аз тарафи дигар шаҳрванди Ҷумҳурии Тоҷикистон{" "}
            <Var>{contract.client?.name ?? "____________"}</Var>
            {contract.client?.passport ? ", шиноснома № " : ""}
            {contract.client?.passport && <Var>{contract.client.passport}</Var>}
            {contract.client?.passport_issued_by ? ", дода шудааст аз ҷониби " : ""}
            {contract.client?.passport_issued_by && (
              <Var>{contract.client.passport_issued_by}</Var>
            )}
            , ки минбаъд <b>«Харидор»</b> номида мешавад, ҳамин шартномаро бо шартҳои зерин
            бастанд.
          </p>

          <Section num={2} title="Мақсади шартнома" />
          <p className="text-justify">
            2.1. Бо мақсади вусъат бахшидани рафти сохтмони биноҳои истиқоматии баландошёна
            бо пентхаус, дар ошёнаи якум маркази савдо ва хизматрасонӣ ва дар таҳхонаҳои онҳо
            ташкил намудани таваққуфгоҳи зеризаминӣ, воқеъ дар <Var>{buildingAddress}</Var>, тарафҳо
            уҳдадор шуданд, ки бо шартҳои манфиати мутақобила ҳамкорӣ намоянд.
          </p>
          <p className="text-justify">
            2.2. «Фурӯшанда» имконият медиҳад, ки «Харидор» дар маблағгузории иншооти мазкур
            ширкат намуда, ҳуҷраи истиқоматии <Var>№{aptNo}</Var>-ро, ки нишондиҳандаҳои он
            (ошёна, шумораи ҳуҷраҳо, масоҳат ва нарх барои 1 м²) дар «Маълумоти аҳд»-и боло
            оварда шудаанд, ба моликияти худ ба расмият дарорад. «Харидор» уҳдадор мешавад, ки
            маблағи умумии дар «Маълумоти аҳд» нишондодашударо ({amountWords}) дар муҳлати
            пешбининамудаи шартномаи мазкур пардохт намуда, минбаъд онро ба моликияти шахсии
            худ табдил диҳад.
          </p>
          <p className="text-justify">
            2.3. «Фурӯшанда» бо анҷом расидани корҳои сохтмонӣ ва супоридани иншоот ба
            «Харидор» масоҳати зикршударо, ки дар банди 2.2-и шартномаи мазкур нишон дода
            шудааст, месупорад.
          </p>
          <p className="text-justify">
            2.4. «Харидор» аз лаҳзаи бастани шартномаи ҳамкорӣ талаботи дар банди 2.2-и
            шартномаи мазкур нишон додашударо таъмин менамояд.
          </p>

          <Section num={3} title="Уҳдадориҳои тарафҳо" />
          <p className="text-justify">
            3.1. «Фурӯшанда» уҳдадор мешавад ба «Харидор» барои ба расмият даровардани
            манзили истиқоматӣ ба моликияти шахсӣ шиносномаи техникӣ диҳад, ки он баъди
            қабули иншоот ба баҳрабардорӣ дода мешавад.
          </p>
          <p className="text-justify">
            3.2. Тамоми хароҷоти вобаста ба ҳуҷҷатгузории нотариалӣ ва бақайдгирии давлатӣ,
            аз рӯи нархномаи КДФБММГ ва нотариуси давлатӣ, мустақилона аз ҷониби «Харидор»
            пардохт карда мешавад.
          </p>

          <Section num={4} title="Масъулияти тарафҳо" />
          <p className="text-justify">
            4.1. «Харидор» барои саривақт пардохт намудани маблағи шартнома дар банди 2.2
            шартномаи мазкур нишондодашуда масъул мебошад.
          </p>
          <p className="text-justify">
            4.2. «Фурӯшанда» барои саривақт ва босифат иҷро намудани корҳои сохтмонӣ –
            васлкунии иншоот масъул мебошад.
          </p>

          <Section num={5} title="Чораҳои ҷаримавӣ" />
          <p className="text-justify">
            5.1. Дар мавриди риоя накардани муҳлати пардохт зиёда аз як моҳ ба андозаи 0,1%
            аз маблағи умумии шартнома барои ҳар як рӯзи ба таъхирандозӣ, на зиёда аз 10%,
            «Харидор» ба «Фурӯшанда» ҷарима пардохт менамояд.
          </p>
          <p className="text-justify">
            5.2. Дар ҳолати «Харидор» пас аз анҷоми сохтмони бинои истиқоматии бисёрошёна дар
            банди 2.2 шартномаи мазкур муқараргардидаро рад намояд, бо ҷарима ситонида ба
            андозаи 10%-и маблағи умумии дар шартнома зикршуда баргардонида мешавад.
          </p>

          <Section num={6} title="Ҳолатҳои бекор намудани шартнома" />
          <p className="text-justify">
            6.1. Шартнома тибқи мувофиқаи тарафайн то пардохт намудан ва ё бо тартиби
            яктарафа дар мавриди қобилияти имконнопазир рад намуда, «Харидор» изҳори
            боздошти пардохт беш аз як моҳ аз муҳлати пардохт метавон бекор кард.
          </p>
          <p className="text-justify">
            6.2. Дар сурати 2 (ду) моҳ пардохт накардани маблағ аз тарафи «Харидор», онгоҳ
            «Фурӯшанда» метавонад дигар муштариро барои ҳуҷраи дар банди 2.2 шартномаи мазкур
            аз нав бандад.
          </p>

          <Section num={7} title="Форс-мажор" />
          <p className="text-justify">
            7.1. Ягон тараф масъулиятро барои иҷро накардан ва иҷрои номатлуби уҳдадориҳои
            худ нахоҳад бурд, агар иҷрои номатлуб дар ҳолати қувваи рафънопазир номумкин
            гашта бошад, яъне ҳолатҳои фавқулода, ки онҳо баъди бастани Шартномаҳои мазкур ба
            вуҷуд омаданд. Ба чунин ҳолатҳо дохил мешавад: сӯхтор, обхезӣ, заминҷунбӣ ва
            дигар офатҳои табиӣ, ки уҳдадориҳои тарафҳоро номумкин мегардонад.
          </p>
          <p className="text-justify">
            7.2. Агар ҳамагуна аз ҳолатҳои мазкур бевосита барои иҷрои уҳдадориҳо ба
            муҳлате, ки дар шартномаи мазкур дарҷ шудааст, таъсир расонида, муҳлати мазкур ба
            вақти амалии ҳолати дахлдор дароз карда мешавад.
          </p>

          <Section num={8} title="Ҳалли баҳсҳо" />
          <p className="text-justify">
            8.1. Баҳсҳои зимни амалисозии шартномаи мазкур рухдиҳандаро метавон бо роҳи
            гуфтушунид ҳал намуд. Дар мавриди бо гуфтушунид ҳал нагардидани баҳс, он дар
            асоси Қонунҳои амалкунандаи Ҷумҳурии Тоҷикистон дар Суди иқтисодии шаҳри Бохтар
            ҳаллу фасл карда мешавад.
          </p>
          <p className="text-justify">
            8.2. Шартномаи мазкур аз лаҳзаи ба имзо расонидани ҳар ду тараф эътибор пайдо
            менамояд.
          </p>
          <p className="text-justify">
            8.3. Ба Шартномаи мазкур номгӯи намуди корҳои иҷронамудаи «Фурӯшанда» замима
            гардида, қисми ҷудонопазири шартнома ба шумор рафта, шартнома дар ду нусха бо
            забони тоҷикӣ барои ҳар кадом тарафҳо тартиб дода шудааст ва эътибор ва ҳуқуқи
            якхела дорад.
          </p>

          {/* Payment schedule -- only when the deal actually has one. Not in
              the paper original (which is always full payment), so it goes
              after the body as its own annex. */}
          {contract.payment_type === "installment" && payments.length > 0 && (
            <>
              <p className="mt-4 text-center text-[14px] font-bold">
                ҶАДВАЛИ ПАРДОХТҲО
              </p>
              <p className="text-justify">
                Пардохтшуда: <b>{docAmount(paidSoFar, contract.currency)}</b>; боқимонда:{" "}
                <b>{docAmount(remainingSchedule, contract.currency)}</b>
                {unpaidRows.length > 0 && typicalMonthly != null && (
                  <>
                    {" "}
                    дар <b>{unpaidRows.length}</b> қисм, ҳар моҳ тақрибан{" "}
                    <b>{docAmount(typicalMonthly, contract.currency)}</b>
                  </>
                )}
                .
              </p>
              <table className="mt-1 w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-slate-400 text-left">
                    <th className="px-2 py-1 font-semibold">№</th>
                    <th className="px-2 py-1 font-semibold">Сана</th>
                    <th className="px-2 py-1 text-right font-semibold">Маблағ</th>
                    <th className="px-2 py-1 text-center font-semibold">Пардохт шуд</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} className="border-b border-slate-200">
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1">{shortDate(p.due_date)}</td>
                      <td className="px-2 py-1 text-right">
                        {docAmount(p.amount, contract.currency)}
                      </td>
                      <td className="px-2 py-1 text-center">{p.paid ? "✓" : "—"}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-900 font-bold">
                    <td className="px-2 py-1" />
                    <td className="px-2 py-1">Ҷамъ</td>
                    <td className="px-2 py-1 text-right">
                      {docAmount(scheduleTotal, contract.currency)}
                    </td>
                    <td className="px-2 py-1" />
                  </tr>
                </tbody>
              </table>
            </>
          )}

          <Section num={9} title="Суроғаи ҳуқуқӣ ва имзои тарафҳо" />

          {/* Two party cards. The seller's block is the company's fixed
              identity (settings); the buyer's is the part that differs on
              every contract, so it gets the filled-field treatment. */}
          <div className="mt-1 grid grid-cols-2 gap-5 text-[11.5px] leading-[1.55]">
            <div
              style={{ borderColor: PLUM }}
              className="flex flex-col rounded-lg border p-3.5"
            >
              <p
                style={{ borderColor: PLUM, color: PLUM }}
                className="border-b pb-1 text-[12.5px] font-bold tracking-wide"
              >
                «ФУРӮШАНДА»
              </p>
              <p className="mt-1.5">Роҳбари ҶДММ «{companyName}»</p>
              <p className="text-[12.5px] font-bold">{director}</p>
              {settings.company_address && (
                <p className="text-slate-600">{settings.company_address}</p>
              )}
              {settings.company_bank_details && (
                <p className="whitespace-pre-line text-slate-600">
                  {settings.company_bank_details}
                </p>
              )}
              <div className="mt-auto pt-6">
                <div className="border-b border-slate-400" />
                <p className="mt-0.5 text-[9.5px] text-slate-400">имзо</p>
                <p className="mt-2">
                  Санаи <Var>{shortDate(contract.signed_date)}</Var>
                </p>
                <div className="mt-2.5 flex h-14 w-32 items-center justify-center rounded-lg border-[1.5px] border-dashed border-slate-300 text-[10px] tracking-[0.2em] text-slate-300">
                  М. П.
                </div>
              </div>
            </div>

            <div
              style={{ borderColor: PLUM }}
              className="flex flex-col rounded-lg border p-3.5"
            >
              <p
                style={{ borderColor: PLUM, color: PLUM }}
                className="border-b pb-1 text-[12.5px] font-bold tracking-wide"
              >
                «ХАРИДОР»
              </p>
              <p className="mt-1.5 text-[12.5px]">
                <Var>{contract.client?.name ?? "____________"}</Var>
              </p>
              {contract.client?.passport && (
                <p className="text-slate-600">Шиноснома: {contract.client.passport}</p>
              )}
              {contract.client?.passport_issued_by && (
                <p className="text-slate-600">
                  Дода шудааст: {contract.client.passport_issued_by}
                </p>
              )}
              {contract.client?.address && (
                <p className="text-slate-600">{contract.client.address}</p>
              )}
              {contract.client?.phone && (
                <p className="text-slate-600">Тел: {contract.client.phone}</p>
              )}
              <div className="mt-auto pt-6">
                <div className="border-b border-slate-400" />
                <p className="mt-0.5 text-[9.5px] text-slate-400">имзо</p>
                <p className="mt-2">
                  Санаи <Var>{shortDate(contract.signed_date)}</Var>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ЗАМИМА -- its own page, as in the original. print:block for the
            same reason as the body above: this can run past one page too
            (14-item list + two signature blocks), and a flex container
            doesn't paginate the overflow onto the next page cleanly. */}
        <div className="flex flex-col gap-1.5 px-10 pb-8 pt-7 print:break-before-page print:block">
          <div className="flex items-center gap-3">
            <span style={{ backgroundColor: PLUM }} className="h-px flex-1 opacity-25" />
            <p className="shrink-0 text-center text-[16px] font-bold tracking-[0.18em]">
              ЗАМИМА
            </p>
            <span style={{ backgroundColor: PLUM }} className="h-px flex-1 opacity-25" />
          </div>
          <p className="text-center text-[12.5px] font-bold">
            Номгӯи корҳои иҷрошаванда ва масолеҳҳои истифодашаванда
          </p>
          <p className="mt-1 text-justify">
            Корҳои сохтмонию васлкунии ба анҷом расонидашуда ва иншооти мазкур барои
            баҳрабардорӣ ва расмиятдарорӣ бо моликият пас аз анҷоми корҳои зайл омода
            ҳисобида мешаванд:
          </p>
          {/* Two columns: the list is 14 short items, so a single column
              left half the page empty and pushed the signatures over. */}
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5">
            {worksList.map((w, i) => (
              <div key={w} className="flex items-baseline gap-2 py-[2px]">
                <span
                  style={{ color: PLUM }}
                  className="shrink-0 text-[10px] font-bold tabular-nums"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[12px]">{w}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-8 text-center text-[12px]">
            <div>
              <p style={{ color: PLUM }} className="text-[12.5px] font-bold">
                «Фурӯшанда»
              </p>
              <p className="mt-1">Роҳбари ҶДММ «{companyName}»</p>
              <p className="font-bold">{director}</p>
              <div className="mx-auto mt-7 w-4/5 border-b border-slate-400" />
              <p className="mt-0.5 text-[9.5px] text-slate-400">имзо</p>
            </div>
            <div>
              <p style={{ color: PLUM }} className="text-[12.5px] font-bold">
                «Харидор»
              </p>
              <p className="mt-1">
                <Var>{contract.client?.name ?? "____________"}</Var>
              </p>
              <div className="mx-auto mt-7 w-4/5 border-b border-slate-400" />
              <p className="mt-0.5 text-[9.5px] text-slate-400">имзо</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
