import type { MetadataRoute } from "next";

// Makes the CRM installable: "Add to home screen" on Android, "Install app"
// in desktop Chrome/Edge. Served by Next at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RealEstate CRM",
    short_name: "CRM",
    description: "CRM для риэлторских и строительных компаний",
    // Launch straight into the dashboard, standalone so it opens without
    // browser chrome and reads as an app on the home screen.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#1c1a3a",
    theme_color: "#1c1a3a",
    lang: "ru",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops icons to a circle/squircle; the maskable one has its
      // art padded into the safe zone so the tower never gets clipped.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
