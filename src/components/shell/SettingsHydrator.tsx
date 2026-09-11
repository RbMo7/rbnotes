"use client";

import { useState } from "react";
import { useWorkspaceStore } from "@/lib/store";
import type { Settings } from "@/lib/schemas";

/**
 * Seeds the shared workspace store's settings, and whether this session is
 * Synced vs. Local-only (CONTEXT.md), from the server exactly once, before
 * first paint -- the lazy useState initializer runs synchronously during
 * this component's first render, so there's no flash of default settings
 * (or a wrongly-true syncEnabled) before the real values apply. Renders
 * nothing.
 */
export function SettingsHydrator({
  settings,
  syncEnabled,
}: {
  settings: Settings;
  syncEnabled: boolean;
}) {
  useState(() => {
    useWorkspaceStore.getState().setSettings(settings);
    useWorkspaceStore.getState().setSyncEnabled(syncEnabled);
    return null;
  });
  return null;
}
