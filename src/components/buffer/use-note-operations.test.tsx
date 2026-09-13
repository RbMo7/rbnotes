// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { notesQueryKey, type NoteRecord } from "@/lib/note-types";
import { useWorkspaceStore } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  setNoteFlagsAction: vi.fn(async () => {}),
  deleteNoteAction: vi.fn(async () => {}),
  goHome: vi.fn(),
  openNote: vi.fn(),
  createAndOpenNote: vi.fn(),
  getLocalNote: vi.fn(),
  setLocalNote: vi.fn(async () => {}),
  tombstoneLocalNote: vi.fn(async () => {}),
  purgeLocalNote: vi.fn(async () => {}),
  cancelAutosave: vi.fn(),
}));

vi.mock("@/server/actions/notes", () => ({
  setNoteFlagsAction: mocks.setNoteFlagsAction,
  deleteNoteAction: mocks.deleteNoteAction,
}));

vi.mock("@/lib/local-notes-store", () => ({
  getNote: mocks.getLocalNote,
  setNote: mocks.setLocalNote,
  tombstoneNote: mocks.tombstoneLocalNote,
  purgeNote: mocks.purgeLocalNote,
}));

vi.mock("@/components/workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    activeNoteId: note.id,
    openNote: mocks.openNote,
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
        noteTitle: note.title,
        getContent: () => content,
        notify,
        cancelAutosave: mocks.cancelAutosave,
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
    mocks.openNote.mockClear();
    mocks.createAndOpenNote.mockClear();
    mocks.getLocalNote.mockReset().mockResolvedValue(undefined);
    mocks.setLocalNote.mockClear();
    mocks.tombstoneLocalNote.mockClear();
    mocks.purgeLocalNote.mockClear();
    mocks.cancelAutosave.mockClear();
    useWorkspaceStore.setState({ syncEnabled: true });
  });

  it("cancels any pending autosave for the note before archiving or deleting it", () => {
    const { result } = setup("some body");
    act(() => {
      result.current.delete(true);
    });
    expect(mocks.cancelAutosave).toHaveBeenCalledWith(note.id);
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

  it("archiving offers an Undo that unarchives and reopens the note", () => {
    const { result, queryClient, notify } = setup("# Title\n\nsome body");

    act(() => {
      result.current.delete(false);
    });

    expect(notify).toHaveBeenCalledWith(expect.stringContaining("archived"), "info", expect.any(Function));
    const undo = notify.mock.calls[0][2] as () => void;

    act(() => {
      undo();
    });

    const cached = queryClient.getQueryData<NoteRecord[]>(notesQueryKey);
    expect(cached?.[0].archived).toBe(false);
    expect(mocks.setNoteFlagsAction).toHaveBeenLastCalledWith({ noteId: note.id, archived: false });
    expect(mocks.openNote).toHaveBeenCalledWith(note.id);
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

  it("mirrors a rename into the Local store, not just the cache", async () => {
    mocks.getLocalNote.mockResolvedValue({
      id: note.id,
      title: "Hello",
      content: "body",
      pinned: false,
      archived: false,
      createdAt: "2026-09-10T00:00:00.000Z",
      editedAt: "2026-09-10T00:00:00.000Z",
      syncedAt: "2026-09-10T00:00:00.000Z",
      deleted: false,
    });
    const { result } = setup("body");

    act(() => {
      result.current.rename("Renamed");
    });

    await waitFor(() =>
      expect(mocks.setLocalNote).toHaveBeenCalledWith(
        expect.objectContaining({ id: note.id, title: "Renamed" }),
      ),
    );
  });

  it("mirrors an archive into the Local store", async () => {
    mocks.getLocalNote.mockResolvedValue({
      id: note.id,
      title: "Hello",
      content: "body",
      pinned: false,
      archived: false,
      createdAt: "2026-09-10T00:00:00.000Z",
      editedAt: "2026-09-10T00:00:00.000Z",
      syncedAt: "2026-09-10T00:00:00.000Z",
      deleted: false,
    });
    const { result } = setup("# Title\n\nsome body");

    act(() => {
      result.current.delete(false);
    });

    await waitFor(() =>
      expect(mocks.setLocalNote).toHaveBeenCalledWith(
        expect.objectContaining({ id: note.id, archived: true }),
      ),
    );
  });

  it("purges (not tombstones) a Local store note that was never synced, on hard delete", async () => {
    mocks.getLocalNote.mockResolvedValue({
      id: note.id,
      title: "Hello",
      content: "some body",
      pinned: false,
      archived: false,
      createdAt: "2026-09-10T00:00:00.000Z",
      editedAt: "2026-09-10T00:00:00.000Z",
      syncedAt: null,
      deleted: false,
    });
    const { result } = setup("some body");

    act(() => {
      result.current.delete(true);
    });

    await waitFor(() => expect(mocks.purgeLocalNote).toHaveBeenCalledWith(note.id));
    expect(mocks.tombstoneLocalNote).not.toHaveBeenCalled();
  });

  it("tombstones (not purges) a Local store note that was already synced, on hard delete", async () => {
    mocks.getLocalNote.mockResolvedValue({
      id: note.id,
      title: "Hello",
      content: "some body",
      pinned: false,
      archived: false,
      createdAt: "2026-09-10T00:00:00.000Z",
      editedAt: "2026-09-10T00:00:00.000Z",
      syncedAt: "2026-09-10T00:00:00.000Z",
      deleted: false,
    });
    const { result } = setup("some body");

    act(() => {
      result.current.delete(true);
    });

    await waitFor(() => expect(mocks.tombstoneLocalNote).toHaveBeenCalledWith(note.id, expect.any(String)));
    expect(mocks.purgeLocalNote).not.toHaveBeenCalled();
  });

  it("regression: treats a missing Local store record as possibly-synced -- tombstones rather than purging", async () => {
    // Default from beforeEach: getLocalNote resolves undefined, e.g. a
    // note whose warmAllNotes mirror write hasn't landed yet.
    const { result } = setup("some body");

    act(() => {
      result.current.delete(true);
    });

    await waitFor(() => expect(mocks.tombstoneLocalNote).toHaveBeenCalledWith(note.id, expect.any(String)));
    expect(mocks.purgeLocalNote).not.toHaveBeenCalled();
  });

  it("never calls the auth-gated delete/archive server actions for a Local-only session", async () => {
    useWorkspaceStore.setState({ syncEnabled: false });
    const { result: archiveResult } = setup("# Title\n\nsome body");
    act(() => {
      archiveResult.current.delete(false);
    });

    const { result: deleteResult } = setup("some body");
    act(() => {
      deleteResult.current.delete(true);
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(mocks.setNoteFlagsAction).not.toHaveBeenCalled();
    expect(mocks.deleteNoteAction).not.toHaveBeenCalled();
  });
});
