import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // getClaims(), not getUser(): this runs on EVERY request -- each page, each
  // client-side navigation's RSC fetch, each <Link> prefetch -- and getUser()
  // is unconditionally a network round trip to the auth server, which on a
  // slow connection is the single biggest thing standing between a tap and a
  // rendered page. getClaims() verifies the token's signature locally with
  // WebCrypto against a cached JWKS (and falls back to exactly the old
  // getUser() call when the project still signs with a symmetric secret), so
  // this is never weaker and usually far faster.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims ?? null;

  // /reset-password must load without a session: the user arrives from the
  // e-mail link, and the recovery token is exchanged client-side AFTER the
  // page loads -- bouncing them to /login would eat the link.
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/reset-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
