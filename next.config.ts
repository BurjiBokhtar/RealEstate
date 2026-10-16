import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` (16.3+) otherwise creates/rewrites a managed block in AGENTS.md on
  // every start. The project keeps its own AGENTS.md (no managed-block markers).
  agentRules: false,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The CRM has no legitimate reason to be framed -- blocks
          // clickjacking overlays on the payment/booking screens.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak internal URLs (client ids, contract ids) to
          // external sites via the Referer header.
          { key: "Referrer-Policy", value: "same-origin" },
          // The passport scanner uses the camera on the person's own request;
          // "camera=()" blocked it outright.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
          // HTTPS only, for two years -- a first visit over plain http can no
          // longer be downgraded or intercepted on the way to the login form.
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          // Directives that cannot break a page (unlike a script/connect
          // allow-list): nobody may frame the app, inject a <base>, post a form
          // to another site, or embed a plug-in object.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
          // A window opened from another site cannot reach back into this one.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
