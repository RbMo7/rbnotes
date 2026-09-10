"use client";

import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useWorkspaceNav } from "@/components/workspace/useWorkspaceNav";
import { useWarmUpScheduler } from "@/components/workspace/useWarmUpScheduler";
import { useNotesQuery, useCreateNote } from "@/lib/notes-query";
import type { NoteRecord } from "@/lib/note-types";
import { WorkspaceContextProvider, type WorkspaceApi } from "@/components/workspace/WorkspaceContext";
import { WorkspaceBuffer } from "@/components/workspace/WorkspaceBuffer";
import { Sidebar } from "@/components/shell/Sidebar";
import { AppShell } from "@/components/shell/AppShell";

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
 * only takes over when the URL is outside `/notes*` (tags, graph,
 * settings...).
 */
export function WorkspaceProvider({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const inNotesSection = pathname === "/notes" || pathname.startsWith("/notes/");

  const { data: notes } = useNotesQuery();
  const { activeNoteId: rawActiveNoteId, open, settle, clearToHome } = useWorkspaceNav();
  const createNote = useCreateNote();
  useWarmUpScheduler();

  // Home entry: bare `/notes` (nothing switched to yet) resolves to the
  // most-recently-updated non-archived note. Derived synchronously at
  // render time (not settled-then-re-rendered) so the very first paint
  // already shows it -- no blank redirect hop through the empty-buffer
  // screen while an effect catches up. The address bar is kept in sync
  // separately, below, since a history API call can't happen during render.
  const resolvedHome = useMemo(
    () => (notes ? mostRecentOpenNote(notes) : undefined),
    [notes],
  );
  const activeNoteId = rawActiveNoteId ?? resolvedHome?.id ?? null;

  useEffect(() => {
    if (!inNotesSection || rawActiveNoteId !== null || !resolvedHome) return;
    settle(resolvedHome.id);
  }, [inNotesSection, rawActiveNoteId, resolvedHome, settle]);

  const goHome = useCallback(() => {
    const home = notes ? mostRecentOpenNote(notes) : undefined;
    if (home) open(home.id);
    else clearToHome();
  }, [notes, open, clearToHome]);

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
      <Sidebar />
      <AppShell email={email}>{inNotesSection ? <WorkspaceBuffer /> : children}</AppShell>
    </WorkspaceContextProvider>
  );
}
