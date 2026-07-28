// Server-side fetch of the public company branding (name + logo) via the
// anon-accessible crm.public_branding() RPC. Used to make the PWA manifest and
// the app icons reflect the company the admin configured, with no auth session
// (the manifest/metadata are requested by the browser without cookies).
export type Branding = { name: string | null; logo: string | null };

export async function getBranding(): Promise<Branding> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { name: null, logo: null };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/public_branding`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Content-Profile": "crm",
        "Accept-Profile": "crm",
      },
      body: "{}",
      // Cache briefly so we don't hit the DB on every icon/manifest request.
      next: { revalidate: 300 },
    });
    if (!res.ok) return { name: null, logo: null };
    const rows = (await res.json()) as
      | Array<{ company_name: string | null; company_logo_url: string | null }>
      | { company_name?: string | null; company_logo_url?: string | null };
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      name: row?.company_name ?? null,
      logo: row?.company_logo_url ?? null,
    };
  } catch {
    return { name: null, logo: null };
  }
}

export function logoMime(u: string): string {
  const lower = u.split("?")[0].toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}
