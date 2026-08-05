// Both the SMS gateway (Payom.tj) and WhatsApp deep links expect a bare
// digit string with the Tajik country code (992XXXXXXXXX), not whatever
// format a manager happened to type into the client/task form (with
// spaces, dashes, a leading +, or no country code at all). Without this,
// a locally-typed 9-digit number goes to the gateway as-is and silently
// fails to deliver.
export function normalizeTjPhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("992")) return d; // already has the Tajik country code
  if (d.length === 9) return `992${d}`; // bare local number
  return d;
}
