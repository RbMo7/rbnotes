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
import { useSignOut } from "@/lib/use-sign-out";
import { LocalOnlyBadge } from "@/components/shell/LocalOnlyBadge";

const SECTION_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/settings": "Settings",
};

export function TopBar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);
  const toggleInspector = useWorkspaceStore((s) => s.toggleInspector);
  const titleRevealed = useWorkspaceStore((s) => s.titleRevealed);
  const { activeNoteId } = useWorkspace();
  const { data: notes } = useNotesQuery();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const signOut = useSignOut();

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

  // The header's own title only earns its keep once the real one (the
  // note's H1, on screen in the buffer) isn't -- see Editor's
  // onTitleRevealChange. Dashboard/Settings have no such H1 to defer to, so
  // their section label always shows at full height; `titleRevealed`
  // defaults true outside a note buffer for exactly that reason.
  const compact = !!activeNote && !titleRevealed;

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
      className={`fixed top-0 right-0 bg-surface/90 border-b border-outline-variant/30 z-30 flex items-center justify-between px-space-6 backdrop-blur-sm transition-[left,height] duration-150 ${headerOffsetClass} ${compact ? "h-header-height-compact" : "h-header-height"}`}
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
          className={`text-primary font-headline-sm text-headline-sm tracking-tight truncate transition-opacity duration-150 ${compact ? "opacity-0" : "opacity-100"}`}
          title={title}
        >
          {title}
        </span>
      </div>
      <div className="flex items-center gap-space-3 shrink-0">
        {!email && <LocalOnlyBadge />}
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
                {email ?? "Local only"}
              </div>
              <Link
                href="/"
                className="block px-space-3 py-space-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </Link>
              {email ? (
                <>
                  <Link
                    href="/settings"
                    className="block px-space-3 py-space-2 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                    onClick={() => setMenuOpen(false)}
                  >
                    Settings [:set]
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    className="w-full text-left px-space-3 py-space-2 font-body-sm text-body-sm text-error hover:bg-surface-container-highest"
                  >
                    Sign out [:q!]
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="block px-space-3 py-space-2 font-body-sm text-body-sm text-primary hover:bg-surface-container-highest"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign in to sync
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
