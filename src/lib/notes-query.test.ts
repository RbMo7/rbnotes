// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { notesQueryKey, type NoteRecord } from "@/lib/note-types";

const mocks = vi.hoisted(() => ({ getAllNoteContentsAction: vi.fn() }));

vi.mock("@/server/actions/notes", () => ({
  getAllNoteContentsAction: mocks.getAllNoteContentsAction,
  getAllNotesMetaAction: vi.fn(),
}));

import { warmAllNotes, isFullyWarm } from "@/lib/notes-query";

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
