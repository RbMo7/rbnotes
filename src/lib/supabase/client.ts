"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Browser-side Supabase client. Uses the publishable key, which is safe to
// expose — it has no privileges beyond what RLS grants an authenticated user.
export function createClient() {
  return createBrowserClient(env.supabaseUrl(), env.supabasePublishableKey());
}
