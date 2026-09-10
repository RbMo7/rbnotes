// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { notesQueryKey, type NoteRecord } from "@/lib/note-types";

const mocks = vi.hoisted(() => ({
  setNoteFlagsAction: vi.fn(async () => {}),
  deleteNoteAction: vi.fn(async () => {}),
  goHome: vi.fn(),
  createAndOpenNote: vi.fn(),
}));

vi.mock("@/server/actions/notes", () => ({
  setNoteFlagsAction: mocks.setNoteFlagsAction,
  deleteNoteAction: mocks.deleteNoteAction,
}));

vi.mock("@/components/workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    activeNoteId: note.id,
    openNote: vi.fn(),
    goHome: mocks.goHome,
    createAndOpenNote: mocks.createAndOpenNote,
  }),
}));

import { useNoteOperations } from "@/components/buffer/use-note-operations";

const note: NoteRecord = {
  id: "note-1",
  title: "Hello",
  content: "body",
  pinned: false,
  archived: false,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

function setup(content: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData<NoteRecord[]>(notesQueryKey, [note]);
  const notify = vi.fn();

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () =>
      useNoteOperations({
        noteId: note.id,
        getContent: () => content,
        notify,
      }),
    { wrapper },
  );

  return { result, queryClient, notify };
}

describe("useNoteOperations", () => {
  beforeEach(() => {
    mocks.setNoteFlagsAction.mockClear();
    mocks.deleteNoteAction.mockClear();
    mocks.goHome.mockClear();
    mocks.createAndOpenNote.mockClear();
  });

  it("archives a non-empty buffer and persists the flag in the background", () => {
    const { result, queryClient } = setup("# Title\n\nsome body");

    act(() => {
      result.current.delete(false);
    });

    const cached = queryClient.getQueryData<NoteRecord[]>(notesQueryKey);
    expect(cached?.[0].archived).toBe(true);
    expect(mocks.setNoteFlagsAction).toHaveBeenCalledWith({ noteId: note.id, archived: true });
    expect(mocks.deleteNoteAction).not.toHaveBeenCalled();
    expect(mocks.goHome).toHaveBeenCalledOnce();
  });

  it("really deletes an empty buffer instead of archiving it", () => {
    const { result, queryClient } = setup("   \n  ");

    act(() => {
      result.current.delete(false);
    });

    expect(queryClient.getQueryData<NoteRecord[]>(notesQueryKey)).toEqual([]);
    expect(mocks.deleteNoteAction).toHaveBeenCalledWith({ noteId: note.id });
    expect(mocks.setNoteFlagsAction).not.toHaveBeenCalled();
  });

  it("really deletes a non-empty buffer when forced with :delete!", () => {
    const { result, queryClient } = setup("some body");

    act(() => {
      result.current.delete(true);
    });

    expect(queryClient.getQueryData<NoteRecord[]>(notesQueryKey)).toEqual([]);
    expect(mocks.deleteNoteAction).toHaveBeenCalledWith({ noteId: note.id });
  });

  it("reflects a rename in the cache immediately", () => {
    const { result, queryClient, notify } = setup("body");

    act(() => {
      result.current.rename("Renamed");
    });

    const cached = queryClient.getQueryData<NoteRecord[]>(notesQueryKey);
    expect(cached?.[0].title).toBe("Renamed");
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("renamed.md"));
  });

  it("create delegates straight to the workspace's createAndOpenNote", () => {
    const { result } = setup("body");
    act(() => {
      result.current.create();
    });
    expect(mocks.createAndOpenNote).toHaveBeenCalledOnce();
  });
});
