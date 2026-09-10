"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { saveNoteContentAction } from "@/server/actions/notes";

/**
 * Real terminal semantics: nothing persists until an explicit `:w`, `:wq`,
 * or Ctrl+S. `markDirty()` (called on every CodeMirror change) only flips
 * local state -- it never touches the network. `write()` is the sole path
 * to `saveNoteContentAction`, matching how a real editor's write command
 * works: on failure it reports the error and waits for the next explicit
 * write, it does not retry in the background.
 *
 * The revision guard still matters even without a debounce loop: a rapid
 * double `:w` (or `:wq` firing write+quit back to back) must not let an
 * in-flight response mark a newer edit "clean" out of order.
 */
export type SavedInfo = { title: string; content: string; updatedAt: string };

export function useManualSave(
  noteId: string,
  getContent: () => string,
  onSaved?: (info: SavedInfo) => void,
) {
  const setSaveState = useWorkspaceStore((s) => s.setSaveState);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const savingRef = useRef(false);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  /** Returns whether the write succeeded -- `:wq` only quits on success. */
  const write = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return true;
    if (revisionRef.current === savedRevisionRef.current) return true;

    savingRef.current = true;
    setSaveState("saving");
    const myRevision = revisionRef.current;
    const content = getContent();

    try {
      const result = await saveNoteContentAction({ noteId, content, clientRevision: myRevision });
      savingRef.current = false;
      if (myRevision > savedRevisionRef.current) savedRevisionRef.current = myRevision;
      setSaveState(revisionRef.current === savedRevisionRef.current ? "clean" : "dirty");
      // The server is the single source of truth for the title (derived
      // from the note's own first heading) -- reflect exactly what it
      // persisted (and the content that produced it) into the shared
      // notes cache, rather than re-deriving it again client-side.
      onSavedRef.current?.({ title: result.title, content, updatedAt: result.updatedAt });
      return true;
    } catch {
      savingRef.current = false;
      setSaveState("error");
      return false;
    }
  }, [noteId, getContent, setSaveState]);

  const markDirty = useCallback(() => {
    revisionRef.current += 1;
    setSaveState("dirty");
  }, [setSaveState]);

  const isDirty = useCallback(
    () => revisionRef.current !== savedRevisionRef.current,
    [],
  );

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (revisionRef.current !== savedRevisionRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return { markDirty, write, isDirty };
}
