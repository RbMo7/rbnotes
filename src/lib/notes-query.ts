"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getAllNotesAction } from "@/server/actions/notes";
import type { FullNote } from "@/lib/note-types";

export type { FullNote };

/**
 * The single client-side cache the whole app reads from: every note's full
 * content, fetched once (hydrated server-side on first load, see
 * (app)/layout.tsx) and kept in sync purely through our own mutations
 * writing straight into this cache -- never by refetching. Note switching,
 * tags, graph, and search all read this same array, which is what makes
 * every one of them instant: there is nothing left to fetch on click.
 *
 * FullNote's dates are ISO strings, not Date objects, deliberately --
 * TanStack Query's dehydrate/hydrate boundary (server -> client) round-trips
 * through JSON, which silently turns a Date into a string anyway, so
 * storing it as a string from the start avoids a class of "works on the
 * client, wrong after a server-rendered reload" bugs. Callers that need a
 * real Date (grouping, timestamp formatting) convert at the point of use.
 */
export const notesQueryKey = ["notes"] as const;

export function useNotesQuery() {
  return useQuery({
    queryKey: notesQueryKey,
    queryFn: getAllNotesAction,
  });
}

/** Convenience for reading the cache outside a hook's own re-render (e.g. imperative lookups in event handlers). */
export function getNoteFromCache(queryClient: QueryClient, id: string): FullNote | undefined {
  return queryClient.getQueryData<FullNote[]>(notesQueryKey)?.find((n) => n.id === id);
}

/**
 * Each returned function has a stable identity across renders (wrapped in
 * useCallback over the stable queryClient) -- callers that need to depend
 * on these in an effect's dependency array (AppShell's global keydown
 * handler, for one) don't get an effect that tears down and re-subscribes
 * on every render as a result.
 */
export function useNotesMutations() {
  const queryClient = useQueryClient();

  const addNote = useCallback(
    (note: FullNote) => {
      queryClient.setQueryData<FullNote[]>(notesQueryKey, (old) =>
        old ? [note, ...old] : [note],
      );
    },
    [queryClient],
  );

  const updateNote = useCallback(
    (id: string, patch: Partial<FullNote>) => {
      queryClient.setQueryData<FullNote[]>(notesQueryKey, (old) =>
        old?.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      );
    },
    [queryClient],
  );

  const removeNote = useCallback(
    (id: string) => {
      queryClient.setQueryData<FullNote[]>(notesQueryKey, (old) =>
        old?.filter((n) => n.id !== id),
      );
    },
    [queryClient],
  );

  return { addNote, updateNote, removeNote };
}

/** Position among the user's notes by creation order, for the "buffer #N" chip -- computed client-side from the already-loaded list instead of a DB count query. */
export function computeBufferNumber(notes: FullNote[], noteId: string): number {
  const target = notes.find((n) => n.id === noteId);
  if (!target) return 1;
  const targetTime = new Date(target.createdAt).getTime();
  return notes.filter((n) => new Date(n.createdAt).getTime() <= targetTime).length;
}
