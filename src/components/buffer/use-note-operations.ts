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
import { retryFireAndForget } from "@/lib/retry-fire-and-forget";

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
  noteTitle,
  getContent,
  notify,
  cancelAutosave,
}: {
  noteId: string;
  noteTitle: string;
  getContent: () => string;
  notify: (message: string, tone?: "info" | "error", undo?: () => void) => void;
  /** useAutosave's cancel(noteId) -- stops a pending save from resurrecting a just-deleted note. */
  cancelAutosave: (noteId: string) => void;
}): Pick<NoteOps, "create" | "rename" | "delete"> {
  const { updateNote, removeNote } = useNotesMutations();
  const { createAndOpenNote, goHome, openNote } = useWorkspace();

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

      // A save still pending (debounce not yet fired, or mid-retry) for
      // this exact note must never survive the delete -- it would fire
      // later and call persistLocallyImmediately, which rewrites
      // `deleted: false` over the tombstone/purge below.
      cancelAutosave(noteId);

      if (mode === "purge") {
        removeNote(noteId);
        void (async () => {
          const existing = await getLocalNote(noteId);
          // Never pushed to the server -- nothing to sync, safe to forget
          // outright. Anything else -- known-synced, or no local record
          // at all -- tombstones instead of purging. A missing record
          // is ambiguous, not evidence of "never synced": warmAllNotes
          // mirrors a fetched note into the Local store in the
          // background (fire-and-forget, after first paint), so a
          // delete landing before that write resolves would otherwise
          // read `undefined` for a note that's actually already synced,
          // and purging it here would be the wrong, irreversible call.
          // tombstoneLocalNote is a safe no-op when there truly is no
          // local record to tombstone.
          if (existing?.syncedAt === null) {
            await purgeLocalNote(noteId);
          } else {
            await tombstoneLocalNote(noteId, now);
          }
        })();
        if (syncEnabled) void retryFireAndForget(() => deleteNoteAction({ noteId }));
        notify(`DELETE: "${displayFilename(noteTitle)}" removed permanently  [OK]`);
      } else {
        updateNote(noteId, { archived: true });
        void (async () => {
          const existing = await getLocalNote(noteId);
          if (existing) await setLocalNote({ ...existing, archived: true, editedAt: now });
        })();
        if (syncEnabled) void retryFireAndForget(() => setNoteFlagsAction({ noteId, archived: true }));

        // Archiving is the reversible branch (the note and its content are
        // untouched, just flagged) -- unlike purge, worth a real Undo, not
        // just a status line. Flips the flag back and reopens the buffer,
        // mirroring exactly what archiving itself just did in reverse.
        const undoArchive = () => {
          updateNote(noteId, { archived: false });
          void (async () => {
            const existing = await getLocalNote(noteId);
            if (existing) {
              await setLocalNote({ ...existing, archived: false, editedAt: new Date().toISOString() });
            }
          })();
          if (syncEnabled) void retryFireAndForget(() => setNoteFlagsAction({ noteId, archived: false }));
          openNote(noteId);
        };
        notify(`ARCHIVE: "${displayFilename(noteTitle)}" archived`, "info", undoArchive);
      }
      // goHome resolves the most-recently-updated *other* note (it now
      // reads the cache live -- WorkspaceProvider.tsx's goHome -- so it
      // can no longer resolve back to the note just removed/archived and
      // produce "E484: no such buffer" the way it used to).
      goHome();
    },
    [noteId, noteTitle, getContent, removeNote, updateNote, goHome, openNote, notify, cancelAutosave],
  );

  return useMemo(
    () => ({ create: createAndOpenNote, rename, delete: deleteNote }),
    [createAndOpenNote, rename, deleteNote],
  );
}
