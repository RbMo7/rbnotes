"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWorkspaceStore, type SaveState } from "@/lib/store";
import { saveNoteContentAction } from "@/server/actions/notes";
import { deriveTitleFromContent } from "@/lib/markdown-title";
import { getNote as getLocalNote, setNote as setLocalNote, markSynced as markLocalSynced } from "@/lib/local-notes-store";

const DEBOUNCE_MS = 800;
// Local-store durability is debounced separately from, and far shorter
// than, the server push -- every markDirty (i.e. every keystroke) would
// otherwise cost an IndexedDB read+write, which is wasted I/O on fast
// typing. 150ms is comfortably under human reaction time, so "refresh
// immediately after typing" still lands after this has settled.
const LOCAL_PERSIST_MS = 150;
// How often a still-dirty note gets an automatic background retry, on top
// of the debounce and the `online` event -- catches the case where the
// connection recovers without the browser ever firing `online` (e.g. it
// was already "online" per navigator.onLine but requests were failing).
const RETRY_POLL_MS = 30_000;

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/**
 * Immediate browser-storage durability for every edit (Seam 1's Local
 * store), independent of the debounced server push below. Fire-and-forget:
 * a failure here has no user-visible effect beyond losing the "survives a
 * refresh mid-keystroke" guarantee for this one edit, which is strictly
 * better than today's zero persistence -- it must never block or fail the
 * caller's own flow.
 */
async function persistLocallyImmediately(noteId: string, content: string) {
  try {
    const existing = await getLocalNote(noteId);
    const now = new Date().toISOString();
    await setLocalNote({
      id: noteId,
      title: deriveTitleFromContent(content),
      content,
      pinned: existing?.pinned ?? false,
      archived: existing?.archived ?? false,
      createdAt: existing?.createdAt ?? now,
      editedAt: now,
      syncedAt: existing?.syncedAt ?? null,
      deleted: false,
    });
  } catch {
    // Local store unavailable (private browsing, quota, etc.) -- the live
    // editor buffer is still the durable-enough fallback until save.
  }
}

export type SavedInfo = { title: string; content: string; updatedAt: string };

type BufferSaveInfo = {
  revision: number;
  savedRevision: number;
  status: SaveState;
  timer: ReturnType<typeof setTimeout> | null;
  localTimer: ReturnType<typeof setTimeout> | null;
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
      info = { revision: 0, savedRevision: 0, status: "clean", timer: null, localTimer: null };
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

      const myRevisionAtEntry = info.revision;
      const contentAtEntry = getContentForRef.current(noteId);
      // A flush (debounced or forced via `:w`/Ctrl+S) always supersedes the
      // shorter local-persist debounce -- cancel it and write the current
      // content now, so local durability is never behind what's about to
      // (or just did) reach the server.
      if (info.localTimer) {
        clearTimeout(info.localTimer);
        info.localTimer = null;
      }
      if (contentAtEntry !== null) void persistLocallyImmediately(noteId, contentAtEntry);

      // Local-only session (CONTEXT.md): persistLocallyImmediately (called
      // from markDirty) already made this edit durable, and every action in
      // server/actions/notes.ts requires a real session -- calling one here
      // would redirect an anonymous user to /login on their first save.
      // Local durability IS the save for this tier; there is nothing to push.
      if (!useWorkspaceStore.getState().syncEnabled) {
        if (contentAtEntry === null) {
          info.status = "error";
          syncIfActive(noteId);
          return false;
        }
        if (myRevisionAtEntry > info.savedRevision) info.savedRevision = myRevisionAtEntry;
        const stillDirty = info.revision !== info.savedRevision;
        info.status = stillDirty ? "dirty" : "clean";
        useWorkspaceStore.getState().setNoteDirty(noteId, stillDirty);
        syncIfActive(noteId);
        onSavedRef.current(noteId, {
          title: deriveTitleFromContent(contentAtEntry),
          content: contentAtEntry,
          updatedAt: new Date().toISOString(),
        });
        return true;
      }

      // Local storage already has this edit (see persistLocallyImmediately,
      // called from markDirty) -- offline just means the server push
      // itself waits. Stays "dirty" so isDirty/UI reflect a pending push,
      // not an error; the online-event listener and the periodic retry
      // below are what re-attempt it.
      if (!isOnline()) {
        info.status = "dirty";
        syncIfActive(noteId);
        return false;
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
        void markLocalSynced(noteId, result.updatedAt);
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
      if (info.localTimer) clearTimeout(info.localTimer);
      info.localTimer = setTimeout(() => {
        const content = getContentForRef.current(noteId);
        if (content !== null) void persistLocallyImmediately(noteId, content);
      }, LOCAL_PERSIST_MS);
      if (info.timer) clearTimeout(info.timer);
      info.timer = setTimeout(() => {
        void flush(noteId);
      }, DEBOUNCE_MS);
    },
    [getInfo, syncIfActive, flush],
  );

  // Retry every note still waiting on a push: on regaining connectivity
  // (the `online` event) and on a slow poll as a backstop for the case
  // where `navigator.onLine` was already true but pushes were failing.
  useEffect(() => {
    const flushAllDirty = () => {
      for (const [noteId, info] of infoRef.current) {
        if (info.revision !== info.savedRevision) void flush(noteId);
      }
    };
    window.addEventListener("online", flushAllDirty);
    const interval = setInterval(flushAllDirty, RETRY_POLL_MS);
    return () => {
      window.removeEventListener("online", flushAllDirty);
      clearInterval(interval);
    };
  }, [flush]);

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
