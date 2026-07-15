"use client";

import { useSettings } from "@/lib/settings/SettingsProvider";
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

// Numbered section heading, matching the paper contract's structure.
function Section({ num, title }: { num: number; title: string }) {
  return (
    <p className="mt-3 text-center text-[14px] font-bold">
      {num}. {title}
    </p>
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

  const companyName = settings.company_name || "____________";
  const director = settings.company_director || "____________";
  const buildingAddress =
    contract.object?.building?.address ?? contract.object?.address ?? "____________";
  const pricePerSqm = contract.object?.building?.price_per_sqm ?? null;

  const amountWords =
    contract.amount_words || amountToWordsTj(contract.amount, contract.currency);
  const pricePerSqmWords =
    pricePerSqm != null ? amountToWordsTj(pricePerSqm, contract.currency) : null;

  const aptNo = apartmentNumber != null ? String(apartmentNumber) : "____";
  const scheduleTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  const monthly =
    contract.payment_type === "installment" && contract.installment_months
      ? Math.floor(
          ((contract.amount - contract.paid_amount) / contract.installment_months) * 100
        ) / 100
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
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-[13px] leading-[1.6] text-slate-900 shadow-sm print:rounded-none print:border-0 print:shadow-none"
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

        <div className="flex flex-col gap-2 px-10 py-8">
          <p className="text-center text-[17px] font-bold tracking-wide">
            ШАРТНОМАИ ҲАМКОРӢ
            {contract.number ? ` №${contract.number}` : ""}
          </p>

          <div className="flex items-baseline justify-between text-[13px] font-bold">
            <span>{tjLongDate(contract.signed_date)}</span>
            <span>ш. Бохтар</span>
          </div>

          <Section num={1} title="Тарафҳои аҳдкунанда" />
          <p className="text-justify">
            Ҷамъияти дорои масъулияти маҳдуди «{companyName}» дар шахсияти роҳбари ҷамъият{" "}
            <b>{director}</b>, ки дар асоси Оинномаи ҷамъият амал мекунад, аз як тараф,
            минбаъд <b>«Фурӯшанда»</b> ва аз тарафи дигар шаҳрванди Ҷумҳурии Тоҷикистон{" "}
            <b>{contract.client?.name ?? "____________"}</b>
            {contract.client?.passport ? `, шиноснома № ${contract.client.passport}` : ""}
            {contract.client?.passport_issued_by
              ? `, дода шудааст аз ҷониби ${contract.client.passport_issued_by}`
              : ""}
            , ки минбаъд <b>«Харидор»</b> номида мешавад, ҳамин шартномаро бо шартҳои зерин
            бастанд.
          </p>

          <Section num={2} title="Мақсади шартнома" />
          <p className="text-justify">
            2.1. Бо мақсади вусъат бахшидани рафти сохтмони биноҳои истиқоматии баландошёна
            бо пентхаус, дар ошёнаи якум маркази савдо ва хизматрасонӣ ва дар таҳхонаҳои онҳо
            ташкил намудани таваққуфгоҳи зеризаминӣ, воқеъ дар {buildingAddress}, тарафҳо
            уҳдадор шуданд, ки бо шартҳои манфиати мутақобила ҳамкорӣ намоянд.
          </p>
          <p className="text-justify">
            2.2. «Фурӯшанда» имконият медиҳад, ки «Харидор» дар маблағгузории иншооти мазкур
            ширкат намуда, барои ба моликияти худ ба расмият даровардани ҳуҷраи истиқоматӣ{" "}
            {contract.object?.block ? `дар ${contract.object.block}, ` : ""}
            дар ошёнаи <b>{contract.object?.floor ?? "__"}</b>-ум,{" "}
            <b>{contract.object?.rooms ?? "__"}</b>-ҳуҷрагӣ, бо масоҳати{" "}
            <b>{docArea(contract.object?.area ?? null)} м²</b> (масоҳати умумӣ мувофиқи лоиҳа{" "}
            {docArea(contract.object?.area ?? null)} м²), ҳуҷраи <b>№{aptNo}</b>
            {pricePerSqm != null && (
              <>
                , ки маблағи фурӯш барои 1 м² —{" "}
                <b>{docAmount(pricePerSqm, contract.currency)}</b> ({pricePerSqmWords})
                мебошад
              </>
            )}
            , пардохт намояд. «Харидор» уҳдадор мешавад, ки маблағи умумии хонаи
            истиқоматиро — <b>{docAmount(contract.amount, contract.currency)}</b> (
            {amountWords}) — пардохт намуда, дар муҳлати пешбининамудаи шартномаи мазкур онро
            минбаъд ба моликияти шахсии худ табдил дода, иҷро намояд.
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
              {monthly != null && (
                <p className="text-justify">
                  Пардохти аввал: <b>{docAmount(contract.paid_amount, contract.currency)}</b>
                  ; боқимонда дар <b>{contract.installment_months}</b> моҳ, ҳар моҳ тақрибан{" "}
                  <b>{docAmount(monthly, contract.currency)}</b>.
                </p>
              )}
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

          <p className="mt-4 text-[14px] font-bold">Суроғаи ҳуқуқӣ ва имзои тарафҳо:</p>

          <div className="mt-1 grid grid-cols-2 gap-8 text-[12px] leading-[1.55]">
            <div>
              <p className="text-[13px] font-bold">«ФУРӮШАНДА»</p>
              <p className="mt-1">Роҳбари ҶДММ «{companyName}»</p>
              <p className="font-bold">{director}</p>
              {settings.company_address && <p>{settings.company_address}</p>}
              {settings.company_bank_details && (
                <p className="whitespace-pre-line">{settings.company_bank_details}</p>
              )}
              <p className="mt-5 font-bold">Имзо ___________________</p>
              <p className="mt-1">Санаи {shortDate(contract.signed_date)}</p>
              <div className="mt-3 flex h-16 w-40 items-center justify-center rounded-lg border-[1.5px] border-dashed border-slate-300 text-[11px] tracking-widest text-slate-300">
                М. П.
              </div>
            </div>
            <div>
              <p className="text-[13px] font-bold">«ХАРИДОР»</p>
              <p className="mt-1 font-bold">{contract.client?.name ?? "____________"}</p>
              {contract.client?.passport && <p>Шиноснома: {contract.client.passport}</p>}
              {contract.client?.passport_issued_by && (
                <p>Дода шудааст: {contract.client.passport_issued_by}</p>
              )}
              {contract.client?.address && <p>{contract.client.address}</p>}
              {contract.client?.phone && <p>Тел: {contract.client.phone}</p>}
              <p className="mt-5 font-bold">Имзо ___________________</p>
              <p className="mt-1">Санаи {shortDate(contract.signed_date)}</p>
            </div>
          </div>
        </div>

        {/* ЗАМИМА -- its own page, as in the original */}
        <div className="flex flex-col gap-1.5 px-10 pb-8 print:break-before-page">
          <p className="text-center text-[15px] font-bold tracking-wide">ЗАМИМА</p>
          <p className="text-center text-[13px] font-bold">
            Номгӯи корҳои иҷрошаванда ва масолеҳҳои истифодашаванда
          </p>
          <p className="mt-1 text-justify">
            Корҳои сохтмонию васлкунии ба анҷом расонидашуда ва иншооти мазкур барои
            баҳрабардорӣ ва расмиятдарорӣ бо моликият пас аз анҷоми корҳои зайл омода
            ҳисобида мешаванд:
          </p>
          <ol className="mt-1 list-decimal pl-6">
            {worksList.map((w) => (
              <li key={w} className="py-[1px]">
                {w}
              </li>
            ))}
          </ol>

          <div className="mt-6 grid grid-cols-2 gap-8 text-center text-[12px]">
            <div>
              <p className="text-[13px] font-bold">«Фурӯшанда»</p>
              <p className="mt-1">Роҳбари ҶДММ «{companyName}»</p>
              <p className="font-bold">{director}</p>
              <p className="mt-5 font-bold">Имзо ________________</p>
            </div>
            <div>
              <p className="text-[13px] font-bold">«Харидор»</p>
              <p className="mt-1 font-bold">{contract.client?.name ?? "____________"}</p>
              <p className="mt-5 font-bold">Имзо ________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
