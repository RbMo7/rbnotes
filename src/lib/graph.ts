import "server-only";
import { db } from "@/lib/db";
import { extractTags } from "@/lib/tags";

// [[Note Title]] wiki-links, resolved by case-insensitive title match.
const LINK_PATTERN = /\[\[([^\]]+)\]\]/g;

export type GraphNode = { id: string; title: string };
export type GraphEdge = { source: string; target: string; kind: "link" | "tag" };

export async function buildNoteGraph(userId: string) {
  const notes = await db.note.findMany({
    where: { userId, deletedAt: null, archived: false },
    select: { id: true, title: true, content: true },
  });

  const byTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n.id]));
  const nodes: GraphNode[] = notes.map((n) => ({ id: n.id, title: n.title }));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const addEdge = (source: string, target: string, kind: GraphEdge["kind"]) => {
    if (source === target) return;
    const key = [source, target].sort().join("|") + kind;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, kind });
  };

  for (const note of notes) {
    for (const match of note.content.matchAll(LINK_PATTERN)) {
      const targetId = byTitle.get(match[1].trim().toLowerCase());
      if (targetId) addEdge(note.id, targetId, "link");
    }
  }

  const byTag = new Map<string, string[]>();
  for (const note of notes) {
    for (const tag of extractTags(note.content)) {
      const list = byTag.get(tag) ?? [];
      list.push(note.id);
      byTag.set(tag, list);
    }
  }
  for (const ids of byTag.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        addEdge(ids[i], ids[j], "tag");
      }
    }
  }

  return { nodes, edges };
}
