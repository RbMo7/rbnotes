import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Sharing is the one read path in the app not keyed on note ownership, so it
 * is kept deliberately narrow: resolve strictly by unrevoked token, require
 * a signed-in viewer (enforced by middleware before this ever runs), and
 * return a read-only projection. Nothing here ever accepts a client-supplied
 * userId, and no write path (notes.ts) ever consults this table.
 */

function generateToken() {
  return randomBytes(16).toString("base64url"); // 22 chars
}

export async function getShareForNote(userId: string, noteId: string) {
  return db.noteShare.findFirst({
    where: { noteId, note: { userId }, revokedAt: null },
  });
}

export async function createOrGetShare(userId: string, noteId: string) {
  const note = await db.note.findFirst({ where: { id: noteId, userId } });
  if (!note) throw new Error("Note not found");

  const existing = await db.noteShare.findUnique({ where: { noteId } });
  if (existing && !existing.revokedAt) return existing;

  return db.noteShare.upsert({
    where: { noteId },
    update: { token: generateToken(), revokedAt: null, createdBy: userId },
    create: { noteId, token: generateToken(), createdBy: userId },
  });
}

export async function revokeShare(userId: string, noteId: string) {
  const note = await db.note.findFirst({ where: { id: noteId, userId } });
  if (!note) throw new Error("Note not found");

  await db.noteShare.updateMany({
    where: { noteId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Resolves a public token to a read-only note projection, or null. */
export async function resolveShareToken(token: string) {
  return db.noteShare.findFirst({
    where: { token, revokedAt: null, note: { deletedAt: null } },
    include: {
      note: {
        select: {
          id: true,
          title: true,
          content: true,
          updatedAt: true,
          userId: true,
          user: { select: { email: true } },
        },
      },
    },
  });
}

/** Records a view, unless the viewer is the note's own owner. */
export async function recordShareView(shareId: string, ownerId: string, viewerId: string) {
  if (ownerId === viewerId) return;

  await db.noteShareView.upsert({
    where: { shareId_viewerId: { shareId, viewerId } },
    update: { viewCount: { increment: 1 } },
    create: { shareId, viewerId },
  });
}

export async function listShareViewers(shareId: string) {
  return db.noteShareView.findMany({
    where: { shareId },
    orderBy: { lastViewedAt: "desc" },
    include: { viewer: { select: { email: true } } },
  });
}
