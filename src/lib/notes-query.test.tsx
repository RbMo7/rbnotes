// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { notesQueryKey, type NoteRecord } from "@/lib/note-types";
import { useWorkspaceStore } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  getAllNoteContentsAction: vi.fn(),
  getAllNotesMetaAction: vi.fn(),
  saveNoteContentAction: vi.fn(),
  setNoteFlagsAction: vi.fn(),
  listNotes: vi.fn(),
  getLocalNote: vi.fn(),
  setLocalNote: vi.fn(),
  markLocalSynced: vi.fn(),
}));

vi.mock("@/server/actions/notes", () => ({
  getAllNoteContentsAction: mocks.getAllNoteContentsAction,
  getAllNotesMetaAction: mocks.getAllNotesMetaAction,
  saveNoteContentAction: mocks.saveNoteContentAction,
  setNoteFlagsAction: mocks.setNoteFlagsAction,
}));

// isMigratable/isPurgeable keep their real implementation (they're pure
// and already covered directly by local-notes-store.test.ts) -- only the
// I/O functions are replaced with test doubles.
vi.mock("@/lib/local-notes-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/local-notes-store")>();
  return {
    ...actual,
    listNotes: mocks.listNotes,
    getNote: mocks.getLocalNote,
    setNote: mocks.setLocalNote,
    markSynced: mocks.markLocalSynced,
  };
});

import {
  warmAllNotes,
  isFullyWarm,
  useNotesQuery,
  useLocalNotesQuery,
  useMigrateLocalNotes,
} from "@/lib/notes-query";

function note(overrides: Partial<NoteRecord> & { id: string }): NoteRecord {
  return {
    title: "untitled",
    pinned: false,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setup(notes: NoteRecord[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData<NoteRecord[]>(notesQueryKey, notes);
  return queryClient;
}

const OWNER = "user-1";

describe("warmAllNotes", () => {
  beforeEach(() => {
    mocks.getAllNoteContentsAction.mockReset();
    mocks.getLocalNote.mockReset().mockResolvedValue(undefined);
    mocks.setLocalNote.mockReset();
  });

  it("fetches every cold note's content in a single request and writes it as a real string, not absent", async () => {
    const queryClient = setup([note({ id: "a" }), note({ id: "b" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([
      { id: "a", content: "hello" },
      { id: "b", content: "world" },
    ]);

    await warmAllNotes(queryClient, OWNER);

    expect(mocks.getAllNoteContentsAction).toHaveBeenCalledOnce();
    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes.find((n) => n.id === "a")?.content).toBe("hello");
    expect(notes.find((n) => n.id === "b")?.content).toBe("world");
  });

  it("never overwrites a note that's already warm (even an empty string counts as warm)", async () => {
    const queryClient = setup([note({ id: "a", content: "" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([{ id: "a", content: "from the server" }]);

    await warmAllNotes(queryClient, OWNER);

    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes[0].content).toBe("");
  });

  it("ignores a batch result for a note id no longer in the cache", async () => {
    const queryClient = setup([note({ id: "a" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([
      { id: "a", content: "hello" },
      { id: "deleted-meanwhile", content: "should be ignored" },
    ]);

    await warmAllNotes(queryClient, OWNER);

    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toBe("hello");
  });

  it("regression (skip-dirty): never applies a fetched value to a note with unsaved local edits, but still warms the rest of the batch", async () => {
    const queryClient = setup([note({ id: "a" }), note({ id: "b" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([
      { id: "a", content: "from server" },
      { id: "b", content: "from server" },
    ]);

    await warmAllNotes(queryClient, OWNER, (id) => id === "a");

    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes.find((n) => n.id === "a")?.content).toBeUndefined();
    expect(notes.find((n) => n.id === "b")?.content).toBe("from server");
  });

  it("regression (stale-never-clobbers): a note warmed through a race while the batch is in flight is left alone", async () => {
    const queryClient = setup([note({ id: "a" })]);
    let resolveFetch!: (v: { id: string; content: string }[]) => void;
    mocks.getAllNoteContentsAction.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const warming = warmAllNotes(queryClient, OWNER);
    // The note warms through some other path (e.g. the user opened it and a
    // save landed) while this batch is still in flight.
    queryClient.setQueryData<NoteRecord[]>(notesQueryKey, (old) =>
      old?.map((n) => (n.id === "a" ? { ...n, content: "already warmed elsewhere" } : n)),
    );
    resolveFetch([{ id: "a", content: "stale response" }]);
    await warming;

    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes[0].content).toBe("already warmed elsewhere");
  });

  it("regression (stale-never-clobbers): a note edited+saved (updatedAt moved) while the batch is in flight is left alone", async () => {
    const queryClient = setup([note({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" })]);
    let resolveFetch!: (v: { id: string; content: string }[]) => void;
    mocks.getAllNoteContentsAction.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const warming = warmAllNotes(queryClient, OWNER);
    queryClient.setQueryData<NoteRecord[]>(notesQueryKey, (old) =>
      old?.map((n) => (n.id === "a" ? { ...n, updatedAt: "2026-01-02T00:00:00.000Z" } : n)),
    );
    resolveFetch([{ id: "a", content: "stale response" }]);
    await warming;

    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes[0].content).toBeUndefined();
  });

  it("is a no-op, not a crash, when the batch action throws", async () => {
    const queryClient = setup([note({ id: "a" })]);
    mocks.getAllNoteContentsAction.mockRejectedValue(new Error("network error"));

    await expect(warmAllNotes(queryClient, OWNER)).resolves.toBeUndefined();
    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes[0].content).toBeUndefined();
  });

  it("mirrors newly-warmed content into the Local store tagged with the current account", async () => {
    const queryClient = setup([note({ id: "a" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([{ id: "a", content: "hello" }]);

    await warmAllNotes(queryClient, OWNER);

    expect(mocks.setLocalNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", content: "hello", ownerId: OWNER, syncedAt: "2026-01-01T00:00:00.000Z" }),
    );
  });

  it("regression (unsynced-local-never-clobbered): skips the Local store mirror when the existing local record has genuine unpushed edits", async () => {
    const queryClient = setup([note({ id: "a" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([{ id: "a", content: "older server content" }]);
    mocks.getLocalNote.mockResolvedValue({
      id: "a",
      title: "local title",
      content: "newer local content",
      pinned: false,
      archived: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      editedAt: "2026-01-05T00:00:00.000Z",
      syncedAt: "2026-01-01T00:00:00.000Z", // older than editedAt -- genuinely unsynced
      deleted: false,
      ownerId: OWNER,
    });

    await warmAllNotes(queryClient, OWNER);

    expect(mocks.setLocalNote).not.toHaveBeenCalled();
  });

  it("regression (unsynced-local-never-clobbered): skips the mirror when the local record was never synced at all", async () => {
    const queryClient = setup([note({ id: "a" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([{ id: "a", content: "older server content" }]);
    mocks.getLocalNote.mockResolvedValue({
      id: "a",
      title: "local title",
      content: "local content",
      pinned: false,
      archived: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      editedAt: "2026-01-01T00:00:00.000Z",
      syncedAt: null,
      deleted: false,
      ownerId: OWNER,
    });

    await warmAllNotes(queryClient, OWNER);

    expect(mocks.setLocalNote).not.toHaveBeenCalled();
  });

  it("still mirrors when the existing local record is already fully synced", async () => {
    const queryClient = setup([note({ id: "a" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([{ id: "a", content: "server content" }]);
    mocks.getLocalNote.mockResolvedValue({
      id: "a",
      title: "old title",
      content: "old content",
      pinned: false,
      archived: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      editedAt: "2026-01-01T00:00:00.000Z",
      syncedAt: "2026-01-01T00:00:00.000Z", // editedAt <= syncedAt -- no pending changes
      deleted: false,
      ownerId: OWNER,
    });

    await warmAllNotes(queryClient, OWNER);

    expect(mocks.setLocalNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", content: "server content" }),
    );
  });
});

describe("isFullyWarm", () => {
  it("is true only once every note has content", () => {
    expect(isFullyWarm([note({ id: "a", content: "x" })])).toBe(true);
    expect(isFullyWarm([note({ id: "a", content: "x" }), note({ id: "b" })])).toBe(false);
    expect(isFullyWarm([])).toBe(true);
  });
});

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useNotesQuery (Local-only vs Synced gating)", () => {
  beforeEach(() => {
    mocks.getAllNotesMetaAction.mockReset().mockResolvedValue([note({ id: "server-note" })]);
  });

  it("never calls the server action for a Local-only (syncEnabled: false) session -- it would redirect to /login", async () => {
    useWorkspaceStore.setState({ syncEnabled: false });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useNotesQuery(), { wrapper: wrapper(queryClient) });

    await new Promise((r) => setTimeout(r, 10));
    expect(mocks.getAllNotesMetaAction).not.toHaveBeenCalled();
    useWorkspaceStore.setState({ syncEnabled: true });
  });

  it("fetches normally for a Synced (syncEnabled: true) session", async () => {
    useWorkspaceStore.setState({ syncEnabled: true });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useNotesQuery(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mocks.getAllNotesMetaAction).toHaveBeenCalledOnce();
  });
});

describe("useLocalNotesQuery", () => {
  beforeEach(() => {
    mocks.listNotes.mockReset();
  });

  it("seeds the shared notes cache from the Local store when enabled", async () => {
    mocks.listNotes.mockResolvedValue([
      {
        id: "local-a",
        title: "Local note",
        content: "hi",
        pinned: false,
        archived: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        editedAt: "2026-01-02T00:00:00.000Z",
        syncedAt: null,
        deleted: false,
      },
    ]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useLocalNotesQuery(true), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey);
      expect(notes?.[0]?.id).toBe("local-a");
    });
    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes[0].content).toBe("hi");
    expect(notes[0].updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("does nothing when disabled -- a Synced session gets its data from the server prefetch instead", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useLocalNotesQuery(false), { wrapper: wrapper(queryClient) });

    await new Promise((r) => setTimeout(r, 10));
    expect(mocks.listNotes).not.toHaveBeenCalled();
  });
});

function localNote(
  id: string,
  syncedAt: string | null,
  overrides: { ownerId?: string | null; pinned?: boolean; archived?: boolean } = {},
) {
  return {
    id,
    title: "untitled",
    content: "hi",
    pinned: overrides.pinned ?? false,
    archived: overrides.archived ?? false,
    createdAt: "2026-01-01T00:00:00.000Z",
    editedAt: "2026-01-01T00:00:00.000Z",
    syncedAt,
    deleted: false,
    ownerId: overrides.ownerId ?? null,
  };
}

describe("useMigrateLocalNotes", () => {
  beforeEach(() => {
    mocks.listNotes.mockReset();
    mocks.saveNoteContentAction.mockReset();
    mocks.setNoteFlagsAction.mockReset().mockResolvedValue(undefined);
    mocks.markLocalSynced.mockReset();
    mocks.setLocalNote.mockReset().mockResolvedValue(undefined);
  });

  it("reports progress as each migratable local note is pushed, and leaves a different account's note alone", async () => {
    mocks.listNotes.mockResolvedValue([
      localNote("a", null), // anonymous-origin -- migratable
      localNote("b", "2026-01-01T00:00:00.000Z", { ownerId: "someone-else" }), // a different account's already-synced note -- never migrated
      localNote("c", null),
    ]);
    mocks.saveNoteContentAction.mockImplementation(({ noteId }: { noteId: string }) =>
      Promise.resolve({ title: "untitled", updatedAt: `${noteId}-synced` }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useMigrateLocalNotes("user@example.com", OWNER), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current).toEqual({ total: 2, current: 2 }));
    expect(mocks.saveNoteContentAction).toHaveBeenCalledTimes(2);
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ noteId: "b" }),
    );
  });

  it("resumes this same account's own previously-stranded unsynced note", async () => {
    mocks.listNotes.mockResolvedValue([localNote("stranded", null, { ownerId: OWNER })]);
    mocks.saveNoteContentAction.mockResolvedValue({ title: "untitled", updatedAt: "now" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useMigrateLocalNotes("user@example.com", OWNER), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current).toEqual({ total: 1, current: 1 }));
    expect(mocks.saveNoteContentAction).toHaveBeenCalledWith({ noteId: "stranded", content: "hi" });
  });

  it("tags a migrated note as owned by this account, so it can't be re-adopted by a different account later", async () => {
    mocks.listNotes.mockResolvedValue([localNote("a", null)]);
    mocks.saveNoteContentAction.mockResolvedValue({ title: "untitled", updatedAt: "2026-02-01T00:00:00.000Z" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useMigrateLocalNotes("user@example.com", OWNER), { wrapper: wrapper(queryClient) });

    await waitFor(() =>
      expect(mocks.setLocalNote).toHaveBeenCalledWith(
        expect.objectContaining({ id: "a", ownerId: OWNER, syncedAt: "2026-02-01T00:00:00.000Z" }),
      ),
    );
  });

  it("carries pinned/archived along via a follow-up setNoteFlagsAction, not just content", async () => {
    mocks.listNotes.mockResolvedValue([localNote("a", null, { pinned: true, archived: false })]);
    mocks.saveNoteContentAction.mockResolvedValue({ title: "untitled", updatedAt: "now" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useMigrateLocalNotes("user@example.com", OWNER), { wrapper: wrapper(queryClient) });

    await waitFor(() =>
      expect(mocks.setNoteFlagsAction).toHaveBeenCalledWith({
        noteId: "a",
        pinned: true,
        archived: false,
      }),
    );
  });

  it("skips the flags call entirely when neither is set -- nothing to carry", async () => {
    mocks.listNotes.mockResolvedValue([localNote("a", null)]);
    mocks.saveNoteContentAction.mockResolvedValue({ title: "untitled", updatedAt: "now" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useMigrateLocalNotes("user@example.com", OWNER), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current).toEqual({ total: 1, current: 1 }));
    expect(mocks.setNoteFlagsAction).not.toHaveBeenCalled();
  });

  it("stays at {total: 0, current: 0} when nothing needs migrating", async () => {
    mocks.listNotes.mockResolvedValue([localNote("a", "2026-01-01T00:00:00.000Z", { ownerId: OWNER })]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useMigrateLocalNotes("user@example.com", OWNER), {
      wrapper: wrapper(queryClient),
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toEqual({ total: 0, current: 0 });
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalled();
  });

  it("does nothing for an anonymous session", async () => {
    mocks.listNotes.mockResolvedValue([localNote("a", null)]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useMigrateLocalNotes(null, null), { wrapper: wrapper(queryClient) });

    await new Promise((r) => setTimeout(r, 10));
    expect(mocks.listNotes).not.toHaveBeenCalled();
  });
});
