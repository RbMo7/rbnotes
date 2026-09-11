"use client";

import { useTransition } from "react";
import { signOutAction } from "@/server/actions/auth";
import { purgeSyncedNotes } from "@/lib/local-notes-store";

/**
 * Purges this browser's Synced note copies before ending the session --
 * Local-only notes are untouched (see purgeSyncedNotes). Wrapped in a
 * transition, same as WorkspaceBuffer's other Server Action calls, so the
 * post-action route refresh Next.js does for a transition-invoked Server
 * Action still happens the same as it did for the plain form action this
 * replaces.
 */
export function useSignOut() {
  const [, startTransition] = useTransition();
  return () => {
    startTransition(async () => {
      await purgeSyncedNotes();
      await signOutAction();
    });
  };
}
