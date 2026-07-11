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

// Best-effort Tajik number-to-words for the contract's "сумма прописью"
// field. Fractional amounts are rounded to the nearest whole unit -- real
// estate contracts are effectively always round numbers in practice.
export function amountToWordsTj(amount: number, currency: Currency): string {
  const whole = Math.round(Math.abs(amount));
  const words = integerToWordsTj(whole);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} ${CURRENCY_WORDS[currency]}`;
}
