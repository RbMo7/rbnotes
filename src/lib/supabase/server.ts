import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Server-side Supabase client for Server Components, Server Actions, and
// Route Handlers. Reads/writes the session via Next's cookie store, so
// `supabase.auth.getUser()` here reflects the real, verified session — this
// is the only place `userId` is ever derived from for a database query.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component that can't set cookies (no
          // response to attach to). Safe to ignore — middleware refreshes
          // the session on every request anyway.
        }
      },
    },
  });
}
