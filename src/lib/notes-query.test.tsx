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
  listNotes: vi.fn(),
}));

vi.mock("@/server/actions/notes", () => ({
  getAllNoteContentsAction: mocks.getAllNoteContentsAction,
  getAllNotesMetaAction: mocks.getAllNotesMetaAction,
}));

vi.mock("@/lib/local-notes-store", () => ({
  listNotes: mocks.listNotes,
}));

import { warmAllNotes, isFullyWarm, useNotesQuery, useLocalNotesQuery } from "@/lib/notes-query";

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

describe("warmAllNotes", () => {
  beforeEach(() => {
    mocks.getAllNoteContentsAction.mockReset();
  });

  it("fetches every cold note's content in a single request and writes it as a real string, not absent", async () => {
    const queryClient = setup([note({ id: "a" }), note({ id: "b" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([
      { id: "a", content: "hello" },
      { id: "b", content: "world" },
    ]);

    await warmAllNotes(queryClient);

    expect(mocks.getAllNoteContentsAction).toHaveBeenCalledOnce();
    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes.find((n) => n.id === "a")?.content).toBe("hello");
    expect(notes.find((n) => n.id === "b")?.content).toBe("world");
  });

  it("never overwrites a note that's already warm (even an empty string counts as warm)", async () => {
    const queryClient = setup([note({ id: "a", content: "" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([{ id: "a", content: "from the server" }]);

    await warmAllNotes(queryClient);

    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes[0].content).toBe("");
  });

  it("ignores a batch result for a note id no longer in the cache", async () => {
    const queryClient = setup([note({ id: "a" })]);
    mocks.getAllNoteContentsAction.mockResolvedValue([
      { id: "a", content: "hello" },
      { id: "deleted-meanwhile", content: "should be ignored" },
    ]);

    await warmAllNotes(queryClient);

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

    await warmAllNotes(queryClient, (id) => id === "a");

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

    const warming = warmAllNotes(queryClient);
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

    const warming = warmAllNotes(queryClient);
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

    await expect(warmAllNotes(queryClient)).resolves.toBeUndefined();
    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes[0].content).toBeUndefined();
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
