"use client";

import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspaceNav } from "@/components/workspace/useWorkspaceNav";
import {
  useNotesQuery,
  useLocalNotesQuery,
  useMigrateLocalNotes,
  useCreateNote,
  warmAllNotes,
} from "@/lib/notes-query";
import { notesQueryKey, type NoteRecord } from "@/lib/note-types";
import { useWorkspaceStore, isNoteDirty } from "@/lib/store";
import { WorkspaceContextProvider, type WorkspaceApi } from "@/components/workspace/WorkspaceContext";
import { WorkspaceBuffer } from "@/components/workspace/WorkspaceBuffer";
import { Sidebar } from "@/components/shell/Sidebar";
import { AppShell } from "@/components/shell/AppShell";
import { DeviceTracking } from "@/components/shell/DeviceTracking";
import { SyncingNotesToast } from "@/components/shell/SyncingNotesToast";

function mostRecentOpenNote(notes: NoteRecord[]): NoteRecord | undefined {
  return notes
    .filter((n) => !n.archived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

/**
 * Mounted once in (app)/layout.tsx, above the sidebar and the per-route
 * `children` alike -- composing Sidebar and AppShell here (rather than in
 * the layout) is what lets both consume useWorkspace() (Sidebar's note
 * links, the shell's Ctrl+N/Ctrl+P) and what makes the buffer UI
 * (WorkspaceBuffer) persistent across every in-app note switch: it isn't
 * part of `children` at all, it's rendered directly here, and `children`
 * only takes over when the URL is outside `/notes*` (the Dashboard,
 * tags, settings...).
 */
export function WorkspaceProvider({
  email,
  children,
}: {
  email: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const inNotesSection = pathname === "/notes" || pathname.startsWith("/notes/");

  // Data itself unused here now -- goHome reads the cache live via
  // queryClient instead (see below) -- but the call stays to keep this
  // the mount point that kicks off the fetch.
  useNotesQuery();
  const currentUserId = useWorkspaceStore((s) => s.currentUserId);
  useLocalNotesQuery(!email);
  const migrationProgress = useMigrateLocalNotes(email, currentUserId);
  const { activeNoteId, open } = useWorkspaceNav();
  const createNote = useCreateNote();
  const setActiveFilename = useWorkspaceStore((s) => s.setActiveFilename);
  const setActiveBufferInfo = useWorkspaceStore((s) => s.setActiveBufferInfo);
  const setTitleRevealed = useWorkspaceStore((s) => s.setTitleRevealed);
  const queryClient = useQueryClient();

  // Fired once, right after first paint: warms every note's content in one
  // batch rather than a serial per-note loop (see lib/notes-query.ts's
  // warmAllNotes for the skip-dirty/stale-never-clobbers guarantees). Only
  // meaningful for a Synced session -- a Local-only session's notes are
  // already fully warm coming out of the Local store (useLocalNotesQuery
  // above), and warmAllNotes's own server action would redirect it anyway.
  useEffect(() => {
    if (!email) return;
    void warmAllNotes(queryClient, currentUserId, isNoteDirty);
  }, [queryClient, email, currentUserId]);

  // The Dashboard (`/`) is the landing screen now, not a resolved buffer --
  // so nothing here auto-opens a note on bare `/notes` anymore. Leaving the
  // notes section still needs its own cleanup: the footer's filename/word
  // count are written by whichever WorkspaceBuffer was last mounted and
  // never cleared on their own, since WorkspaceBuffer itself unmounts.
  useEffect(() => {
    if (inNotesSection) return;
    setActiveFilename(null);
    setActiveBufferInfo(null);
    setTitleRevealed(true);
  }, [inNotesSection, setActiveFilename, setActiveBufferInfo, setTitleRevealed]);

  const goHome = useCallback(() => {
    // Reads the cache directly rather than closing over the `notes` from
    // this render: a caller that just mutated the cache (removeNote,
    // archiving) and calls goHome() synchronously right after gets the
    // stale pre-mutation snapshot from `notes` -- React hasn't re-rendered
    // yet -- which could resolve back to the very note that was just
    // deleted/archived and reopen it, landing on "E484: no such buffer"
    // instead of actually going anywhere.
    const live = queryClient.getQueryData<NoteRecord[]>(notesQueryKey);
    const home = live ? mostRecentOpenNote(live) : undefined;
    if (home) open(home.id);
    else router.replace("/");
  }, [queryClient, open, router]);

  const createAndOpenNote = useCallback(() => {
    const id = createNote();
    open(id);
  }, [createNote, open]);

  const api: WorkspaceApi = useMemo(
    () => ({
      activeNoteId: inNotesSection ? activeNoteId : null,
      openNote: open,
      goHome,
      createAndOpenNote,
    }),
    [inNotesSection, activeNoteId, open, goHome, createAndOpenNote],
  );

  return (
    <WorkspaceContextProvider value={api}>
      {!email && <DeviceTracking />}
      <SyncingNotesToast total={migrationProgress.total} current={migrationProgress.current} />
      <Sidebar />
      <AppShell email={email}>{inNotesSection ? <WorkspaceBuffer /> : children}</AppShell>
    </WorkspaceContextProvider>
  );
}
