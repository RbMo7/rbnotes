"use client";

import { useTransition } from "react";
import { signOutAction } from "@/server/actions/auth";
import { purgeSyncedNotes } from "@/lib/local-notes-store";
import { useWorkspaceStore } from "@/lib/store";

// Best-effort only -- a genuine network problem or a very large dirty set
// shouldn't hold sign-out hostage. This only ever helps the common case
// (online, just mid-debounce); if it times out or nothing's registered
// (no buffer mounted, so nothing dirty), sign-out proceeds regardless --
// nothing is lost either way, since an unflushed edit stays on the device,
// tagged to this account, and resumes on this account's next sign-in here
// (see isMigratable in local-notes-store.ts).
const FLUSH_TIMEOUT_MS = 2000;

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Purges this browser's already-synced note copies for the signing-out
 * account before ending the session -- Local-only notes, and this
 * account's own still-unsynced ones, are untouched (see purgeSyncedNotes/
 * isPurgeable). Wrapped in a transition, same as WorkspaceBuffer's other
 * Server Action calls, so the post-action route refresh Next.js does for
 * a transition-invoked Server Action still happens the same as it did for
 * the plain form action this replaces.
 */
export function useSignOut() {
  const [, startTransition] = useTransition();
  return () => {
    startTransition(async () => {
      const { currentUserId, flushAllDirty } = useWorkspaceStore.getState();
      if (flushAllDirty) {
        await Promise.race([flushAllDirty(), timeout(FLUSH_TIMEOUT_MS)]);
      }
      if (currentUserId) await purgeSyncedNotes(currentUserId);
      await signOutAction();
    });
  };
}
