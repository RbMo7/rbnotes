"use client";

import { useCallback, useMemo } from "react";
import { useNotesMutations } from "@/lib/notes-query";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { useWorkspaceStore } from "@/lib/store";
import { displayFilename } from "@/lib/format";
import { setNoteFlagsAction, deleteNoteAction } from "@/server/actions/notes";
import {
  getNote as getLocalNote,
  setNote as setLocalNote,
  tombstoneNote as tombstoneLocalNote,
  purgeNote as purgeLocalNote,
} from "@/lib/local-notes-store";
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
  const { updateNote, removeNote } = useNotesMutations();
  const { createAndOpenNote, goHome } = useWorkspace();

  const rename = useCallback(
    (newTitle: string) => {
      updateNote(noteId, { title: newTitle });
      notify(`RENAME: "${displayFilename(newTitle)}" written  [OK]`);
      // Local store mirror (Seam 1) is universal, not a Local-only-only
      // concern -- without this a renamed note's Local store copy keeps
      // the stale title, and useLocalNotesQuery's mount-time reseed (or
      // warmAllNotes for a Synced session) would happily write it right
      // back into the cache.
      void (async () => {
        const existing = await getLocalNote(noteId);
        if (!existing) return;
        await setLocalNote({ ...existing, title: newTitle, editedAt: new Date().toISOString() });
      })();
    },
    [noteId, updateNote, notify],
  );

  const deleteNote = useCallback(
    (hard: boolean) => {
      // Same instant pattern as `:new`: update the cache and switch buffers
      // first, persist in the background. There is nothing to roll back to
      // -- archived/deleted is a one-way door, same as real Vim's `:bd`.
      // The archive-vs-purge decision itself is the command layer's policy
      // (resolveDeleteMode); this just applies the resulting mode.
      const mode = resolveDeleteMode(hard, getContent());
      const now = new Date().toISOString();
      // setNoteFlagsAction/deleteNoteAction both require a real session
      // (getAuthedUser()) -- calling either for a Local-only session would
      // redirect to /login, the same class of bug useAutosave/handleShare/
      // updateSettings were already fixed for.
      const syncEnabled = useWorkspaceStore.getState().syncEnabled;

      if (mode === "purge") {
        removeNote(noteId);
        void (async () => {
          const existing = await getLocalNote(noteId);
          // Never pushed to the server -- nothing to sync, safe to forget
          // outright. Already synced -- Tombstone it instead, so the
          // delete itself has something to eventually push.
          if (!existing || existing.syncedAt === null) {
            await purgeLocalNote(noteId);
          } else {
            await tombstoneLocalNote(noteId, now);
          }
        })();
        if (syncEnabled) deleteNoteAction({ noteId }).catch(() => {});
      } else {
        updateNote(noteId, { archived: true });
        void (async () => {
          const existing = await getLocalNote(noteId);
          if (existing) await setLocalNote({ ...existing, archived: true, editedAt: now });
        })();
        if (syncEnabled) setNoteFlagsAction({ noteId, archived: true }).catch(() => {});
      }
      goHome();
    },
    [noteId, getContent, removeNote, updateNote, goHome],
  );

  return useMemo(
    () => ({ create: createAndOpenNote, rename, delete: deleteNote }),
    [createAndOpenNote, rename, deleteNote],
  );
}
