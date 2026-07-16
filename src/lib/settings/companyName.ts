// Settings stores whatever was typed into the company-name field:
// "Бурҷи Бохтар", 'ЧДММ "Бурҷи Бохтар"', "ҶДММ «Бурҷи Бохтар»" -- all mean
// the same firm. The contract supplies the legal form itself (the letterhead
// prints "ҶДММ «…»", and §1's wording "Ҷамъияти дорои масъулияти маҳдуди «…»"
// IS that form spelled out), so printing the stored value verbatim produced
// "ҶДММ «ЧДММ "Бурҷи Бохтар"»".
//
// Reduce it to the bare name once, here, rather than making anyone retype
// what they already entered correctly.
const LEGAL_FORM =
  /^\s*(ҶДММ|ҷдмм|ЧДММ|чдмм|ҶСК|ҷск|ЧСК|чск|ООО|ооо|OOO|ЗАО|зао|ОАО|оао|LLC|llc|LTD|ltd)[\s.]*/;
// Leading/trailing quotes of every flavour the field tends to collect.
const LEAD_QUOTES = /^[«"“„'`\s]+/;
const TRAIL_QUOTES = /[»"”'`\s]+$/;

export function bareCompanyName(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim();
  // Quotes can wrap the form ("ҶДММ «Х»") or sit inside it, so strip in a
  // loop: form, quotes, and again in case the form was itself quoted.
  for (let i = 0; i < 3; i++) {
    const before = s;
    s = s.replace(LEGAL_FORM, "");
    s = s.replace(LEAD_QUOTES, "").replace(TRAIL_QUOTES, "");
    if (s === before) break;
  }
  return s.trim();
}
