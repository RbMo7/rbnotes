import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the `code` param Supabase appends to both OAuth redirects and
 * emailed magic/recovery links for a real session, then continues to
 * wherever the flow was headed (`next` — defaults to the notes workspace,
 * but the password-reset email sets it to `/reset`).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/notes";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("auth link invalid or expired")}`,
  );
}
