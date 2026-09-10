"use server";

import { getAuthedUser } from "@/lib/auth";
import * as notes from "@/lib/notes";
import { createNoteSchema, noteIdSchema, setNoteFlagSchema, updateNoteContentSchema } from "@/lib/schemas";

// Every action here re-derives the user from the session via
// getAuthedUser() and never trusts a userId passed in from the client.
// Zod schemas for these actions deliberately have no userId field.

/**
 * The one real fetch behind the whole app: every note, full content
 * included. Used both to prefetch/hydrate the query cache server-side on
 * first load ((app)/layout.tsx calls listAllNotesFull directly for that)
 * and as the client-side queryFn for lib/notes-query.ts's useNotesQuery --
 * e.g. if the cache is ever explicitly invalidated. In steady state this
 * doesn't run again: every mutation below writes its result straight into
 * the cache instead.
 */
export async function getAllNotesAction() {
  const user = await getAuthedUser();
  return notes.listAllNotesFull(user.id);
}

export async function createNoteAction(input: unknown) {
  const user = await getAuthedUser();
  const { title } = createNoteSchema.parse(input);
  // Returns the full note (not just an id) so the caller can insert it
  // straight into the notes-query cache without a refetch.
  return notes.createNote(user.id, title);
}

export async function saveNoteContentAction(input: unknown) {
  const user = await getAuthedUser();
  const { noteId, content, clientRevision } = updateNoteContentSchema.parse(input);
  const note = await notes.updateNoteContent(user.id, noteId, content);
  return {
    updatedAt: note.updatedAt.toISOString(),
    clientRevision,
    title: note.title,
  };
}

export async function setNoteFlagsAction(input: unknown) {
  const user = await getAuthedUser();
  const { noteId, pinned, archived } = setNoteFlagSchema.parse(input);
  await notes.setNoteFlags(user.id, noteId, { pinned, archived });
}

export async function deleteNoteAction(input: unknown) {
  const user = await getAuthedUser();
  const { noteId } = noteIdSchema.parse(input);
  await notes.softDeleteNote(user.id, noteId);
}
