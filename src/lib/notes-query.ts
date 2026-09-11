"use client";

import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getAllNotesMetaAction,
  getAllNoteContentsAction,
  saveNoteContentAction,
} from "@/server/actions/notes";
import { notesQueryKey, type NoteRecord } from "@/lib/note-types";
import { useWorkspaceStore } from "@/lib/store";
import { listNotes, setNote as setLocalNote, markSynced as markLocalSynced } from "@/lib/local-notes-store";

export type { NoteRecord };

/**
 * The single client-side cache the whole app reads from: every note's
 * metadata, fetched once (hydrated server-side on first load, see
 * (app)/layout.tsx), with `content` filled in for every note in one batch
 * right after (see warmAllNotes below) -- kept in sync purely through our
 * own mutations writing straight into this cache, never by refetching. Note
 * switching, tags, and search all read this same array; a note's `content`
 * key being present or absent is the one source of truth for warm vs. cold.
 *
 * NoteRecord's dates are ISO strings, not Date objects, deliberately --
 * TanStack Query's dehydrate/hydrate boundary (server -> client) round-trips
 * through JSON, which silently turns a Date into a string anyway, so
 * storing it as a string from the start avoids a class of "works on the
 * client, wrong after a server-rendered reload" bugs. Callers that need a
 * real Date (grouping, timestamp formatting) convert at the point of use.
 */

/**
 * `enabled: syncEnabled` (CONTEXT.md's Synced vs. Local-only, seeded by
 * SettingsHydrator) is load-bearing, not an optimization: every action in
 * server/actions/notes.ts calls getAuthedUser(), which redirects to
 * /login when there's no session. A Local-only (anonymous) session must
 * never let this queryFn run at all -- see useLocalNotesQuery below for
 * how such a session's notes reach this same cache instead.
 */
export function useNotesQuery() {
  const syncEnabled = useWorkspaceStore((s) => s.syncEnabled);
  return useQuery<NoteRecord[]>({
    queryKey: notesQueryKey,
    queryFn: getAllNotesMetaAction,
    enabled: syncEnabled,
  });
}

/**
 * The Local-only counterpart to the server prefetch in (app)/layout.tsx:
 * seeds the shared notes cache from the Local store instead, once, for an
 * anonymous session. Mounted once (WorkspaceProvider), not per-consumer --
 * every useNotesQuery() call site reads the same cache key. A no-op
 * whenever `enabled` is false (Synced sessions get their data from the
 * server prefetch instead).
 */
export function useLocalNotesQuery(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const local = await listNotes();
      if (cancelled) return;
      queryClient.setQueryData<NoteRecord[]>(
        notesQueryKey,
        local.map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          pinned: n.pinned,
          archived: n.archived,
          createdAt: n.createdAt,
          updatedAt: n.editedAt,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, queryClient]);
}

/**
 * The other direction from useLocalNotesQuery: on sign-in, any Local-only
 * note never pushed to the server (syncedAt === null in the Local store --
 * i.e. created or last edited before this browser had an account) gets
 * pushed now, adopting it into the Synced set under the same client-
 * generated id it's always had. Spec story #15: "signing in starts syncing
 * my existing local notes, so upgrading doesn't feel like starting over."
 * Naturally idempotent -- once pushed, syncedAt is set, so a later mount
 * (e.g. reloading while still signed in) finds nothing left to migrate.
 */
export function useMigrateLocalNotes(email: string | null) {
  const { addNote } = useNotesMutations();
  useEffect(() => {
    if (!email) return;
    void (async () => {
      const local = await listNotes();
      for (const n of local.filter((note) => note.syncedAt === null)) {
        try {
          const result = await saveNoteContentAction({ noteId: n.id, content: n.content });
          await markLocalSynced(n.id, result.updatedAt);
          addNote({
            id: n.id,
            title: result.title,
            content: n.content,
            pinned: n.pinned,
            archived: n.archived,
            createdAt: n.createdAt,
            updatedAt: result.updatedAt,
          });
        } catch {
          // Best-effort -- stays unsynced, retried on the next sign-in mount.
        }
      }
    })();
  }, [email, addNote]);
}

/** True once every note in the cache has its content warmed -- the boundary hybrid search resolves on. */
export function isFullyWarm(notes: NoteRecord[]): boolean {
  return notes.every((n) => n.content !== undefined);
}

/**
 * The whole-cache content fetch: fired once, right after first paint (see
 * WorkspaceProvider), to warm every note's content in a single request. A
 * given note is skipped if it's already warm (e.g. just created client-side
 * via useCreateNote), dirty (`isDirty` lets a buffer with unsaved local
 * edits opt out -- warming would have nothing useful to add and only risks
 * a race with what the user is mid-typing), or has moved since the batch
 * started (stale-never-clobbers: a save, or a concurrent warm, changes
 * `updatedAt`, and a fetch that's now behind that change is discarded
 * rather than overwriting something fresher).
 */
export async function warmAllNotes(
  queryClient: QueryClient,
  isDirty?: (noteId: string) => boolean,
): Promise<void> {
  const before = queryClient.getQueryData<NoteRecord[]>(notesQueryKey) ?? [];
  const updatedAtBefore = new Map(before.map((n) => [n.id, n.updatedAt]));

  let results: { id: string; content: string }[];
  try {
    results = await getAllNoteContentsAction();
  } catch {
    return;
  }
  const contentById = new Map(results.map((r) => [r.id, r.content]));

  const newlyWarmed: NoteRecord[] = [];
  queryClient.setQueryData<NoteRecord[]>(notesQueryKey, (old) =>
    old?.map((n) => {
      if (n.content !== undefined) return n;
      if (isDirty?.(n.id)) return n;
      if (updatedAtBefore.get(n.id) !== n.updatedAt) return n;
      const content = contentById.get(n.id);
      if (content === undefined) return n;
      const warmed = { ...n, content };
      newlyWarmed.push(warmed);
      return warmed;
    }),
  );

  // Mirror into the Local store too -- Seam 1 is the universal storage
  // layer for every session, Synced included (ADR 0002), not just a
  // Local-only concern. Without this, a Synced note you never edited this
  // session (just fetched from the server) never reaches IndexedDB, and
  // would disappear the moment you signed out, even though nothing was
  // actually lost server-side. syncedAt = updatedAt because this content
  // just came from the server -- it's synced by definition.
  for (const n of newlyWarmed) {
    void setLocalNote({
      id: n.id,
      title: n.title,
      content: n.content ?? "",
      pinned: n.pinned,
      archived: n.archived,
      createdAt: n.createdAt,
      editedAt: n.updatedAt,
      syncedAt: n.updatedAt,
      deleted: false,
    });
  }
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
 *
 * Also written straight into the Local store (Seam 1) at creation, not
 * just on first edit: without this, a brand-new note exists only in the
 * TanStack cache until the user types something, and useLocalNotesQuery's
 * mount-time read (which unconditionally reseeds the cache from the Local
 * store for a Local-only session) would race it and wipe it straight back
 * out of the cache. A note has to exist in the Local store from birth for
 * the same reason a client-generated id does.
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
    void setLocalNote({
      id: note.id,
      title: note.title,
      content: note.content ?? "",
      pinned: note.pinned,
      archived: note.archived,
      createdAt: note.createdAt,
      editedAt: now,
      syncedAt: null,
      deleted: false,
    });
    return note.id;
  }, [addNote]);
}
