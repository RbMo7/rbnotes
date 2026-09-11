"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { loadLocalSettings } from "@/lib/local-settings";
import type { Settings } from "@/lib/schemas";

/**
 * Seeds the shared workspace store's settings, syncEnabled, and
 * currentUserId (CONTEXT.md's Synced vs. Local-only, plus LocalNote's
 * ownerId) from the server, and keeps them in sync on every later change
 * too -- not just once. Two passes, deliberately:
 *
 * 1. A synchronous seed in the lazy useState initializer, using ONLY the
 *    server-safe props as passed (no loadLocalSettings() call here) -- its
 *    function body also runs during SSR (Next.js executes a client
 *    component's render synchronously on the server too), where
 *    `localStorage`/`document` don't exist, and where the *client's*
 *    first hydration pass must render the exact same thing the server did
 *    or React flags a hydration mismatch. This pass exists so first paint
 *    is never wrong for a Synced session, and never mismatched for either.
 * 2. A useEffect that re-runs on every change to the syncEnabled/settings/
 *    userId props, not just once on mount -- this is what a lazy useState
 *    initializer alone cannot do, and it's why syncEnabled used to get
 *    stuck at its stale value after sign-out (a soft route refresh, not a
 *    remount, so a once-only initializer never sees the new props). For a
 *    Local-only session, this effect is also where loadLocalSettings()
 *    gets called to overlay the real local values -- accepted trade-off:
 *    a Local-only user with non-default settings sees a one-tick flash of
 *    defaults on first paint before this effect applies their real
 *    values, the same trade-off already made for `data-theme` specifically
 *    (below), now generalized to settings as a whole.
 */
export function SettingsHydrator({
  settings,
  syncEnabled,
  userId,
}: {
  settings: Settings;
  syncEnabled: boolean;
  userId: string | null;
}) {
  useState(() => {
    useWorkspaceStore.getState().setSettings(settings);
    useWorkspaceStore.getState().setSyncEnabled(syncEnabled);
    useWorkspaceStore.getState().setCurrentUserId(userId);
    return null;
  });

  useEffect(() => {
    const initial = syncEnabled ? settings : loadLocalSettings() ?? settings;
    useWorkspaceStore.getState().setSettings(initial);
    useWorkspaceStore.getState().setSyncEnabled(syncEnabled);
    useWorkspaceStore.getState().setCurrentUserId(userId);
  }, [syncEnabled, settings, userId]);

  // Applying the active theme's `data-theme` attribute to <html>
  // (theme-support spec) stays in its own effect, client-only by
  // construction -- same one-tick-flash trade-off as above, just for this
  // one field specifically since it predates the settings-wide fix.
  const theme = useWorkspaceStore((s) => s.settings.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}
