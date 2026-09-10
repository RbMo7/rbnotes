import { BufferWorkspace } from "@/components/buffer/BufferWorkspace";

/**
 * Deliberately does no data fetching of its own. Auth is already enforced
 * by (app)/layout.tsx (which runs before any nested page), and note
 * content lives entirely in the client-side notes-query cache that same
 * layout prefetched -- BufferWorkspace reads this note straight out of
 * that cache. A note id that doesn't exist, or belongs to someone else,
 * simply isn't in the cache (it was scoped to this user at the one fetch
 * that populated it) -- BufferWorkspace shows a "not found" state for
 * both cases identically, which is the same guarantee the old per-request
 * DB lookup made, just enforced by construction instead of a query.
 */
export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BufferWorkspace key={id} noteId={id} />;
}
