import type { FullNote } from "@/lib/note-types";

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

/**
 * Pure and isomorphic -- no DB query. The TAGS page runs this over the
 * already-loaded notes-query cache (lib/notes-query.ts) client-side, so
 * opening it never fetches anything; it's the same data the sidebar and
 * editor already have in memory.
 */
export function computeTagSummaries(notes: Pick<FullNote, "id" | "content" | "archived">[]): TagSummary[] {
  const byTag = new Map<string, TagSummary>();
  for (const note of notes) {
    if (note.archived) continue;
    for (const tag of extractTags(note.content)) {
      const entry = byTag.get(tag) ?? { tag, count: 0, noteIds: [] };
      entry.count += 1;
      entry.noteIds.push(note.id);
      byTag.set(tag, entry);
    }
  }
  return [...byTag.values()].sort((a, b) => b.count - a.count);
}

export function filterNotesByTag<T extends Pick<FullNote, "content" | "archived">>(
  notes: T[],
  tag: string,
): T[] {
  const normalized = tag.toLowerCase();
  return notes.filter((n) => !n.archived && extractTags(n.content).includes(normalized));
}
