"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotesQuery } from "@/lib/notes-query";
import { EmptyBuffer } from "@/components/buffer/EmptyBuffer";

/**
 * Landing on the bare /notes (no id) picks the most-recently-updated,
 * non-archived note and jumps there -- same convenience the old
 * server-side getMostRecentNoteId gave, just computed from the
 * already-loaded notes-query cache instead of a DB query, since that
 * data is already sitting in memory by the time this renders.
 */
export function NotesIndexRedirect() {
  const { data: notes } = useNotesQuery();
  const router = useRouter();

  const mostRecent = notes
    ?.filter((n) => !n.archived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  useEffect(() => {
    if (mostRecent) router.replace(`/notes/${mostRecent.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostRecent?.id]);

  if (mostRecent) return null;
  if (!notes) return null; // still loading (rare -- only on a cache miss)
  return <EmptyBuffer />;
}
