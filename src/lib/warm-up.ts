import type { NoteRecord } from "@/lib/note-types";

/**
 * Picks the next note to warm: the most-recently-updated note that's still
 * cold. Pure and re-derived fresh each tick (see runWarmUpLoop) rather than
 * computed once up front, so a note created or warmed by something else
 * mid-loop is naturally reflected without any extra bookkeeping.
 */
export function nextToWarm(notes: NoteRecord[]): NoteRecord | null {
  const cold = notes.filter((n) => n.content === undefined);
  if (cold.length === 0) return null;
  return cold.reduce((latest, n) =>
    new Date(n.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? n : latest,
  );
}

/**
 * The background warm-up loop itself: strictly serial (each fetch is
 * awaited before the next starts) with a small stagger between them, most-
 * recently-updated first. Runs until nothing cold is left or `signal` aborts
 * (component unmount). `warmOne` owns the actual fetch-and-write plus the
 * skip-dirty and stale-never-clobbers guarantees (see
 * lib/notes-query.ts's warmNoteContent) -- this loop only owns ordering and
 * cadence, which is what keeps it testable with a fake `warmOne`/`delay` and
 * no real timers or network.
 */
export async function runWarmUpLoop(options: {
  getNotes: () => NoteRecord[];
  warmOne: (noteId: string) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  staggerMs: number;
  signal: AbortSignal;
}): Promise<void> {
  const { getNotes, warmOne, delay, staggerMs, signal } = options;
  while (!signal.aborted) {
    const next = nextToWarm(getNotes());
    if (!next) return;
    await warmOne(next.id);
    if (signal.aborted) return;
    await delay(staggerMs);
  }
}
