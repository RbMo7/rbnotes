import "server-only";
import { db } from "@/lib/db";
import type { Note } from "@prisma/client";
import { deriveTitleFromContent } from "@/lib/markdown-title";

/**
 * All note access lives here, and every function takes an already-verified
 * `userId` (from `getAuthedUser()`, never from client input) and scopes its
 * query to it. This is the single choke point tenant isolation depends on —
 * no other module is allowed to query the Note table directly.
 */

export async function listNotesForSidebar(userId: string) {
  return db.note.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      updatedAt: true,
      pinned: true,
      archived: true,
    },
  });
}

export async function getNote(userId: string, noteId: string): Promise<Note | null> {
  return db.note.findFirst({
    where: { id: noteId, userId, deletedAt: null },
  });
}

/** Stable ordinal for the "buffer #N" chip -- position among the user's notes by creation order. */
export async function getBufferNumber(userId: string, note: Pick<Note, "createdAt">) {
  return db.note.count({
    where: { userId, deletedAt: null, createdAt: { lte: note.createdAt } },
  });
}

export async function getMostRecentNoteId(userId: string) {
  const note = await db.note.findFirst({
    where: { userId, deletedAt: null, archived: false },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return note?.id ?? null;
}

export async function createNote(userId: string, title?: string) {
  return db.note.create({
    data: { userId, title: title?.trim() || "untitled", content: "" },
  });
}

/**
 * A note's title is always its own first `# heading` (see
 * lib/markdown-title.ts) -- there's no separate title field to fall out of
 * sync, so every content write re-derives it. `:rename` doesn't call a
 * different code path; it edits the heading line client-side and this same
 * function persists the result.
 */
export async function updateNoteContent(
  userId: string,
  noteId: string,
  content: string,
) {
  const result = await db.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: { content, title: deriveTitleFromContent(content) },
  });
  if (result.count === 0) throw new Error("Note not found");
  return db.note.findFirstOrThrow({ where: { id: noteId, userId } });
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

export async function searchNotes(userId: string, query: string) {
  const q = query.trim();
  if (!q) return [];
  return db.note.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, content: true, updatedAt: true },
  });
}
