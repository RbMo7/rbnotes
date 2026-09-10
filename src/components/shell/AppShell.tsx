"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { TopNav } from "@/components/shell/TopNav";
import { StatusBar } from "@/components/shell/StatusBar";
import { QuickSwitcher } from "@/components/overlay/QuickSwitcher";
import { SearchPalette } from "@/components/overlay/SearchPalette";
import { useWorkspaceStore } from "@/lib/store";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { createNoteAction } from "@/server/actions/notes";
import type { SidebarNote } from "@/lib/grouping";

export function AppShell({
  email,
  notes,
  children,
}: {
  email: string;
  notes: SidebarNote[];
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
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const inEditor = !!(document.activeElement as HTMLElement | null)?.closest(
        ".cm-editor",
      );

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
        startTransition(async () => {
          const { id } = await createNoteAction({});
          router.push(`/notes/${id}`);
        });
        return;
      }
      if (event.key === "/" && !inEditor) {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
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
    router,
    startTransition,
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
      <QuickSwitcher notes={notes} />
      <SearchPalette />
    </>
  );
}
