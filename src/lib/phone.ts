// Normalises whatever a manager typed into the client/task form (spaces,
// dashes, a leading +, or no country code at all) into a bare digit string
// with the Tajik country code: 992XXXXXXXXX.
//
// This bare form is what WhatsApp deep links (wa.me/992...) want. The SMS
// gateway wants the same number WITH a leading plus -- see smsGatewayPhone
// below.
export function normalizeTjPhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("992")) return d; // already has the Tajik country code
  if (d.length === 9) return `992${d}`; // bare local number
  return d;
}

// The number in the exact shape Payom.tj documents for its own API:
//
//   { "telephone": "+992006338598", ... }
//
// The leading plus matters. Everything here was sending the bare "992..."
// form -- which is right for wa.me and wrong for the gateway -- so the
// requests went out looking valid and the messages did not arrive. Kept as a
// separate helper rather than a change to normalizeTjPhone, because the
// WhatsApp links genuinely need the version without the plus.
export function smsGatewayPhone(phone: string | null | undefined): string {
  const digits = normalizeTjPhone(phone);
  return digits ? `+${digits}` : "";
}
