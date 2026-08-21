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
// holder confirms the back has both (and reportedly a taxpayer number,
// which isn't a client field at all yet -- see PassportScanner's caller).
// PassportScanner can scan both sides and concatenates their text before
// this runs, so ADDRESS_LABEL below already has a chance to match once the
// back is included -- its exact wording is still a guess until a real
// back-of-card sample confirms it, same as the front's labels were before
// one existed, so it's kept deliberately narrow (see the comment on
// ADDRESS_LABEL) rather than widened to catch more and risk a wrong match.
// passport_issued_by has no matching label at all yet for the same reason
// -- guessing the issuing-authority wording without having seen it printed
// would just repeat the address label's first, too-loose attempt, so this
// leaves that field for the person reviewing the raw text to type in by
// hand until a real sample settles it, the same way the front's labels
// went from guesses to confirmed once one existed. Every guess is meant to
// be reviewed, not trusted blindly: PassportScanner always shows the raw
// recognised text next to them, because OCR on a security-patterned card
// is never going to be perfect and the value that matters is the one that
// ends up on the contract, not the one the regex was confident about.

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
// The back of the card is not sampled yet -- these are the ordinary Tajik
// words for "address", tighten once a real back-of-card photo is seen the
// way the front's labels were. Deliberately NOT matching a bare English
// "address" here: that was loose enough to latch onto unrelated text
// elsewhere on a back side that (per the person actually holding one)
// carries plenty of other fields, and a wrong match there is worse than
// no match -- an empty field gets noticed and typed in by hand; a
// wrong one might not be.
const ADDRESS_LABEL = /суроға|ҷои\s*истиқомат/i;

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

// Table borders on the card photograph as stray "|" characters, and OCR
// noise tends to cluster at the start/end of a line as odd punctuation --
// neither belongs in a value that ends up on a contract.
function cleanValue(raw: string): string {
  return raw
    .replace(/\|/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[,;:.\-\s]+/, "")
    .replace(/[,;:.\-\s]+$/, "");
}

// Every name/address field is printed twice -- once in Tajik Cyrillic, once
// transliterated into Latin underneath or beside it -- and only the Cyrillic
// one belongs in the client record. \b in a plain (non-unicode) JS regex is
// an ASCII notion: Cyrillic letters count as "not a word character" the same
// as a space does, so a script change (…ЛОН|BOKH…) already reads as a word
// boundary without any extra flag.
const CYRILLIC_RE = /[Ѐ-ӿ]/;
function hasCyrillic(s: string): boolean {
  return CYRILLIC_RE.test(s);
}

// Drops whole tokens that are pure Latin letters (the transliterated
// duplicate riding on the same OCR line as the real value, e.g. "БЕРДИЕВА
// BERDIEVA") while leaving a token that mixes scripts untouched -- there's
// no reliable way to tell which half of a glued-together mixed token is the
// OCR error, so that's left for the raw-text panel to reveal instead of
// silently deleting part of a word and hiding that anything was cut.
function stripLatinWords(value: string): string {
  const tokens = value.split(/\s+/).filter(Boolean);
  const kept = tokens.filter((tok) => {
    const letters = tok.replace(/[^A-Za-z]/g, "");
    return hasCyrillic(tok) || letters.length < 2;
  });
  const result = kept.join(" ").trim();
  return result || value;
}

// Every label on this card is printed bilingual, "Тоҷикӣ/English" -- a
// slash is the one thing that's reliably true of a label line and never
// true of a value line, which makes it a good backstop even when OCR
// garbles a label's wording too badly for the specific *_LABEL patterns
// to catch it. That happened for real: a label reading "Насаб/Surname"
// came back mis-recognised as something like "Насаб/ Сигпате", didn't
// match SURNAME_LABEL on that line, and the OLD valueAfterLine (which
// trusted whatever line came right after a matched label) happily
// returned that garbled label text as if it were the given name. This
// also skips PAST such a line instead of stopping at it, so the real
// value one line further down still gets found.
function isLikelyLabelLine(line: string): boolean {
  if (line.includes("/")) return true;
  return (
    SURNAME_LABEL.test(line) ||
    PATRONYMIC_LABEL.test(line) ||
    NAME_WORD.test(line) ||
    BIRTH_LABEL.test(line) ||
    NATIONAL_ID_LABEL.test(line) ||
    ADDRESS_LABEL.test(line)
  );
}

// A blank field the user notices and fills in by hand beats a field
// silently holding two stray characters left over from a table border --
// so a candidate line also has to look enough like real text to be worth
// returning at all: mostly letters, and more than a couple of them. Digits
// slipping through here means it's a stray fragment of some other field
// (a date, a document number), not a name or an address.
function looksLikeRealValue(s: string): boolean {
  if (/\d/.test(s)) return false;
  const letters = (s.match(/[Ѐ-ӿA-Za-z]/g) || []).length;
  return letters >= 3 && letters / s.length >= 0.7;
}

// The value for a label is the first real line AFTER the line the label
// itself is on -- confirmed against the real card: "Насаб/Surname" and
// "Ном/Name" are each their own line, with nothing but the two label words
// on them, and the Cyrillic value only starts on the line below. So this
// never tries to pull a value off the tail of the label's own line (that
// was the bug the first version had: a line reading just "Ном/Name" left
// "Name" behind as leftover text, which then got returned as if it were
// the actual first name). It also keeps looking past a line that turns
// out to be another (garbled) label, or that doesn't look like a plausible
// value at all, instead of accepting the first thing it finds -- widened
// to a 3-line lookahead to leave room for that.
//
// Within that window there are normally two real candidates in a row: the
// Cyrillic value, then its Latin transliteration underneath. This always
// takes the Cyrillic one when both are there, and only falls back to a
// Latin-only candidate if no Cyrillic line turned up at all -- a guess
// beats a blank field, but a Tajik value beats an English one every time
// there's a choice. requirePlausible skips the looksLikeRealValue check
// entirely for callers reading a digit line (birth date, national ID) --
// there, digits are exactly what's wanted.
function valueAfterLine(
  lines: string[],
  isLabel: (line: string) => boolean,
  requirePlausible = true,
): string | null {
  for (let i = 0; i < lines.length; i++) {
    if (!isLabel(lines[i])) continue;
    let fallback: string | null = null;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const next = lines[j]?.trim();
      if (!next || next.length <= 1 || isLikelyLabelLine(next)) continue;
      const cleaned = cleanValue(next);
      if (!cleaned) continue;
      if (requirePlausible && !looksLikeRealValue(cleaned)) continue;
      if (hasCyrillic(cleaned)) return cleaned;
      if (!fallback) fallback = cleaned;
    }
    if (fallback) return fallback;
  }
  return null;
}

function valueAfterLabel(lines: string[], pattern: RegExp, requirePlausible = true): string | null {
  return valueAfterLine(lines, (line) => pattern.test(line), requirePlausible);
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
  const rawGiven = valueAfterLine(lines, isGivenNameLabel);
  const patronymic = valueAfterLabel(lines, PATRONYMIC_LABEL);
  // Seen for real: on a card whose security-pattern background confuses
  // rotateAuto/OCR, the surname sometimes gets recognised a second time
  // right where the given name should be, producing "ОРИПОВ ОРИПОВ
  // САФАРАЛИЕВИЧ" -- a given name is never literally the same word as the
  // surname or patronymic next to it, so a candidate that matches either
  // is treated the same as not having found one at all.
  const given =
    rawGiven &&
    rawGiven.toLowerCase() !== surname?.toLowerCase() &&
    rawGiven.toLowerCase() !== patronymic?.toLowerCase()
      ? rawGiven
      : null;
  const name = stripLatinWords(
    [surname, given, patronymic].filter(Boolean).join(" ").trim(),
  );
  if (name) out.name = name.replace(/[.,;:]+$/, "");

  // Birth date: the label's own value, re-checked against the date shape
  // (OCR noise around it is common -- a stray character before/after the
  // digits shouldn't disqualify an otherwise-good match). Falls back to
  // the earliest date found anywhere in the document if the label match
  // didn't turn up a real date: issue/expiry dates are recent by
  // definition, birth date normally is not.
  const birthLine = valueAfterLabel(lines, BIRTH_LABEL, false);
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
    const idLine = valueAfterLabel(lines, NATIONAL_ID_LABEL, false);
    const idMatch = idLine?.match(DIGIT_RUN_RE) ?? rawText.match(DIGIT_RUN_RE);
    if (idMatch) out.passport = idMatch[1];
  }

  // Address (and, on some cards, an issuing authority) live on the BACK --
  // absent from the front sample this was tuned against. Only fills in
  // when the back was actually scanned too and a label was found on it;
  // no anchor still means no guess, same as name. Read with
  // requirePlausible off (unlike name) since a real street address can
  // legitimately contain a house number -- looksLikeRealValue's blanket
  // "no digits" rule is right for a name and wrong here.
  //
  // Seen for real: the line landing under the address label sometimes
  // carries a stray date fragment glued to the front of it (two card
  // fields the OCR line-splitter merged into one) -- e.g.
  // "16.0111991 ВИЛОЯТИ ХАТЛОН, БОХТ". The place name after it is real
  // data worth keeping; the date prefix in front of it isn't. Once that's
  // stripped, still require enough actual letters to be left over --
  // otherwise a line that was nothing but that date fragment would leave
  // an address field holding whatever punctuation survived it.
  const address = valueAfterLabel(lines, ADDRESS_LABEL, false);
  if (address) {
    const withoutDate = address.replace(/^\d[\d.\-/]{2,10}\s+/, "").trim() || address;
    const cleanedAddress = stripLatinWords(withoutDate);
    const letters = (cleanedAddress.match(/[Ѐ-ӿA-Za-z]/g) || []).length;
    if (letters >= 3) out.address = cleanedAddress;
  }

  return out;
}
