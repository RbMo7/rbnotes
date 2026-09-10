"use client";

import { useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { GithubButton } from "@/components/auth/AuthButtons";

/**
 * Wired live per the design: clicking (or Ctrl+G, per the Stitch footer
 * hint) calls Supabase's real OAuth flow. It does nothing harmful if the
 * GitHub provider isn't configured yet in the Supabase dashboard — Supabase
 * just returns an error, which we surface through onError.
 */
export function GithubOAuthButton({
  onError,
  next = "/",
}: {
  onError: (message: string) => void;
  /** Where /auth/callback should land after the OAuth round-trip -- same `next` the email/password path honors. */
  next?: string;
}) {
  const trigger = useCallback(async () => {
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) onError("OAUTH: " + error.message);
  }, [onError, next]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        trigger();
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [trigger]);

  return <GithubButton onClick={trigger} />;
}
