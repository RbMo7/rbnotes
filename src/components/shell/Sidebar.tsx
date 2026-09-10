"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { SidebarLists } from "@/components/shell/sidebar/SidebarLists";

export function Sidebar() {
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const mobileOpen = useWorkspaceStore((s) => s.mobileSidebarOpen);
  const setMobileOpen = useWorkspaceStore((s) => s.setMobileSidebarOpen);
  const pathname = usePathname();
  const { createAndOpenNote } = useWorkspace();

  const handleNewNote = () => {
    createAndOpenNote();
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile/tablet backdrop — sidebar overlays the buffer below 1024px
          per the design system's own breakpoint rule, rather than docking. */}
      {mobileOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
        />
      )}
      <aside
        data-collapsed={collapsed}
        data-mobile-open={mobileOpen}
        onClick={() => setMobileOpen(false)}
        className="fixed left-0 top-0 bottom-status-bar-height w-sidebar-width bg-surface-container-low border-r border-outline-variant/30 flex flex-col z-40 transition-transform duration-150 max-lg:-translate-x-full max-lg:data-[mobile-open=true]:translate-x-0 lg:translate-x-0 lg:data-[collapsed=true]:-translate-x-full"
      >
      <div className="h-header-height px-space-4 border-b border-outline-variant/30 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-space-2">
          <Image src="/logo.svg" alt="RbNotes" width={32} height={32} className="h-8 w-auto" />
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            RbNotes
          </span>
        </Link>
        <span className="font-label-sm text-label-sm text-outline px-space-1 py-space-0 rounded bg-surface-container-high">
          v0.4.2
        </span>
      </div>

      <div className="p-space-3 shrink-0 border-b border-outline-variant/20">
        <button
          onClick={handleNewNote}
          className="w-full flex items-center justify-between px-space-3 py-space-2 bg-primary text-on-primary font-label-md text-label-md rounded hover:bg-primary-fixed transition-colors"
        >
          <span>+ New Note</span>
          <span className="font-label-sm text-label-sm opacity-80">[^N]</span>
        </button>
      </div>

      <SidebarLists />

      <div className="h-12 px-space-4 border-t border-outline-variant/30 flex items-center shrink-0 bg-surface-container-low">
        <Link
          href="/settings"
          data-active={pathname === "/settings"}
          className="flex items-center gap-space-2 text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors data-[active=true]:text-on-surface"
        >
          <Settings size={16} strokeWidth={1.5} />
          <span>Settings</span>
          <span className="font-label-sm text-label-sm text-outline">[:set]</span>
        </Link>
      </div>
      </aside>
    </>
  );
}
