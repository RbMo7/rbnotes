"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { TopNav } from "@/components/shell/TopNav";
import { StatusBar } from "@/components/shell/StatusBar";
import { QuickSwitcher } from "@/components/overlay/QuickSwitcher";
import { SearchPalette } from "@/components/overlay/SearchPalette";
import { matchGlobalShortcut, dispatchIntent } from "@/components/editor/shortcuts";
import { useIntentHandlers } from "@/components/editor/use-intent-handlers";
import { useWorkspaceStore } from "@/lib/store";

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const activeFilename = useWorkspaceStore((s) => s.activeFilename);
  const handlers = useIntentHandlers();

  // The shell's adapter over the one shortcut table: when focus is inside
  // the editor, Editor.tsx's capture-phase listener handles the chord first
  // and stops it from reaching here. Outside the editor, this is where the
  // same table gets its turn. `null` mode means "no editor focus", so
  // mode-gated chords (the ':') never fire here.
  const handleIntent = useCallback(
    (event: KeyboardEvent) => {
      const intent = matchGlobalShortcut(event, null);
      if (!intent) return;
      event.preventDefault();
      dispatchIntent(intent, handlers);
    },
    [handlers],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleIntent);
    return () => document.removeEventListener("keydown", handleIntent);
  }, [handleIntent]);

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
