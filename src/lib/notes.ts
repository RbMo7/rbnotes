import "server-only";
import { db } from "@/lib/db";
import { deriveTitleFromContent } from "@/lib/markdown-title";
import { matchedLine } from "@/lib/text-search";
import type { NoteMeta, NoteRecord } from "@/lib/note-types";

/**
 * All note access lives here, and every function takes an already-verified
 * `userId` (from `getAuthedUser()`, never from client input) and scopes its
 * query to it. This is the single choke point tenant isolation depends on —
 * no other module is allowed to query the Note table directly.
 */

/**
 * The one query first paint blocks on: every one of the user's notes,
 * metadata only -- no content column. Prefetched server-side in
 * (app)/layout.tsx and hydrated into the client's TanStack Query cache;
 * lib/notes-query.ts's useNotesQuery reads this same shape. Content is
 * fetched separately, per note, on demand or via the background warm-up
 * loop (see getNoteContent below) -- this is exactly what keeps first paint
 * from waiting on every note's full text.
 */
export async function listAllNotesMeta(userId: string): Promise<NoteMeta[]> {
  const notes = await db.note.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      pinned: true,
      archived: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return notes.map((note) => ({
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }));
}

/**
 * The per-note content fetch: one of the two new minimal contracts this
 * data layer grew for warmed buffers (the other is searchNoteContents
 * below). Returns `null` on a cache-miss-shaped failure (wrong user, wrong
 * id, deleted) rather than throwing, so a cold-open racing a delete/logout
 * fails quietly instead of surfacing a raw DB error to the warm-up loop.
 */
export async function getNoteContent(userId: string, noteId: string): Promise<string | null> {
  const note = await db.note.findFirst({
    where: { id: noteId, userId, deletedAt: null },
    select: { content: true },
  });
  return note?.content ?? null;
}

function toNoteRecord(note: {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}): NoteRecord {
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
 * its first explicit save (autosave or `:w`), exactly like an unnamed buffer
 * in real Vim never touches disk until saved. So this is an upsert, not a
 * plain update: the first save of such a note has nothing to update yet and
 * genuinely creates the row, using the id the client already generated (and
 * already rendered) rather than minting a new one here.
 */
export async function upsertNoteContent(
  userId: string,
  noteId: string,
  content: string,
): Promise<NoteRecord> {
  const title = deriveTitleFromContent(content);
  const result = await db.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: { content, title },
  });
  if (result.count > 0) {
    return toNoteRecord(await db.note.findFirstOrThrow({ where: { id: noteId, userId } }));
  }
  // Nothing existed to update -- this is the first save of a client-created
  // note. If `noteId` happened to collide with another user's row
  // (practically impossible for a random UUID), the `id` primary key's
  // unique constraint rejects this outright instead of silently adopting
  // someone else's note.
  const note = await db.note.create({ data: { id: noteId, userId, title, content } });
  return toNoteRecord(note);
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

export type SearchHit = { noteId: string; title: string; line: string };

/**
 * The server-side fallback for global search (Ctrl+/): a real DB scan
 * across every note's content, used only while the client's warm cache is
 * still filling in (see lib/notes-query.ts's search resolution order).
 * Returns note identity plus one representative match line -- enough for
 * SearchPalette to render a result and hand off the same {noteId, query}
 * pending-match the warm-cache path already uses. Deliberately uncapped
 * (no `take`): ranking/relevance is out of scope, but completeness is the
 * one thing this fallback exists for -- "results ... miss nothing" (issue:
 * hybrid global search) -- so silently truncating to the top N by recency
 * would be exactly the bug this function exists to avoid.
 */
export async function searchNoteContents(userId: string, query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const notes = await db.note.findMany({
    where: {
      userId,
      deletedAt: null,
      archived: false,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, content: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return notes.map((note) => ({
    noteId: note.id,
    title: note.title,
    line: matchedLine(note.content, q),
  }));
}
