import "server-only";
import { db } from "@/lib/db";
import { deriveTitleFromContent } from "@/lib/markdown-title";
import type { FullNote } from "@/lib/note-types";

/**
 * All note access lives here, and every function takes an already-verified
 * `userId` (from `getAuthedUser()`, never from client input) and scopes its
 * query to it. This is the single choke point tenant isolation depends on —
 * no other module is allowed to query the Note table directly.
 */

/**
 * The one query the whole app is built on: every one of the user's notes,
 * full content included. Fetched once (prefetched server-side in
 * (app)/layout.tsx, hydrated into the client's TanStack Query cache) and
 * never fetched again per-click -- the sidebar, the editor, tags, graph,
 * and search all read this same array from lib/notes-query.ts. Dates come
 * back as ISO strings, not Date objects: notes added later via a server
 * action (e.g. after :new) go through the same shape, so nothing in the
 * cache ever silently differs by how it got there.
 */
export async function listAllNotesFull(userId: string): Promise<FullNote[]> {
  const notes = await db.note.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return notes.map(toFullNote);
}

function toFullNote(note: {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}): FullNote {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    pinned: note.pinned,
    archived: note.archived,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

/**
 * A note's title is always its own first `# heading` (see
 * lib/markdown-title.ts) -- there's no separate title field to fall out of
 * sync, so every content write re-derives it. `:rename` doesn't call a
 * different code path; it edits the heading line client-side and this same
 * function persists the result.
 *
 * `:new` never calls the server at all (see lib/notes-query.ts's
 * useCreateNote) -- a brand-new note only exists in the client cache until
 * its first explicit `:w`, exactly like an unnamed buffer in real Vim never
 * touches disk until saved. So this is an upsert, not a plain update: the
 * first save of such a note has nothing to update yet and genuinely creates
 * the row, using the id the client already generated (and already
 * navigated to and rendered) rather than minting a new one here.
 */
export async function upsertNoteContent(
  userId: string,
  noteId: string,
  content: string,
): Promise<FullNote> {
  const title = deriveTitleFromContent(content);
  const result = await db.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: { content, title },
  });
  if (result.count > 0) {
    return toFullNote(await db.note.findFirstOrThrow({ where: { id: noteId, userId } }));
  }
  // Nothing existed to update -- this is the first save of a client-created
  // note. If `noteId` happened to collide with another user's row
  // (practically impossible for a random UUID), the `id` primary key's
  // unique constraint rejects this outright instead of silently adopting
  // someone else's note.
  const note = await db.note.create({ data: { id: noteId, userId, title, content } });
  return toFullNote(note);
}

export async function setNoteFlags(
  userId: string,
  noteId: string,
  flags: { pinned?: boolean; archived?: boolean },
) {
  const result = await db.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: flags,
  });
  if (result.count === 0) throw new Error("Note not found");
}

/** Soft delete (archive-then-delete semantics for `:delete`). */
export async function softDeleteNote(userId: string, noteId: string) {
  const result = await db.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw new Error("Note not found");
}
