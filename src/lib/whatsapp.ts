// Build a wa.me link that opens WhatsApp with the number and a ready message
// filled in -- the manager just presses send. No API, no cost, no approval:
// the simplest reminder channel, and the one people in Tajikistan actually
// use. Auto-sending stays a separate (optional) feature.

export function normalizeWaPhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("992")) return d; // already has the Tajik country code
  if (d.length === 9) return `992${d}`; // bare local number
  return d;
}

export function waLink(phone: string | null | undefined, text: string): string {
  const p = normalizeWaPhone(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
