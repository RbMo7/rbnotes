"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWorkspaceStore, type SaveState } from "@/lib/store";
import { saveNoteContentAction } from "@/server/actions/notes";

const DEBOUNCE_MS = 800;

export type SavedInfo = { title: string; content: string; updatedAt: string };

type BufferSaveInfo = {
  revision: number;
  savedRevision: number;
  status: SaveState;
  timer: ReturnType<typeof setTimeout> | null;
};

/**
 * One autosave engine for the whole persistent workspace, not one per
 * buffer -- integrating once here (rather than inside Editor, which is
 * remounted only on a rare vimEnabled/readOnly flip) is what lets a
 * background buffer's debounce keep counting down after the user switches
 * away from it, instead of losing its timer.
 *
 * Real terminal semantics for the *trigger*, autosave for the *persistence*:
 * every edit both marks dirty AND (re)starts a short idle debounce down to
 * `flush`; `:w`/Ctrl+S call the exact same `flush` immediately, cancelling
 * any pending timer for that buffer first -- one persist path, two ways to
 * reach it. The store's single `saveState` field always mirrors whichever
 * buffer is currently active; a background buffer's own status lives in
 * `infoRef` until it becomes active again.
 */
export function useAutosave({
  getContentFor,
  activeNoteId,
  onSaved,
}: {
  getContentFor: (noteId: string) => string | null;
  activeNoteId: string | null;
  onSaved: (noteId: string, info: SavedInfo) => void;
}) {
  const infoRef = useRef(new Map<string, BufferSaveInfo>());
  const activeNoteIdRef = useRef(activeNoteId);
  const getContentForRef = useRef(getContentFor);
  const onSavedRef = useRef(onSaved);
  // Mirrored in an effect, not during render -- flush()/markDirty() below
  // are called from event handlers and timers, well outside any render, so
  // they need the latest values without themselves being reactive
  // dependencies (which would tear down and reschedule every debounce timer
  // on every unrelated re-render).
  useEffect(() => {
    activeNoteIdRef.current = activeNoteId;
    getContentForRef.current = getContentFor;
    onSavedRef.current = onSaved;
  });

  const getInfo = useCallback((noteId: string): BufferSaveInfo => {
    let info = infoRef.current.get(noteId);
    if (!info) {
      info = { revision: 0, savedRevision: 0, status: "clean", timer: null };
      infoRef.current.set(noteId, info);
    }
    return info;
  }, []);

  const syncIfActive = useCallback((noteId: string) => {
    if (noteId !== activeNoteIdRef.current) return;
    useWorkspaceStore.getState().setSaveState(getInfo(noteId).status);
  }, [getInfo]);

  // The buffer displayed just changed -- reflect *its* status, not the
  // previous buffer's, in the shared statusline field.
  useEffect(() => {
    useWorkspaceStore
      .getState()
      .setSaveState(activeNoteId ? getInfo(activeNoteId).status : "clean");
  }, [activeNoteId, getInfo]);

  const flush = useCallback(
    async (noteId: string): Promise<boolean> => {
      const info = getInfo(noteId);
      if (info.timer) {
        clearTimeout(info.timer);
        info.timer = null;
      }
      if (info.revision === info.savedRevision) {
        info.status = "clean";
        syncIfActive(noteId);
        return true;
      }

      info.status = "saving";
      syncIfActive(noteId);
      const myRevision = info.revision;
      const content = getContentForRef.current(noteId);
      if (content === null) {
        // No live document to read from (shouldn't happen -- a dirty
        // buffer implies it was, at some point, the active document).
        info.status = "error";
        syncIfActive(noteId);
        return false;
      }

      try {
        const result = await saveNoteContentAction({ noteId, content });
        if (myRevision > info.savedRevision) info.savedRevision = myRevision;
        const stillDirty = info.revision !== info.savedRevision;
        info.status = stillDirty ? "dirty" : "clean";
        useWorkspaceStore.getState().setNoteDirty(noteId, stillDirty);
        syncIfActive(noteId);
        onSavedRef.current(noteId, { title: result.title, content, updatedAt: result.updatedAt });
        return true;
      } catch {
        info.status = "error";
        syncIfActive(noteId);
        return false;
      }
    },
    [getInfo, syncIfActive],
  );

  const markDirty = useCallback(
    (noteId: string) => {
      const info = getInfo(noteId);
      info.revision += 1;
      info.status = "dirty";
      useWorkspaceStore.getState().setNoteDirty(noteId, true);
      syncIfActive(noteId);
      if (info.timer) clearTimeout(info.timer);
      info.timer = setTimeout(() => {
        void flush(noteId);
      }, DEBOUNCE_MS);
    },
    [getInfo, syncIfActive, flush],
  );

  const isDirty = useCallback(
    (noteId: string) => getInfo(noteId).revision !== getInfo(noteId).savedRevision,
    [getInfo],
  );

  // Deliberately no beforeunload guard: manual-only save needed one as its
  // sole safety net, but autosave's own short idle debounce already closes
  // that window down to a fraction of a second in the common case, and a
  // close-tab durability *guarantee* for what's left is explicitly
  // out of scope / follow-up work (see spec.md's Out of Scope and Further
  // Notes) -- not something to half-implement as an unrequested warning
  // dialog here.

  return { markDirty, flush, isDirty };
}
