import type { Currency } from "@/lib/currency";

const ONES = ["", "як", "ду", "се", "чор", "панҷ", "шаш", "ҳафт", "ҳашт", "нӯҳ"];
const TEENS = [
  "даҳ",
  "ёздаҳ",
  "дувоздаҳ",
  "сездаҳ",
  "чордаҳ",
  "понздаҳ",
  "шонздаҳ",
  "ҳабдаҳ",
  "ҳаждаҳ",
  "нуздаҳ",
];
const TENS = ["", "", "бист", "си", "чил", "панҷоҳ", "шаст", "ҳафтод", "ҳаштод", "навад"];

function twoDigitsToWords(n: number): string {
  if (n === 0) return "";
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? TENS[tens] : `${TENS[tens]}у ${ONES[ones]}`;
}

function threeDigitsToWords(n: number): string {
  if (n === 0) return "";
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const segments: string[] = [];
  if (hundreds > 0) segments.push(hundreds === 1 ? "сад" : `${ONES[hundreds]}сад`);
  if (rest > 0) segments.push(twoDigitsToWords(rest));
  return segments.join("у ");
}

function integerToWordsTj(n: number): string {
  if (n === 0) return "сифр";

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  const segments: string[] = [];
  if (millions > 0) {
    segments.push(`${millions === 1 ? "як" : threeDigitsToWords(millions)} миллион`);
  }
  if (thousands > 0) {
    segments.push(thousands === 1 ? "ҳазор" : `${threeDigitsToWords(thousands)} ҳазор`);
  }
  if (rest > 0) {
    segments.push(threeDigitsToWords(rest));
  }
  return segments.join("у ");
}

const CURRENCY_WORDS: Record<Currency, string> = {
  TJS: "сомонӣ",
  USD: "доллари ИМА",
};

const SUBUNIT_WORDS: Record<Currency, string> = {
  TJS: "дирам",
  USD: "сент",
};

// Tajik number-to-words for the contract's "сумма прописью" field.
//
// The fractional part is spelled out too when there is one ("... сомонӣ ва
// чордаҳ дирам"), matching the company's paper contract: the total price is
// usually round, but the price per m² almost never is (6355,14), and on a
// legal document that rounding would misstate the agreed rate.
export function amountToWordsTj(amount: number, currency: Currency): string {
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  // Round the subunits rather than truncate, so 6355.149 -> 15 dirams, and
  // guard the carry case (…​.999 -> 100 subunits) by rolling into the unit.
  let subunits = Math.round((abs - whole) * 100);
  let units = whole;
  if (subunits === 100) {
    units += 1;
    subunits = 0;
  }

  const words = integerToWordsTj(units);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  const base = `${capitalized} ${CURRENCY_WORDS[currency]}`;
  if (subunits === 0) return base;
  return `${base} ва ${integerToWordsTj(subunits)} ${SUBUNIT_WORDS[currency]}`;
}
