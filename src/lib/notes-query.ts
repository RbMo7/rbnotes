"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getAllNotesMetaAction, getNoteContentAction } from "@/server/actions/notes";
import { notesQueryKey, type NoteRecord } from "@/lib/note-types";

export type { NoteRecord };

/**
 * The single client-side cache the whole app reads from: every note's
 * metadata, fetched once (hydrated server-side on first load, see
 * (app)/layout.tsx), with `content` filled in per note as it warms (see
 * warmNoteContent below) -- kept in sync purely through our own mutations
 * writing straight into this cache, never by refetching. Note switching,
 * tags, graph, and search all read this same array; a note's `content` key
 * being present or absent is the one source of truth for warm vs. cold.
 *
 * NoteRecord's dates are ISO strings, not Date objects, deliberately --
 * TanStack Query's dehydrate/hydrate boundary (server -> client) round-trips
 * through JSON, which silently turns a Date into a string anyway, so
 * storing it as a string from the start avoids a class of "works on the
 * client, wrong after a server-rendered reload" bugs. Callers that need a
 * real Date (grouping, timestamp formatting) convert at the point of use.
 */

export function useNotesQuery() {
  return useQuery<NoteRecord[]>({
    queryKey: notesQueryKey,
    queryFn: getAllNotesMetaAction,
  });
}

/** Convenience for reading the cache outside a hook's own re-render (e.g. imperative lookups in event handlers). */
export function getNoteFromCache(queryClient: QueryClient, id: string): NoteRecord | undefined {
  return queryClient.getQueryData<NoteRecord[]>(notesQueryKey)?.find((n) => n.id === id);
}

/** True once every note in the cache has its content warmed -- the boundary hybrid search resolves on. */
export function isFullyWarm(notes: NoteRecord[]): boolean {
  return notes.every((n) => n.content !== undefined);
}

/**
 * The per-note content fetch: cold-open (jumping the queue) and the
 * background warm-up loop are its only two callers. A no-op if the note is
 * already warm, unknown, or dirty (`isDirty` lets a buffer with unsaved
 * local edits opt out -- warming would have nothing useful to add and only
 * risks a race with what the user is mid-typing).
 *
 * Stale-never-clobbers: the fetch's result is only written if, by the time
 * it resolves, the note is *still* cold and hasn't been touched (its
 * `updatedAt` hasn't moved -- a save, or a concurrent warm of the same
 * note, would have changed it). This is deliberately a freshness check
 * against the cache at write-time, not a cancellation token -- a
 * superseded fetch is left to resolve and simply gets discarded.
 */
export async function warmNoteContent(
  queryClient: QueryClient,
  noteId: string,
  isDirty?: (noteId: string) => boolean,
): Promise<void> {
  const before = getNoteFromCache(queryClient, noteId);
  if (!before || before.content !== undefined) return;
  if (isDirty?.(noteId)) return;

  let content: string;
  try {
    ({ content } = await getNoteContentAction({ noteId }));
  } catch {
    return;
  }

  const current = getNoteFromCache(queryClient, noteId);
  if (!current || current.content !== undefined) return;
  if (current.updatedAt !== before.updatedAt) return;

  queryClient.setQueryData<NoteRecord[]>(notesQueryKey, (old) =>
    old?.map((n) => (n.id === noteId ? { ...n, content } : n)),
  );
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
    (note: NoteRecord) => {
      queryClient.setQueryData<NoteRecord[]>(notesQueryKey, (old) =>
        old ? [note, ...old] : [note],
      );
    },
    [queryClient],
  );

  const updateNote = useCallback(
    (id: string, patch: Partial<NoteRecord>) => {
      queryClient.setQueryData<NoteRecord[]>(notesQueryKey, (old) =>
        old?.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      );
    },
    [queryClient],
  );

  const removeNote = useCallback(
    (id: string) => {
      queryClient.setQueryData<NoteRecord[]>(notesQueryKey, (old) =>
        old?.filter((n) => n.id !== id),
      );
    },
    [queryClient],
  );

  return { addNote, updateNote, removeNote };
}

/**
 * `:new` never round-trips to the server before showing you anything --
 * that round trip (session check + Prisma insert) was the entire 3-5s delay
 * users felt. Instead this generates the note's real, permanent id
 * client-side, writes a complete blank (and already warm -- content is set
 * explicitly, not left absent) note straight into the cache. The row
 * genuinely does not exist server-side yet; it's created on the first save
 * via an upsert (see lib/notes.ts's upsertNoteContent), exactly like an
 * unnamed buffer in real Vim never touches disk until saved.
 */
export function useCreateNote() {
  const { addNote } = useNotesMutations();

  return useCallback(() => {
    const now = new Date().toISOString();
    const note: NoteRecord = {
      id: crypto.randomUUID(),
      title: "untitled",
      content: "",
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    addNote(note);
    return note.id;
  }, [addNote]);
}
