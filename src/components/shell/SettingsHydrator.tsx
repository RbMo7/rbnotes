"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { loadLocalSettings } from "@/lib/local-settings";
import type { Settings } from "@/lib/schemas";

/**
 * Seeds the shared workspace store's settings, and whether this session is
 * Synced vs. Local-only (CONTEXT.md), exactly once, before first paint --
 * the lazy useState initializer runs synchronously during this component's
 * first render, so there's no flash of default settings (or a wrongly-true
 * syncEnabled) before the real values apply. Renders nothing.
 *
 * `settings` is the server-provided value, only meaningful for a Synced
 * session (it comes from the account's Profile row). A Local-only session
 * has no such row -- its preferences instead live in localStorage, and
 * this is the one place that source gets read, same as `settings` only
 * ever gets read from the server here.
 *
 * Also owns applying the active theme's `data-theme` attribute to <html>
 * (theme-support spec) -- deliberately in the effect below, not the lazy
 * initializer above: that initializer's function body also runs during
 * SSR (Next.js executes a client component's render synchronously on the
 * server too), where `document` doesn't exist. The effect is client-only
 * by construction, so it's the only safe place for this write; the
 * trade-off is a one-tick flash of the default Hacker theme on first
 * paint for anyone who picked Dark or Light, which is an accepted,
 * standard cost of a client-only (no SSR cookie) theme choice, not a bug.
 * The same effect also keeps the attribute in sync with every later
 * change (Settings page, footer quick-toggle).
 */
export function SettingsHydrator({
  settings,
  syncEnabled,
}: {
  settings: Settings;
  syncEnabled: boolean;
}) {
  useState(() => {
    const initial = syncEnabled ? settings : loadLocalSettings() ?? settings;
    useWorkspaceStore.getState().setSettings(initial);
    useWorkspaceStore.getState().setSyncEnabled(syncEnabled);
    return null;
  });

  const theme = useWorkspaceStore((s) => s.settings.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}
