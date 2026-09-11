import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

// "/", "/notes", and "/settings" are deliberately absent -- an anonymous
// session gets a fully-featured Local-only workspace (ADR 0002), settings
// included: editor preferences (line numbers, tab size, word wrap...) are
// genuine free-tier features, not account data, and persist to
// localStorage instead of the server for a Local-only session. Only /s/
// (Supabase-authenticated share-link viewing) stays protected.
const PROTECTED_PREFIXES = ["/s/"];
// /reset is deliberately excluded: it's reached via Supabase's password
// recovery link, which signs the user in with a temporary session before
// redirecting here. Treating it as an "auth page" would bounce that
// now-authenticated visitor straight to /notes before they can set a
// password. The page itself still requires that session to do anything.
const AUTH_PREFIXES = ["/login", "/register", "/forgot-password"];

/**
 * Refreshes the Supabase session on every request and enforces route
 * protection at the edge, before any page or layout runs. This is the single
 * place unauthenticated traffic is turned away from protected routes — pages
 * still re-check via `supabase.auth.getUser()` as defense in depth, but the
 * redirect decision belongs here.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.supabaseUrl(),
    env.supabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run any code between createServerClient and
  // getUser(). A stray early return drops the refreshed session silently.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && isProtected) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}
