import type { NoteRecord } from "@/lib/note-types";
import type { SearchHit } from "@/lib/notes";
import { matchedLine } from "@/lib/text-search";

export type SearchResult = { noteId: string; title: string; snippet: string | null };

/**
 * The warm-cache branch of hybrid global search: filters the already-loaded
 * notes-query cache in memory. Only ever called once every note is warm
 * (see useGlobalSearch's resolution order) -- callable on a partially-warm
 * cache too (used directly in tests), but the app itself never does that.
 */
export function searchWarmCache(notes: NoteRecord[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return notes
    .filter(
      (n) =>
        !n.archived &&
        (n.title.toLowerCase().includes(q) || (n.content ?? "").toLowerCase().includes(q)),
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 30)
    .map((n) => ({ noteId: n.id, title: n.title, snippet: matchedLine(n.content ?? "", q) || null }));
}

/** Maps the server fallback's shape onto the same SearchResult the warm-cache branch produces, so the result list/click handler don't care which branch ran. */
export function fromServerHits(hits: SearchHit[]): SearchResult[] {
  return hits.map((hit) => ({ noteId: hit.noteId, title: hit.title, snippet: hit.line || null }));
}
