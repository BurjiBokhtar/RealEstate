import type { MetadataRoute } from "next";
import { getBranding, logoMime } from "@/lib/branding";

// Makes the CRM installable ("Add to home screen" / "Install app"). The icon
// and name follow the COMPANY the admin configured, so the installed app on a
// phone/desktop shows the firm's own logo -- not a generic placeholder.
// The raw (possibly non-square) logo is only ever given `purpose: "any"`, so
// nothing crops or stretches it -- the maskable entry below is a SEPARATE,
// generated image built specifically to survive an OS's mask shape.
//
// force-dynamic: without it, a metadata route with no dynamic API in play
// (no cookies/headers/searchParams -- getBranding is a plain fetch) can get
// prerendered once at build/deploy time and served as a fixed static file
// from then on, regardless of the fetch's own `revalidate`. On a first
// deploy that means "no logo yet" gets baked in permanently. This forces
// the route itself to actually run on each request; the branding fetch
// below still keeps its own 5-minute cache, so a logo upload just needs
// up to 5 minutes (not a redeploy) to reach a freshly (re)installed icon.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { name, logo } = await getBranding();
  const appName = name || "RealEstate CRM";

  const icons: MetadataRoute.Manifest["icons"] = logo
    ? [
        { src: logo, sizes: "192x192", type: logoMime(logo), purpose: "any" },
        { src: logo, sizes: "512x512", type: logoMime(logo), purpose: "any" },
        // Android (and other adaptive-icon OSes) prefer a "maskable" icon
        // over an "any" one whenever both are present -- so this can't be a
        // generic stand-in image like the one below, or most Android phones
        // show that placeholder on the home screen instead of the company's
        // logo, never even considering the "any" entries above. /icon-maskable
        // renders the SAME logo padded into the safe zone on a solid
        // background instead.
        { src: "/icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ]
    : [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];

  return {
    name: appName,
    short_name: name ? appName.slice(0, 12) : "CRM",
    description: "CRM для риэлторских и строительных компаний",
    start_url: "/",
    scope: "/",
    // Installed app runs with no browser chrome at all. `fullscreen` drops
    // even the status strip; `display_override` lets capable browsers pick it,
    // falling back to standalone/minimal-ui where fullscreen isn't allowed.
    display: "fullscreen",
    display_override: ["fullscreen", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#1c1a3a",
    theme_color: "#1c1a3a",
    lang: "ru",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons,
  };
}
