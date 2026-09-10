import "server-only";
import { db } from "@/lib/db";

// Matches a leading `#word` the way the Stitch INSERT screen highlights
// frontmatter tags (`#distributed-systems`, `#queue-arch`, `#benchmarks`):
// a hash followed by word characters or hyphens, not preceded by another
// word character (so heading markers `# Title` / `## Title` are excluded —
// those always have a space after the hashes, this never does).
const TAG_PATTERN = /(?<![\w#])#([a-zA-Z0-9][\w-]*)/g;

export function extractTags(content: string): string[] {
  const matches = content.matchAll(TAG_PATTERN);
  const tags = new Set<string>();
  for (const m of matches) tags.add(m[1].toLowerCase());
  return [...tags];
}

export type TagSummary = { tag: string; count: number; noteIds: string[] };

export async function listTagsForUser(userId: string): Promise<TagSummary[]> {
  const notes = await db.note.findMany({
    where: { userId, deletedAt: null, archived: false },
    select: { id: true, content: true },
  });

  const byTag = new Map<string, TagSummary>();
  for (const note of notes) {
    for (const tag of extractTags(note.content)) {
      const entry = byTag.get(tag) ?? { tag, count: 0, noteIds: [] };
      entry.count += 1;
      entry.noteIds.push(note.id);
      byTag.set(tag, entry);
    }
  }

  return [...byTag.values()].sort((a, b) => b.count - a.count);
}

export async function listNotesByTag(userId: string, tag: string) {
  const notes = await db.note.findMany({
    where: { userId, deletedAt: null, archived: false },
    select: { id: true, title: true, content: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const normalized = tag.toLowerCase();
  return notes.filter((n) => extractTags(n.content).includes(normalized));
}
