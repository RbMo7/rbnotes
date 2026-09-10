"use client";

import { useEffect, type ReactNode } from "react";
import { TopNav } from "@/components/shell/TopNav";
import { StatusBar } from "@/components/shell/StatusBar";
import { QuickSwitcher } from "@/components/overlay/QuickSwitcher";
import { SearchPalette } from "@/components/overlay/SearchPalette";
import { useWorkspaceStore } from "@/lib/store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { useCreateNote } from "@/lib/notes-query";

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const mobileSidebarOpen = useWorkspaceStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useWorkspaceStore((s) => s.setMobileSidebarOpen);
  const setQuickSwitcherOpen = useWorkspaceStore((s) => s.setQuickSwitcherOpen);
  const setSearchOpen = useWorkspaceStore((s) => s.setSearchOpen);
  const activeFilename = useWorkspaceStore((s) => s.activeFilename);
  const isDesktop = useIsDesktop();
  const createNote = useCreateNote();

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        if (isDesktop) toggleSidebar();
        else setMobileSidebarOpen(!mobileSidebarOpen);
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setQuickSwitcherOpen(true);
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createNote();
        return;
      }
      // Ctrl+/ opens global (every note) search from anywhere -- when
      // focus is inside the editor, Editor.tsx's own capture-phase
      // listener handles this first and stops it from reaching here
      // (same pattern as Ctrl+N/P/B above). Plain '/' is deliberately not
      // bound at all: inside the editor it's codemirror-vim's own local
      // search, and outside it there's nothing for a bare '/' to do.
      if (event.ctrlKey && event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [
    isDesktop,
    toggleSidebar,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    setQuickSwitcherOpen,
    setSearchOpen,
    createNote,
  ]);

  return (
    <>
      <TopNav email={email} />
      <div
        data-collapsed={collapsed}
        className="pl-0 lg:data-[collapsed=false]:pl-sidebar-width transition-[padding] duration-150 pt-14 pb-status-bar-height h-dvh overflow-y-auto bg-surface"
      >
        {children}
      </div>
      <StatusBar filename={activeFilename} />
      <QuickSwitcher />
      <SearchPalette />
    </>
  );
}
