/**
 * Isomorphic (no "use client"/"server-only") -- imported from both the
 * server-side data layer (lib/notes.ts) and the client-side query cache
 * (lib/notes-query.ts), so it can't accidentally pull either module's
 * runtime boundary into the other just for a type.
 */
export type FullNote = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};
