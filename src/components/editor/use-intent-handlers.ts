"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import type { IntentHandlers } from "@/components/editor/shortcuts";

/**
 * The one implementation of intent -> effect, shared by every listener that
 * produces intents (the editor's capture listener and the shell's document
 * listener). Because both call this hook, a shortcut has exactly one
 * behaviour regardless of where it was pressed.
 */
export function useIntentHandlers(): IntentHandlers {
  const { createAndOpenNote } = useWorkspace();
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const setSidebarCollapsed = useWorkspaceStore((s) => s.setSidebarCollapsed);
  const setQuickSwitcherOpen = useWorkspaceStore((s) => s.setQuickSwitcherOpen);
  const setSearchOpen = useWorkspaceStore((s) => s.setSearchOpen);
  const setCommandDockOpen = useWorkspaceStore((s) => s.setCommandDockOpen);
  const requestFocusTags = useWorkspaceStore((s) => s.requestFocusTags);

  return useMemo(
    () => ({
      // The active buffer registered its write; a shell-level Ctrl+S saves
      // whichever editor is mounted rather than needing its own copy.
      save: () => useWorkspaceStore.getState().saveActive?.(),
      newNote: createAndOpenNote,
      openQuickSwitcher: () => setQuickSwitcherOpen(true),
      openSearch: () => setSearchOpen(true),
      toggleSidebar: () => {
        // On mobile there's no sidebar to toggle -- its browse role lives
        // in the Dashboard route's List screen instead, so "open" means
        // "go there."
        if (isDesktop) toggleSidebar();
        else router.push("/");
      },
      openCommandDock: () => setCommandDockOpen(true),
      focusTags: () => {
        // "Open tags" has to mean visibly open -- expand a collapsed
        // desktop sidebar, or navigate to the mobile List screen, before
        // asking it to switch tabs and focus its filter box.
        if (isDesktop) setSidebarCollapsed(false);
        else router.push("/");
        requestFocusTags();
      },
    }),
    [
      createAndOpenNote,
      isDesktop,
      router,
      toggleSidebar,
      setSidebarCollapsed,
      setQuickSwitcherOpen,
      setSearchOpen,
      setCommandDockOpen,
      requestFocusTags,
    ],
  );
}
