"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getAllNotesMetaAction,
  getAllNoteContentsAction,
  saveNoteContentAction,
  setNoteFlagsAction,
} from "@/server/actions/notes";
import { notesQueryKey, type NoteRecord } from "@/lib/note-types";
import { useWorkspaceStore } from "@/lib/store";
import {
  listNotes,
  getNote as getLocalNote,
  setNote as setLocalNote,
  isMigratable,
} from "@/lib/local-notes-store";

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
    let retried = false;

    const seed = () => {
      void (async () => {
        try {
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
        } catch {
          // An anonymous session has no server fallback -- this is the
          // ONLY source of its notes (useNotesQuery is `enabled: false`
          // here). Left unguarded, a failed IndexedDB read (blocked,
          // private-browsing, quota) leaves the whole notes list stuck
          // empty for the rest of the session with nothing else to ever
          // seed it, same failure shape warmAllNotes had for content.
          // One retry, since this is almost always transient (IndexedDB
          // not ready yet on first paint).
          if (!cancelled && !retried) {
            retried = true;
            window.setTimeout(seed, 1000);
          }
        }
      })();
    };
    seed();

    return () => {
      cancelled = true;
    };
  }, [enabled, queryClient]);
}

/**
 * The other direction from useLocalNotesQuery: on sign-in, every local
 * note that's still unsynced AND eligible to adopt into this account
 * (isMigratable -- genuinely anonymous-origin, or this same account's own
 * previously-stranded unsynced note from an earlier sign-out on this
 * device; NEVER a different account's note, regardless of syncedAt) gets
 * pushed now, adopting it into the Synced set under the same client-
 * generated id it's always had. Both conditions matter: isMigratable
 * alone only answers "is this account allowed to," not "does it still
 * need to" -- an already-synced same-account note would otherwise get
 * needlessly re-pushed every time this effect re-runs. Spec story #15:
 * "signing in starts syncing my existing local notes, so upgrading
 * doesn't feel like starting over." Naturally idempotent -- once pushed,
 * syncedAt is set (and ownerId is this
 * account), so a later mount (e.g. reloading while still signed in)
 * finds nothing left to migrate.
 *
 * Also carries pinned/archived along via a follow-up setNoteFlagsAction --
 * saveNoteContentAction alone only ever sets content, so without this a
 * Local-only note that was pinned or archived would arrive in the account
 * with neither flag, quietly resetting the user's own organization.
 * createdAt is not carried (out of scope -- cosmetic only, see spec).
 *
 * Returns migration progress so the caller can show it -- this used to run
 * silently, which for anyone with more than a couple of local notes just
 * looked like nothing happened (or worse, like the notes were gone) for
 * however long the pushes took.
 */
export function useMigrateLocalNotes(
  email: string | null,
  currentUserId: string | null,
): { total: number; current: number } {
  const { addNote } = useNotesMutations();
  const [progress, setProgress] = useState({ total: 0, current: 0 });

  useEffect(() => {
    if (!email || !currentUserId) return;
    // Dev Strict Mode mounts every effect twice; without this guard, both
    // runs see the same not-yet-synced note (the first run's markLocalSynced
    // hasn't landed yet) and both push it, producing a duplicate cache entry
    // (and a duplicate React key).
    let cancelled = false;
    void (async () => {
      const local = await listNotes();
      // isMigratable alone only answers "is this account allowed to adopt
      // it" (ownership) -- an already-synced note owned by this same
      // account would pass that check every time this effect re-runs,
      // needlessly re-pushing it. syncedAt === null is what actually
      // means "still needs migrating."
      const migratable = local.filter(
        (note) => note.syncedAt === null && isMigratable(note, currentUserId),
      );
      if (migratable.length === 0) return;
      setProgress({ total: migratable.length, current: 0 });
      for (const n of migratable) {
        if (cancelled) return;
        try {
          const result = await saveNoteContentAction({ noteId: n.id, content: n.content });
          if (cancelled) return;
          if (n.pinned || n.archived) {
            await setNoteFlagsAction({ noteId: n.id, pinned: n.pinned, archived: n.archived });
          }
          // Not just markSynced(id, updatedAt) -- a note adopted from
          // ownerId: null must become owned by this account now. Leaving
          // it null would make isMigratable true again on a *different*
          // account's later sign-in on this device (it's already synced
          // to account A, but a stale null ownerId would let account B
          // "adopt" it too), and isPurgeable would never match it on this
          // account's own future sign-out (still reads as unowned).
          await setLocalNote({ ...n, ownerId: currentUserId, syncedAt: result.updatedAt });
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
        } finally {
          if (!cancelled) setProgress((p) => ({ ...p, current: p.current + 1 }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, currentUserId, addNote]);

  return progress;
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
  currentUserId: string | null,
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
    void (async () => {
      // Stale-overwrite guard: if the Local store already has this note
      // with genuine unpushed changes (editedAt newer than its own
      // syncedAt, or never synced at all), this server content is OLDER
      // than what's sitting locally -- e.g. a previous session's push
      // failed and never retried. Overwriting it here would silently
      // discard those local edits. Skip the mirror write for this note;
      // the local version stays authoritative until it actually syncs.
      const existing = await getLocalNote(n.id);
      if (existing && (existing.syncedAt === null || existing.editedAt > existing.syncedAt)) {
        return;
      }
      await setLocalNote({
        id: n.id,
        title: n.title,
        content: n.content ?? "",
        pinned: n.pinned,
        archived: n.archived,
        createdAt: n.createdAt,
        editedAt: n.updatedAt,
        syncedAt: n.updatedAt,
        deleted: false,
        ownerId: currentUserId,
      });
    })();
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

  // An upsert, not a blind prepend: a duplicate id (e.g. two overlapping
  // useMigrateLocalNotes runs under dev Strict Mode, or any other caller
  // racing itself) replaces the existing entry in place instead of adding
  // a second array entry with the same id -- which React's keyed rendering
  // can't represent anyway (see SidebarBufferList's duplicate-key error).
  const addNote = useCallback(
    (note: NoteRecord) => {
      queryClient.setQueryData<NoteRecord[]>(notesQueryKey, (old) => {
        if (!old) return [note];
        const index = old.findIndex((n) => n.id === note.id);
        if (index === -1) return [note, ...old];
        const next = [...old];
        next[index] = note;
        return next;
      });
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
 *
 * ownerId is read imperatively (useWorkspaceStore.getState(), matching
 * how syncEnabled is already read elsewhere -- e.g. use-note-operations.ts's
 * deleteNote) rather than taken as a hook argument, so this stays a
 * no-argument callback at every existing call site. Tags the new note as
 * this account's own (or null for Local-only) from birth -- without this,
 * a note created while Synced would be indistinguishable from a genuinely
 * anonymous one, which is exactly the ambiguity that let one account's
 * unsynced note leak into a different account signing in on the same
 * device (see LocalNote's ownerId doc and the ADR 0002 amendment).
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
      ownerId: useWorkspaceStore.getState().currentUserId,
    });
    return note.id;
  }, [addNote]);
}

/**
 * `:pin` / the hover pin icon (NoteListItem) -- toggles a note's `pinned`
 * flag from anywhere it's listed, not just the active buffer. Same
 * optimistic-cache + Local store mirror + best-effort server push shape as
 * useNoteOperations' rename/delete, just keyed off the note object a list
 * row already has in hand instead of the active noteId.
 */
export function useTogglePin() {
  const { updateNote } = useNotesMutations();

  return useCallback(
    (note: Pick<NoteRecord, "id" | "pinned" | "archived">) => {
      const pinned = !note.pinned;
      updateNote(note.id, { pinned });
      void (async () => {
        const existing = await getLocalNote(note.id);
        if (!existing) return;
        await setLocalNote({ ...existing, pinned, editedAt: new Date().toISOString() });
      })();
      if (useWorkspaceStore.getState().syncEnabled) {
        setNoteFlagsAction({ noteId: note.id, pinned, archived: note.archived }).catch(() => {});
      }
    },
    [updateNote],
  );
}
