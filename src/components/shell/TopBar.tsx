"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, GitCommitHorizontal, PanelLeft, User } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { useNotesQuery } from "@/lib/notes-query";
import { displayFilename } from "@/lib/format";
import { signOutAction } from "@/server/actions/auth";

const SECTION_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/settings": "Settings",
};

export function TopBar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const toggleInspector = useWorkspaceStore((s) => s.toggleInspector);
  const { activeNoteId } = useWorkspace();
  const { data: notes } = useNotesQuery();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Derived synchronously from the same source WorkspaceBuffer reads,
  // rather than the store's activeFilename -- that field is written from an
  // effect and would lag a frame behind every buffer switch.
  const activeNote = activeNoteId ? notes?.find((n) => n.id === activeNoteId) : undefined;
  const title = activeNote ? displayFilename(activeNote.title) : (SECTION_TITLES[pathname] ?? "");

  // Below the mobile breakpoint there's no sidebar to toggle -- its browse
  // role lives in the Dashboard route's List screen instead (CONTEXT.md).
  // A note open there is the Note screen, and this button becomes its one
  // way back to the List screen rather than an overlay toggle; with no
  // note open the List screen already shows everything, so there's nothing
  // for a leading button to do.
  const mobileNoteOpen = isDesktop === false && !!activeNote;
  const showLeadingButton = isDesktop !== false || mobileNoteOpen;

  // Same `left-sidebar-width` offset as always for every width Sidebar
  // still renders at (isDesktop !== false, including the sub-1024px band
  // where it's a translated-out overlay, not docked -- untouched here);
  // only genuine mobile (isDesktop === false, where Sidebar renders nothing
  // at all) skips reserving that space.
  const headerOffsetClass =
    isDesktop === false ? "left-0" : "left-sidebar-width data-[collapsed=true]:left-0";

  return (
    <header
      data-collapsed={collapsed}
      className={`fixed top-0 right-0 h-header-height bg-surface/90 border-b border-outline-variant/30 z-30 flex items-center justify-between px-space-6 backdrop-blur-sm transition-[left] duration-150 ${headerOffsetClass}`}
    >
      <div className="flex items-center gap-space-4 min-w-0">
        {showLeadingButton && (
          <button
            onClick={mobileNoteOpen ? () => router.push("/") : toggleSidebar}
            className="text-on-surface-variant hover:text-on-surface transition-colors -ml-space-2 p-space-1 shrink-0"
            title={mobileNoteOpen ? "Back to notes" : "Toggle sidebar [Ctrl+B]"}
            aria-label={mobileNoteOpen ? "Back to notes" : "Toggle sidebar"}
          >
            {mobileNoteOpen ? (
              <ArrowLeft size={16} strokeWidth={1.5} />
            ) : (
              <PanelLeft size={16} strokeWidth={1.5} />
            )}
          </button>
        )}
        <span
          className="text-primary font-headline-md text-headline-md tracking-tight truncate"
          title={title}
        >
          {title}
        </span>
      </div>
      <div className="flex items-center gap-space-3 shrink-0">
        <div className="flex items-center gap-space-2 text-on-surface-variant font-label-sm text-label-sm bg-surface-container px-space-2 py-space-1 rounded">
          <GitCommitHorizontal size={14} strokeWidth={1.5} />
          <span>main</span>
        </div>
        {activeNote && (
          <button
            onClick={toggleInspector}
            className="px-space-2 py-space-1 bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm rounded transition-colors"
            title="Toggle Side Inspector [:insp]"
          >
            :insp
          </button>
        )}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
            aria-label="Account menu"
          >
            <User size={18} strokeWidth={1.5} className="text-on-primary" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-space-2 w-56 bg-surface-container-high border border-outline-variant shadow-2xl z-50 py-space-2">
              <div className="px-space-3 py-space-2 font-label-sm text-label-sm text-outline border-b border-outline-variant truncate">
                {email}
              </div>
              <Link
                href="/settings"
                className="block px-space-3 py-space-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                onClick={() => setMenuOpen(false)}
              >
                Settings [:set]
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full text-left px-space-3 py-space-2 font-body-sm text-body-sm text-error hover:bg-surface-container-highest"
                >
                  Sign out [:q!]
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
