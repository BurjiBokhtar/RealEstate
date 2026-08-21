// Turns whatever Tesseract recognised off a photographed Tajik biometric ID
// into a best-guess at the client fields it might fill -- name, document
// number, birth date. Tuned against a real sample of the front of the card:
//
//   Ҷумҳурии Тоҷикистон / Republic of Tajikistan
//   Шиносномаи / Identity Card
//   Насаб/Surname            БЕРДИЕВА / BERDIEVA
//   Ном/Name                 ДИЛАФРӮЗ / DILAFRUZ
//   Номи падар/Father's name ИБОДУЛЛОЕВНА / IBODULLOEVNA
//   Ҷинс/Sex ...   Санаи таваллуд/Date of birth  02.02.1999
//   Санаи содиршавӣ/Date of issue ...  Санаи анҷоми муҳлат/Date of expiry ...
//   Рақами шиносномаи миллӣ/National ID No.  3500018381042
//   (document number, top right near the photo, e.g. A00820822)
//
// No issuing-authority or address field appears on the front at all -- the
// holder confirms the back has an address (and reportedly a taxpayer
// number, which isn't a client field at all yet -- see PassportScanner's
// caller). PassportScanner can scan both sides and concatenates their text
// before this runs, so ADDRESS_LABEL below already has a chance to match
// once the back is included; its exact wording is still a guess until a
// real back-of-card sample confirms it, same as the front's labels were
// before one existed. Every guess is meant to be reviewed,
// not trusted blindly: PassportScanner always shows the raw recognised text
// next to them, because OCR on a security-patterned card is never going to
// be perfect and the value that matters is the one that ends up on the
// contract, not the one the regex was confident about.

export type ExtractedFields = {
  name?: string;
  passport?: string;
  passport_issued_by?: string;
  birth_date?: string;
  address?: string;
};

// Tajik and English are printed as one "Label/Label" line followed by the
// value in Tajik Cyrillic, then the value again transliterated into Latin
// -- valueAfterLine grabs the FIRST of those (the Cyrillic one), since it
// consistently came through cleaner than the Latin line even before the
// language pack was fixed: recognising the ~40-odd Cyrillic letters this
// font uses is an easier job than recognising Latin letters with the wrong
// model loaded under them.
const SURNAME_LABEL = /насаб|surname/i;
const PATRONYMIC_LABEL = /номи\s*падар|father.?s?\s*name/i;
// A plain /ном|name/ would also match "Номи падар/Father's name" -- that
// label starts with the same "Ном"/"...name" token the given-name label
// does. Checked as "mentions ном/name AND isn't the patronymic line" in
// code (see isGivenNameLabel) rather than as one regex: a lookahead can
// only rule out "падар" appearing AFTER the match, and here it can just as
// easily appear before ("Father's name" has "father" before "name"), which
// a forward-only lookahead can't see.
const NAME_WORD = /ном|name/i;
const BIRTH_LABEL = /санаи\s*таваллуд|date\s*of\s*birth/i;
// The 13-digit national ID number has its own label; the shorter
// letter+digits number stamped near the photo (e.g. "A00820822") doesn't --
// it's read off its shape instead, see DOC_NO_RE below. Either is a
// reasonable fill for "passport series and number"; the label match is
// tried first since it's the more explicitly identified of the two.
const NATIONAL_ID_LABEL = /рақами\s*шиносномаи\s*миллӣ|national\s*id/i;
// The back of the card (not sampled yet -- these are the ordinary Tajik/
// English words for it, tighten once a real back-of-card photo is seen the
// way the front's labels were).
const ADDRESS_LABEL = /суроға|ҷои\s*истиқомат|address/i;

// dd.mm.yyyy / dd-mm-yyyy / dd/mm/yyyy, tolerant of OCR swapping the
// separator or dropping a leading zero.
const DATE_RE = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\b/g;

// The document number stamped near the photo: 1-2 letters (Latin or
// Cyrillic -- OCR mixes them up) then 6-9 digits, with or without a space.
const DOC_NO_RE = /\b([A-ZА-Я]{1,2}\s?\d{6,9})\b/;
const DIGIT_RUN_RE = /\b(\d{9,13})\b/;

function toIsoDate(d: string, m: string, y: string): string | null {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!day || !month || !year) return null;
  if (day > 31 || month > 12) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// The value for a label is the first real line AFTER the line the label
// itself is on -- confirmed against the real card: "Насаб/Surname" and
// "Ном/Name" are each their own line, with nothing but the two label words
// on them, and the Cyrillic value only starts on the line below. So this
// never tries to pull a value off the tail of the label's own line (that
// was the bug the first version had: a line reading just "Ном/Name" left
// "Name" behind as leftover text, which then got returned as if it were
// the actual first name).
function valueAfterLine(lines: string[], isLabel: (line: string) => boolean): string | null {
  for (let i = 0; i < lines.length; i++) {
    if (!isLabel(lines[i])) continue;
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      const next = lines[j]?.trim();
      if (next && next.length > 1) return next;
    }
  }
  return null;
}

function valueAfterLabel(lines: string[], pattern: RegExp): string | null {
  return valueAfterLine(lines, (line) => pattern.test(line));
}

// "Ном/Name" without also being "Насаб/Surname" (which contains "name" as
// a substring of "Surname") or "Номи падар/Father's name" -- see the note
// on NAME_WORD above for why this can't just be one regex.
function isGivenNameLabel(line: string): boolean {
  return NAME_WORD.test(line) && !SURNAME_LABEL.test(line) && !PATRONYMIC_LABEL.test(line);
}

export function extractFields(rawText: string): ExtractedFields {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: ExtractedFields = {};

  const surname = valueAfterLabel(lines, SURNAME_LABEL);
  const given = valueAfterLine(lines, isGivenNameLabel);
  const patronymic = valueAfterLabel(lines, PATRONYMIC_LABEL);
  const name = [surname, given, patronymic].filter(Boolean).join(" ").trim();
  if (name) out.name = name.replace(/[.,;:]+$/, "");

  // Birth date: the label's own value, re-checked against the date shape
  // (OCR noise around it is common -- a stray character before/after the
  // digits shouldn't disqualify an otherwise-good match). Falls back to
  // the earliest date found anywhere in the document if the label match
  // didn't turn up a real date: issue/expiry dates are recent by
  // definition, birth date normally is not.
  const birthLine = valueAfterLabel(lines, BIRTH_LABEL);
  const fromLabel = birthLine ? [...birthLine.matchAll(DATE_RE)][0] : null;
  if (fromLabel) {
    out.birth_date = toIsoDate(fromLabel[1], fromLabel[2], fromLabel[3]) ?? undefined;
  } else {
    const allDates = [...rawText.matchAll(DATE_RE)]
      .map((m) => toIsoDate(m[1], m[2], m[3]))
      .filter((d): d is string => !!d)
      .sort();
    out.birth_date = allDates[0];
  }

  // Document number: the letter+digits shape near the photo, or the
  // labelled 13-digit national ID number as a fallback.
  const docMatch = rawText.match(DOC_NO_RE);
  if (docMatch) {
    out.passport = docMatch[1].replace(/\s+/, " ").trim();
  } else {
    const idLine = valueAfterLabel(lines, NATIONAL_ID_LABEL);
    const idMatch = idLine?.match(DIGIT_RUN_RE) ?? rawText.match(DIGIT_RUN_RE);
    if (idMatch) out.passport = idMatch[1];
  }

  // Address (and, on some cards, an issuing authority) live on the BACK --
  // absent from the front sample this was tuned against. Only fills in
  // when the back was actually scanned too and a label was found on it;
  // no anchor still means no guess, same as name.
  const address = valueAfterLabel(lines, ADDRESS_LABEL);
  if (address) out.address = address;

  return out;
}
