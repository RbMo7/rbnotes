"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Search, Settings } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { groupNotes } from "@/lib/grouping";
import { NoteListItem } from "@/components/shell/NoteListItem";
import { useNotesQuery, useCreateNote } from "@/lib/notes-query";

export function Sidebar() {
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const mobileOpen = useWorkspaceStore((s) => s.mobileSidebarOpen);
  const setMobileOpen = useWorkspaceStore((s) => s.setMobileSidebarOpen);
  const setSearchOpen = useWorkspaceStore((s) => s.setSearchOpen);
  const { data: notes = [] } = useNotesQuery();
  // Content is already fully loaded client-side (see lib/notes-query.ts),
  // so grouping/sorting here is a pure in-memory computation -- the same
  // reason tags and graph don't fetch anything on click either.
  const groups = groupNotes(
    notes.map((n) => ({ ...n, updatedAt: new Date(n.updatedAt) })),
  );
  const pathname = usePathname();
  const router = useRouter();
  const createNote = useCreateNote();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const handleNewNote = () => {
    createNote();
    setMobileOpen(false);
  };

  // Every note's content already lives in the client cache -- the only
  // thing still standing between a sidebar click and an instant switch is
  // Next's own route segment, which it won't fetch ahead of time for a
  // dynamic page without this. Staggered (not Promise.all) so opening a
  // notebook with hundreds of notes doesn't fire them all in one burst.
  // Note: Next only prefetches in production builds -- this has no visible
  // effect under `next dev`.
  useEffect(() => {
    let cancelled = false;
    const ids = notes.map((n) => n.id);
    let i = 0;
    function prefetchNext() {
      if (cancelled || i >= ids.length) return;
      router.prefetch(`/notes/${ids[i]}`);
      i++;
      setTimeout(prefetchNext, 75);
    }
    prefetchNext();
    return () => {
      cancelled = true;
    };
  }, [notes, router]);

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
      <div className="h-14 px-space-4 border-b border-outline-variant/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-space-2">
          <Image src="/logo.svg" alt="RbNotes" width={32} height={32} className="h-8 w-auto" />
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            RbNotes
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-outline px-space-1 py-space-0 rounded bg-surface-container-high">
          v0.4.2
        </span>
      </div>

      <div className="p-space-3 space-y-space-2 shrink-0 border-b border-outline-variant/20">
        <button
          onClick={handleNewNote}
          className="w-full flex items-center justify-between px-space-3 py-space-2 bg-primary text-on-primary font-label-md text-label-md rounded hover:bg-primary-fixed transition-colors"
        >
          <span>+ New Note</span>
          <span className="font-label-sm text-label-sm opacity-80">[^N]</span>
        </button>
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center justify-between px-space-3 py-space-2 bg-surface-container text-on-surface-variant font-label-md text-label-md rounded border border-outline-variant/40 hover:text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <span className="flex items-center gap-space-2">
            <Search size={16} strokeWidth={1.5} />
            <span>/ Quick search</span>
          </span>
          <span className="font-label-sm text-label-sm text-outline">[/]</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-space-3 py-space-2 space-y-space-4">
        {groups.map((group) =>
          group.label === "ARCHIVE" ? (
            <div key={group.label} className="space-y-space-1">
              <button
                onClick={() => setArchiveOpen((v) => !v)}
                className="w-full flex items-center justify-between px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider hover:text-on-surface-variant transition-colors"
              >
                <span className="flex items-center gap-space-1">
                  {archiveOpen ? (
                    <ChevronDown size={12} strokeWidth={2} />
                  ) : (
                    <ChevronRight size={12} strokeWidth={2} />
                  )}
                  {group.label}
                </span>
                <span className="normal-case tracking-normal text-outline/70">
                  {group.notes.length}
                </span>
              </button>
              {archiveOpen && (
                <div className="space-y-space-px">
                  {group.notes.map((note) => (
                    <NoteListItem
                      key={note.id}
                      id={note.id}
                      title={note.title}
                      updatedAt={note.updatedAt}
                      archived={note.archived}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={group.label} className="space-y-space-1">
              <div className="px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider">
                {group.label}
              </div>
              <div className="space-y-space-px">
                {group.notes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    id={note.id}
                    title={note.title}
                    updatedAt={note.updatedAt}
                    archived={note.archived}
                  />
                ))}
              </div>
            </div>
          ),
        )}
        {groups.length === 0 && (
          <p className="px-space-2 font-body-sm text-body-sm text-outline/50">
            ~ no notes yet
          </p>
        )}
      </nav>

      <div className="h-12 px-space-4 border-t border-outline-variant/30 flex items-center justify-between shrink-0 bg-surface-container-low">
        <Link
          href="/settings"
          data-active={pathname === "/settings"}
          className="flex items-center gap-space-2 text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors data-[active=true]:text-on-surface"
        >
          <Settings size={16} strokeWidth={1.5} />
          <span>Settings</span>
          <span className="font-label-sm text-label-sm text-outline">[:set]</span>
        </Link>
        <div className="flex items-center gap-space-2">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
          <span className="font-label-sm text-label-sm text-outline">READY</span>
        </div>
      </div>
      </aside>
    </>
  );
}
