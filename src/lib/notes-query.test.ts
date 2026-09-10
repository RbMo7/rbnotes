// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { notesQueryKey, type NoteRecord } from "@/lib/note-types";

const mocks = vi.hoisted(() => ({ getNoteContentAction: vi.fn() }));

vi.mock("@/server/actions/notes", () => ({
  getNoteContentAction: mocks.getNoteContentAction,
  getAllNotesMetaAction: vi.fn(),
}));

import { warmNoteContent, isFullyWarm } from "@/lib/notes-query";

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

describe("warmNoteContent", () => {
  beforeEach(() => {
    mocks.getNoteContentAction.mockReset();
  });

  it("fetches and writes content for a cold note, representing it as a real string, not absent", async () => {
    const queryClient = setup([note({ id: "a" })]);
    mocks.getNoteContentAction.mockResolvedValue({ content: "hello" });

    await warmNoteContent(queryClient, "a");

    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes[0].content).toBe("hello");
  });

  it("is a no-op for an already-warm note (even an empty string counts as warm)", async () => {
    const queryClient = setup([note({ id: "a", content: "" })]);

    await warmNoteContent(queryClient, "a");

    expect(mocks.getNoteContentAction).not.toHaveBeenCalled();
  });

  it("is a no-op for an unknown note id", async () => {
    const queryClient = setup([note({ id: "a" })]);

    await warmNoteContent(queryClient, "does-not-exist");

    expect(mocks.getNoteContentAction).not.toHaveBeenCalled();
  });

  it("regression (skip-dirty): never fetches for a note with unsaved local edits", async () => {
    const queryClient = setup([note({ id: "a" })]);

    await warmNoteContent(queryClient, "a", () => true);

    expect(mocks.getNoteContentAction).not.toHaveBeenCalled();
  });

  it("regression (stale-never-clobbers): a fetch that resolves after the note warmed some other way is discarded", async () => {
    const queryClient = setup([note({ id: "a" })]);
    let resolveFetch!: (v: { content: string }) => void;
    mocks.getNoteContentAction.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const warming = warmNoteContent(queryClient, "a");
    // The note warms through a different path (e.g. a concurrent cold-open)
    // while this fetch is still in flight.
    queryClient.setQueryData<NoteRecord[]>(notesQueryKey, (old) =>
      old?.map((n) => (n.id === "a" ? { ...n, content: "already warmed elsewhere" } : n)),
    );
    resolveFetch({ content: "stale response" });
    await warming;

    const notes = queryClient.getQueryData<NoteRecord[]>(notesQueryKey)!;
    expect(notes[0].content).toBe("already warmed elsewhere");
  });

  it("regression (stale-never-clobbers): a fetch that resolves after the note was edited+saved (updatedAt moved) is discarded", async () => {
    const queryClient = setup([note({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" })]);
    let resolveFetch!: (v: { content: string }) => void;
    mocks.getNoteContentAction.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const warming = warmNoteContent(queryClient, "a");
    // A save landed while the fetch was in flight -- still cold in
    // representation (edge case: a save writes content directly in
    // practice, but updatedAt moving alone must already be enough to
    // distrust this fetch).
    queryClient.setQueryData<NoteRecord[]>(notesQueryKey, (old) =>
      old?.map((n) => (n.id === "a" ? { ...n, updatedAt: "2026-01-02T00:00:00.000Z" } : n)),
    );
    resolveFetch({ content: "stale response" });
    await warming;

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
