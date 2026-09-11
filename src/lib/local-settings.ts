"use client";

import { settingsSchema, type Settings } from "@/lib/schemas";
import { setThemeMeta } from "@/lib/local-notes-store";

// Plain localStorage, not the Local store's IndexedDB (Seam 1) -- settings
// are tiny, synchronous-feeling key-value data with no sync/tombstone/id
// story of their own, unlike notes. No need for the heavier machinery.
// The one exception is `theme`, additionally mirrored into IndexedDB below
// (setThemeMeta) as a pure redundant backup -- see local-notes-store.ts.
const KEY = "rbnotes-settings";

/** A Local-only session's persisted editor preferences, or null if none saved yet. */
export function loadLocalSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return settingsSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocalSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Best-effort -- private browsing, quota, etc. The in-memory store
    // value (and thus the running session) is unaffected either way.
  }
  void setThemeMeta(settings.theme);
}
