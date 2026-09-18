import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getBranding } from "@/lib/branding";

// The manifest's "maskable" icon, generated from the COMPANY's own logo.
//
// Android (and other OSes with adaptive icons) prefer a maskable icon over
// an "any" one whenever both are declared -- so serving a hardcoded generic
// icon here, next to the real logo on the "any" entries, meant most Android
// phones showed the generic placeholder on the home screen instead of the
// company's branding: exactly the "install doesn't set the company logo"
// symptom, and the manifest's real "any" icons were never even glanced at.
//
// A maskable icon must fill the WHOLE canvas with an opaque background (a
// transparent one is invalid) and keep everything that matters inside the
// inner ~80% "safe zone" circle, since the OS can crop to a circle, a
// squircle, or any other shape. The logo is scaled to 66% of the canvas and
// centered on white, comfortably inside that zone whatever the OS's mask,
// so it survives every shape without its edges being clipped.
export const dynamic = "force-dynamic";

const SIZE = 512;
const LOGO_SIZE = Math.round(SIZE * 0.66);

export async function GET(request: Request) {
  const { logo } = await getBranding();
  if (!logo) {
    return NextResponse.redirect(new URL("/icon-maskable-512.png", request.url));
  }

  // ImageResponse (Satori) fetches the logo internally and streams the
  // result lazily -- a fetch failure there surfaces as a broken image
  // stream rather than a catchable error here, so check reachability
  // upfront instead and fall back to the generic icon rather than serve a
  // broken one.
  const reachable = await fetch(logo, { method: "HEAD" })
    .then((r) => r.ok)
    .catch(() => false);
  if (!reachable) {
    return NextResponse.redirect(new URL("/icon-maskable-512.png", request.url));
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={LOGO_SIZE} height={LOGO_SIZE} style={{ objectFit: "contain" }} alt="" />
      </div>
    ),
    { width: SIZE, height: SIZE }
  );
}
