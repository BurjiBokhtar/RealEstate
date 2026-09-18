import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Exclude the PWA plumbing (manifest + service worker + generated maskable
  // icon) and static assets from the auth redirect. The OS fetches these
  // WITHOUT the session cookie while installing the app, so if they were
  // redirected to /login the app could never be installed and the service
  // worker never registered -- exactly what happened to icon-maskable
  // (src/app/icon-maskable/route.tsx) before it was added here: the OS's
  // request for it bounced to the login PAGE, so no maskable icon was ever
  // produced and Android fell back to showing no usable icon for it at all.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-maskable|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|ico)$).*)",
  ],
};
