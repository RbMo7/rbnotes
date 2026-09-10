"use client";

import { useEffect, useState } from "react";

const QUERY = "(min-width: 768px)";

/**
 * Drives the mobile no-Vim switch (see build plan §10). Backed by a
 * matchMedia listener rather than a one-time width read, so it survives
 * rotation and window resize, not just first render.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    // Deliberate: the initial read has to happen post-mount (matchMedia
    // isn't available during SSR), and the `null` default until then is
    // what lets callers avoid a flash of the wrong Vim keymap -- see
    // WorkspaceBuffer's `isDesktop === null` guard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}
