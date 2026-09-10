"use client";

import { useState } from "react";
import { useWorkspaceStore } from "@/lib/store";
import type { Settings } from "@/lib/schemas";

/**
 * Seeds the shared workspace store's settings from the server exactly once,
 * before first paint -- the lazy useState initializer runs synchronously
 * during this component's first render, so there's no flash of default
 * settings before the real ones apply. Renders nothing.
 */
export function SettingsHydrator({ settings }: { settings: Settings }) {
  useState(() => {
    useWorkspaceStore.getState().setSettings(settings);
    return null;
  });
  return null;
}
