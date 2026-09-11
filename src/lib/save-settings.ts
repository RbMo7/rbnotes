"use client";

import { saveSettingsAction } from "@/server/actions/settings";
import { saveLocalSettings } from "@/lib/local-settings";
import type { Settings } from "@/lib/schemas";

/**
 * Persists a full settings object through the right path for the session's
 * tier (ADR 0002): Synced calls the server action, Local-only writes to
 * localStorage. The three call sites that change a setting (SettingsView,
 * WorkspaceBuffer's :set command, Sidebar's theme quick-toggle) were each
 * reimplementing this branch independently -- one shared place instead.
 */
export async function persistSettings(settings: Settings, syncEnabled: boolean): Promise<void> {
  if (syncEnabled) {
    await saveSettingsAction(settings);
  } else {
    saveLocalSettings(settings);
  }
}
