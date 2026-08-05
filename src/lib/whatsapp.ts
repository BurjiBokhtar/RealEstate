// Build a wa.me link that opens WhatsApp with the number and a ready message
// filled in -- the manager just presses send. No API, no cost, no approval:
// the simplest reminder channel, and the one people in Tajikistan actually
// use. Auto-sending stays a separate (optional) feature.

import { normalizeTjPhone } from "@/lib/phone";

// Kept as an alias -- other modules already import normalizeWaPhone by this
// name; the actual normalization now lives in lib/phone.ts so the SMS
// gateway can share it too.
export const normalizeWaPhone = normalizeTjPhone;

export function waLink(phone: string | null | undefined, text: string): string {
  const p = normalizeWaPhone(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
