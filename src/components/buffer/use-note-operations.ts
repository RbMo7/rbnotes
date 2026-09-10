"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useNotesMutations, useCreateNote } from "@/lib/notes-query";
import { displayFilename } from "@/lib/format";
import { setNoteFlagsAction, deleteNoteAction } from "@/server/actions/notes";
import type { NoteOps } from "@/components/editor/command-dispatch";

/**
 * The note operations the command layer drives, with the archive-vs-delete
 * policy in one place instead of assembled ad hoc in the buffer workspace:
 * an empty buffer is deleted for real; a non-empty buffer is archived.
 * `:delete!` forces the real delete regardless. Optimistic cache updates and
 * the background persistence call live here too.
 */
export function useNoteOperations({
  noteId,
  getContent,
  save,
  isDirty,
  notify,
}: {
  noteId: string;
  getContent: () => string;
  save: () => Promise<boolean>;
  isDirty: () => boolean;
  notify: (message: string) => void;
}): NoteOps {
  const router = useRouter();
  const { updateNote, removeNote } = useNotesMutations();
  const createNote = useCreateNote();

  const rename = useCallback(
    (newTitle: string) => {
      updateNote(noteId, { title: newTitle });
      notify(`RENAME: "${displayFilename(newTitle)}" written  [OK]`);
    },
    [noteId, updateNote, notify],
  );

  const deleteNote = useCallback(
    (hard: boolean) => {
      // Same instant pattern as `:new`: update the cache and navigate first,
      // persist in the background. There is nothing to roll back to --
      // archived/deleted is a one-way door, same as real Vim's `:bd`. An
      // empty buffer is deleted for real rather than archived (nothing worth
      // keeping), which is also what makes deleting an unsaved `:new` note
      // correct: it doesn't exist server-side yet, so the call is a no-op.
      const isEmpty = getContent().trim().length === 0;
      if (hard || isEmpty) {
        removeNote(noteId);
        deleteNoteAction({ noteId }).catch(() => {});
      } else {
        updateNote(noteId, { archived: true });
        setNoteFlagsAction({ noteId, archived: true }).catch(() => {});
      }
      router.push("/notes");
    },
    [noteId, getContent, removeNote, updateNote, router],
  );

  return useMemo(
    () => ({ save, isDirty, create: createNote, rename, delete: deleteNote }),
    [save, isDirty, createNote, rename, deleteNote],
  );
}
