/**
 * Isomorphic (no "use client"/"server-only") -- imported from both the
 * server-side data layer (lib/notes.ts) and the client-side query cache
 * (lib/notes-query.ts), so it can't accidentally pull either module's
 * runtime boundary into the other.
 *
 * notesQueryKey lives here rather than in notes-query.ts specifically
 * because (app)/layout.tsx (a Server Component) needs its real runtime
 * value to call queryClient.prefetchQuery -- importing it from a "use
 * client" module instead would hand the server an opaque client
 * reference, not the actual array (React Server Components convert every
 * export of a client module into such a reference when a server module
 * imports it, even a plain constant). That reference fails
 * `Array.isArray()`, which is exactly the "queryKey needs to be an Array"
 * error this avoids.
 */
export const notesQueryKey = ["notes"] as const;

/**
 * One record per note in the single client-side cache the whole app reads
 * from. `content` is deliberately optional rather than defaulting to `""`:
 * absent means "not fetched into this client yet" (cold), a string
 * (including `""`) means the real content is here (warm). Collapsing that
 * distinction to an empty string would make a cold buffer indistinguishable
 * from a genuinely empty note, and a save could silently overwrite real
 * content with emptiness -- the data-loss guard is encoded in the
 * representation itself, not in a separate "isLoading" flag callers could
 * forget to check.
 */
export type NoteRecord = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  content?: string;
};

/** The metadata-only shape the first-paint fetch returns -- never carries content. */
export type NoteMeta = Omit<NoteRecord, "content">;
