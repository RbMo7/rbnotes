/**
 * Isomorphic (no "use client"/"server-only") -- shared by both branches of
 * hybrid global search: the server-side scan (lib/notes.ts's
 * searchNoteContents) and the client-side warm-cache scan
 * (components/overlay/global-search.ts's searchWarmCache) need the exact
 * same "one representative line" snippet, regardless of which one ran.
 */
export function matchedLine(content: string, query: string): string {
  const q = query.toLowerCase();
  const line = content.split("\n").find((l) => l.toLowerCase().includes(q));
  return (line ?? "").trim().slice(0, 120);
}
