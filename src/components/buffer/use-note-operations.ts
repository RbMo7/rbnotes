"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useNotesMutations, useCreateNote } from "@/lib/notes-query";
import { displayFilename } from "@/lib/format";
import { setNoteFlagsAction, deleteNoteAction } from "@/server/actions/notes";
import { resolveDeleteMode, type NoteOps } from "@/components/editor/command-dispatch";

/**
 * The note-mutating operations the command layer drives, with the
 * archive-vs-delete policy in one place instead of assembled ad hoc in the
 * buffer workspace: an empty buffer is deleted for real; a non-empty buffer
 * is archived. `:delete!` forces the real delete regardless. Optimistic
 * cache updates and the background persistence call live here too.
 *
 * Save/isDirty are the buffer's, not a note operation, so the caller spreads
 * those in directly rather than this hook passing them through.
 */
export function useNoteOperations({
  noteId,
  getContent,
  notify,
}: {
  noteId: string;
  getContent: () => string;
  notify: (message: string) => void;
}): Pick<NoteOps, "create" | "rename" | "delete"> {
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
      // archived/deleted is a one-way door, same as real Vim's `:bd`. The
      // archive-vs-purge decision itself is the command layer's policy
      // (resolveDeleteMode); this just applies the resulting mode.
      const mode = resolveDeleteMode(hard, getContent());
      if (mode === "purge") {
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
    () => ({ create: createNote, rename, delete: deleteNote }),
    [createNote, rename, deleteNote],
  );
}
