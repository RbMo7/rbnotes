"use server";

import { revalidatePath } from "next/cache";
import { getAuthedUser } from "@/lib/auth";
import * as notes from "@/lib/notes";
import { listNotesByTag } from "@/lib/tags";
import {
  createNoteSchema,
  noteIdSchema,
  setNoteFlagSchema,
  updateNoteContentSchema,
} from "@/lib/schemas";

// Every action here re-derives the user from the session via
// getAuthedUser() and never trusts a userId passed in from the client.
// Zod schemas for these actions deliberately have no userId field.

export async function createNoteAction(input: unknown) {
  const user = await getAuthedUser();
  const { title } = createNoteSchema.parse(input);
  const note = await notes.createNote(user.id, title);
  revalidatePath("/notes");
  return { id: note.id };
}

export async function saveNoteContentAction(input: unknown) {
  const user = await getAuthedUser();
  const { noteId, content, clientRevision } = updateNoteContentSchema.parse(input);
  const note = await notes.updateNoteContent(user.id, noteId, content);
  // Deliberately no revalidatePath here: the editor already updates its own
  // title/dirty state client-side on a successful write (BufferWorkspace),
  // and invalidating /notes on every `:w` was forcing the whole sidebar
  // (and this page's own server-rendered props) to refetch and re-render
  // on every save -- the exact friction that was reported live. The
  // sidebar's ordering/timestamp just lags until the next natural
  // navigation, which is the normal, expected trade-off for this.
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
  revalidatePath("/notes");
}

export async function deleteNoteAction(input: unknown) {
  const user = await getAuthedUser();
  const { noteId } = noteIdSchema.parse(input);
  await notes.softDeleteNote(user.id, noteId);
  revalidatePath("/notes");
}

export async function searchNotesAction(query: string) {
  const user = await getAuthedUser();
  return notes.searchNotes(user.id, query);
}

export async function listNotesByTagAction(tag: string) {
  const user = await getAuthedUser();
  return listNotesByTag(user.id, tag);
}
