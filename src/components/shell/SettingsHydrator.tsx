"use client";

import { useState } from "react";
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
 */
export function SettingsHydrator({
  settings,
  syncEnabled,
}: {
  settings: Settings;
  syncEnabled: boolean;
}) {
  useState(() => {
    useWorkspaceStore.getState().setSettings(syncEnabled ? settings : loadLocalSettings() ?? settings);
    useWorkspaceStore.getState().setSyncEnabled(syncEnabled);
    return null;
  });
  return null;
}
