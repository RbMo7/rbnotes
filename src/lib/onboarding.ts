"use client";

const KEY = "rbnotes-onboarding-seen";

/**
 * Plain localStorage, not the Local store's IndexedDB -- the mount-time
 * check (AppShell) needs a synchronous read the same tick it renders, and
 * IndexedDB reads are always async (see local-settings.ts's own note on
 * exactly this constraint for settings). The original IndexedDB-only
 * version of this check raced against everything else touching IndexedDB
 * on a brand-new visit (DeviceTracking's device-id write, the Local notes
 * store's first read, ...) -- most of the time it resolved in time, but not
 * always, which is why onboarding would sometimes only show up after a
 * reload instead of the very first load. A synchronous check can't race.
 */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Best-effort -- private browsing, quota, etc. Worst case the tour
    // shows again next visit, not a correctness issue.
  }
}
