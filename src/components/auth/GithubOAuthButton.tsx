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
export function GithubOAuthButton({ onError }: { onError: (message: string) => void }) {
  const trigger = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) onError("OAUTH: " + error.message);
  }, [onError]);

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
