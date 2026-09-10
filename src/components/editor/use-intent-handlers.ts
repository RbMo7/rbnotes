"use client";

import { useMemo } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { useCreateNote } from "@/lib/notes-query";
import type { IntentHandlers } from "@/components/editor/shortcuts";

/**
 * The one implementation of intent -> effect, shared by every listener that
 * produces intents (the editor's capture listener and the shell's document
 * listener). Because both call this hook, a shortcut has exactly one
 * behaviour regardless of where it was pressed.
 */
export function useIntentHandlers(): IntentHandlers {
  const createNote = useCreateNote();
  const isDesktop = useIsDesktop();
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const setMobileSidebarOpen = useWorkspaceStore((s) => s.setMobileSidebarOpen);
  const mobileSidebarOpen = useWorkspaceStore((s) => s.mobileSidebarOpen);
  const setQuickSwitcherOpen = useWorkspaceStore((s) => s.setQuickSwitcherOpen);
  const setSearchOpen = useWorkspaceStore((s) => s.setSearchOpen);
  const setCommandDockOpen = useWorkspaceStore((s) => s.setCommandDockOpen);

  return useMemo(
    () => ({
      // The active buffer registered its write; a shell-level Ctrl+S saves
      // whichever editor is mounted rather than needing its own copy.
      save: () => useWorkspaceStore.getState().saveActive?.(),
      newNote: createNote,
      openQuickSwitcher: () => setQuickSwitcherOpen(true),
      openSearch: () => setSearchOpen(true),
      toggleSidebar: () => {
        if (isDesktop) toggleSidebar();
        else setMobileSidebarOpen(!mobileSidebarOpen);
      },
      openCommandDock: () => setCommandDockOpen(true),
    }),
    [
      createNote,
      isDesktop,
      toggleSidebar,
      setMobileSidebarOpen,
      mobileSidebarOpen,
      setQuickSwitcherOpen,
      setSearchOpen,
      setCommandDockOpen,
    ],
  );
}
