import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Exclude the PWA plumbing (manifest + service worker) and static assets from
  // the auth redirect. The browser fetches the manifest and sw.js WITHOUT the
  // session cookie, so if they were redirected to /login the app could never be
  // installed and the service worker never registered.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|ico)$).*)",
  ],
};
