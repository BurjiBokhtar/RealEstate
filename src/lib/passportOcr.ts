// Turns whatever Tesseract recognised off a photographed ID into a best-guess
// at the client fields it might fill -- name, document number, issuing
// authority, birth date, address.
//
// There is no confirmed layout to match against: Tajikistan's new
// biometric ID card's exact field positions and labels aren't something
// this codebase has a verified sample of. So this is deliberately loose --
// label keywords in both Tajik and Russian (most Tajik ID documents print
// both), a couple of regexes for shapes that are true regardless of layout
// (a date looks like a date, a document number is letters+digits) -- and
// every guess is meant to be reviewed, not trusted blindly. PassportScanner
// always shows the raw recognised text next to the guesses for exactly that
// reason. When a real document layout is known, tighten the patterns here;
// nothing else needs to change.

export type ExtractedFields = {
  name?: string;
  passport?: string;
  passport_issued_by?: string;
  birth_date?: string;
  address?: string;
};

// Label words that might introduce a field, tried in order until one
// matches a line. Tajik first (the primary language of the document),
// Russian second (most Tajik ID documents print both).
const LABELS: Record<keyof ExtractedFields, RegExp[]> = {
  name: [/ному\s*насаб/i, /насаб.{0,3}ном/i, /ф\.?и\.?о\.?/i, /фамилия/i],
  passport: [/рақами\s*ҳуҷҷат/i, /серия/i, /№/],
  passport_issued_by: [/аз\s*ҷониби/i, /кем\s*выдан/i, /бо\s*кӣ\s*дода/i],
  birth_date: [/санаи\s*таваллуд/i, /дата\s*рождения/i],
  address: [/суроға/i, /ҷои\s*истиқомат/i, /адрес/i, /прописка/i],
};

// dd.mm.yyyy / dd-mm-yyyy / dd/mm/yyyy, tolerant of OCR swapping the
// separator or dropping a leading zero.
const DATE_RE = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\b/g;

// A document number shaped like most CIS-region ID/passport numbers:
// 1-3 letters (Cyrillic or Latin -- OCR mixes them up) then 6-9 digits,
// with or without a space between. Falls back to a bare 7+ digit run.
const DOC_NO_RE = /\b([A-ZА-Я]{1,3}\s?\d{6,9})\b/;
const DIGIT_RUN_RE = /\b(\d{7,9})\b/;

function toIsoDate(d: string, m: string, y: string): string | null {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!day || !month || !year) return null;
  if (day > 31 || month > 12) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// The line right after a label line is usually the value on an ID card
// (label and value are rarely on the same OCR line once the layout has
// any width to it) -- fall back to text after the label on the SAME line
// for the cases where they are.
function valueAfterLabel(lines: string[], pattern: RegExp): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(pattern);
    if (!m) continue;
    const rest = line.slice((m.index ?? 0) + m[0].length).replace(/^[\s:.\-–]+/, "").trim();
    if (rest.length > 1) return rest;
    const next = lines[i + 1]?.trim();
    if (next) return next;
  }
  return null;
}

export function extractFields(rawText: string): ExtractedFields {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: ExtractedFields = {};

  for (const key of Object.keys(LABELS) as Array<keyof ExtractedFields>) {
    for (const pattern of LABELS[key]) {
      const value = valueAfterLabel(lines, pattern);
      if (value) {
        out[key] = value;
        break;
      }
    }
  }

  // Birth date: prefer whatever a "санаи таваллуд" label pointed at, but
  // that's free text at this point -- re-run the date shape over it, and
  // if the label match wasn't a real date, fall back to the EARLIEST date
  // found anywhere in the document. An ID card's other dates (issue,
  // expiry) are recent by definition; birth date is normally the odd one
  // out and the furthest in the past.
  const fromLabel = out.birth_date ? [...out.birth_date.matchAll(DATE_RE)][0] : null;
  if (fromLabel) {
    out.birth_date = toIsoDate(fromLabel[1], fromLabel[2], fromLabel[3]) ?? undefined;
  } else {
    const allDates = [...rawText.matchAll(DATE_RE)]
      .map((m) => toIsoDate(m[1], m[2], m[3]))
      .filter((d): d is string => !!d)
      .sort();
    out.birth_date = allDates[0];
  }

  // Document number: only trust the label match if it actually looks like
  // one; otherwise scan the whole text for the letters+digits shape, then
  // a bare digit run as a last resort.
  if (out.passport && !DOC_NO_RE.test(out.passport) && !DIGIT_RUN_RE.test(out.passport)) {
    out.passport = undefined;
  }
  if (!out.passport) {
    const m = rawText.match(DOC_NO_RE) ?? rawText.match(DIGIT_RUN_RE);
    if (m) out.passport = m[1].replace(/\s+/, " ").trim();
  }

  // Name: never guessed without a label match -- free-form Cyrillic text
  // with no anchor is as likely to be the issuing authority or an address
  // line as an actual name, and a wrong name is worse on a contract than
  // a blank one asking to be typed.
  if (out.name) out.name = out.name.replace(/[.,;:]+$/, "");

  return out;
}
