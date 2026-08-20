// Server-side fetch of the public company branding (name + logo + hero theme)
// via the anon-accessible crm.public_branding() RPC. Used to make the PWA
// manifest and the app icons reflect the company the admin configured, with
// no auth session (the manifest/metadata are requested by the browser
// without cookies) -- and, critically, to paint the root <html> in the
// company's chosen hero theme on the very first server-rendered byte. Doing
// this here (instead of only client-side in AppShell/login, as before) is
// what avoids the "indigo flashes, then swaps to the real theme" flicker:
// there is no default-theme paint for the client to later correct.
export type Branding = {
  name: string | null;
  logo: string | null;
  heroTheme: string | null;
  heroPattern: string | null;
  heroStyle: string | null;
};

const EMPTY_BRANDING: Branding = {
  name: null,
  logo: null,
  heroTheme: null,
  heroPattern: null,
  heroStyle: null,
};

export async function getBranding(): Promise<Branding> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return EMPTY_BRANDING;
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
    if (!res.ok) return EMPTY_BRANDING;
    const rows = (await res.json()) as
      | Array<{
          company_name: string | null;
          company_logo_url: string | null;
          hero_theme: string | null;
          hero_pattern: string | null;
          hero_style: string | null;
        }>
      | {
          company_name?: string | null;
          company_logo_url?: string | null;
          hero_theme?: string | null;
          hero_pattern?: string | null;
          hero_style?: string | null;
        };
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      name: row?.company_name ?? null,
      logo: row?.company_logo_url ?? null,
      heroTheme: row?.hero_theme ?? null,
      heroPattern: row?.hero_pattern ?? null,
      heroStyle: row?.hero_style ?? null,
    };
  } catch {
    return EMPTY_BRANDING;
  }
}

export function logoMime(u: string): string {
  const lower = u.split("?")[0].toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}
