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

export type FullNote = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};
