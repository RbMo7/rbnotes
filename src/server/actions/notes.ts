"use server";

import { getAuthedUser } from "@/lib/auth";
import * as notes from "@/lib/notes";
import {
  noteIdSchema,
  setNoteFlagSchema,
  searchNotesSchema,
  updateNoteContentSchema,
} from "@/lib/schemas";

// Every action here re-derives the user from the session via
// getAuthedUser() and never trusts a userId passed in from the client.
// Zod schemas for these actions deliberately have no userId field.

/**
 * First paint's one real fetch: every note, metadata only. Used both to
 * prefetch/hydrate the query cache server-side on first load
 * ((app)/layout.tsx calls listAllNotesMeta directly for that) and as the
 * client-side queryFn for lib/notes-query.ts's useNotesQuery -- e.g. if the
 * cache is ever explicitly invalidated.
 */
export async function getAllNotesMetaAction() {
  const user = await getAuthedUser();
  return notes.listAllNotesMeta(user.id);
}

/**
 * The batched content fetch: warmAllNotes (lib/notes-query.ts) is its only
 * caller, fired once right after first paint.
 */
export async function getAllNoteContentsAction() {
  const user = await getAuthedUser();
  return notes.getAllNoteContents(user.id);
}

export async function saveNoteContentAction(input: unknown) {
  const user = await getAuthedUser();
  const { noteId, content } = updateNoteContentSchema.parse(input);
  const note = await notes.upsertNoteContent(user.id, noteId, content);
  return {
    updatedAt: note.updatedAt,
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

/**
 * The server-side fallback branch of hybrid global search (issue: hybrid
 * global search) -- used only while the client's warm cache isn't complete
 * yet. See lib/notes.ts's searchNoteContents for the query itself.
 */
export async function searchNotesAction(input: unknown) {
  const user = await getAuthedUser();
  const { query } = searchNotesSchema.parse(input);
  return notes.searchNoteContents(user.id, query);
}
