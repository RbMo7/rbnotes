// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { NoteRecord } from "@/lib/note-types";
import { useWorkspaceStore } from "@/lib/store";

function note(id: string, title: string, daysAgo: number, archived = false): NoteRecord {
  const updatedAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  return { id, title, pinned: false, archived, createdAt: updatedAt, updatedAt, content: "" };
}

const NOTES: NoteRecord[] = [
  ...Array.from({ length: 9 }, (_, i) => note(String(i), `note ${i}`, i)),
  note("archived", "archived note", 0, true),
];

const openNote = vi.fn();

vi.mock("@/lib/notes-query", () => ({ useNotesQuery: () => ({ data: NOTES }) }));
vi.mock("@/components/workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    activeNoteId: null,
    openNote,
    goHome: vi.fn(),
    createAndOpenNote: vi.fn(),
  }),
}));

import { RecentNotesList } from "@/components/dashboard/RecentNotesList";

afterEach(() => {
  cleanup();
  openNote.mockClear();
  useWorkspaceStore.setState({ searchSeed: null, searchOpen: false });
});

describe("RecentNotesList", () => {
  it("caps at 8 most-recent non-archived notes", () => {
    render(<RecentNotesList />);
    expect(screen.getByText("note-0.md")).toBeTruthy();
    expect(screen.getByText("note-7.md")).toBeTruthy();
    expect(screen.queryByText("note-8.md")).toBeNull();
    expect(screen.queryByText("archived-note.md")).toBeNull();
  });

  it("focuses the list on mount so j/k and arrows work with no prior click", () => {
    render(<RecentNotesList />);
    expect(screen.getByRole("listbox")).toBe(document.activeElement);
  });

  it("j/k move the highlight and Enter opens the highlighted note", () => {
    render(<RecentNotesList />);
    const list = screen.getByRole("listbox");

    fireEvent.keyDown(list, { key: "j" });
    fireEvent.keyDown(list, { key: "Enter" });

    expect(openNote).toHaveBeenCalledWith("1");
  });

  it("/ focuses the inline filter box", () => {
    render(<RecentNotesList />);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "/" });
    expect(screen.getByLabelText("Filter recent notes or search all notes")).toBe(
      document.activeElement,
    );
  });

  it("plain typing filters the recent list by title", () => {
    render(<RecentNotesList />);
    fireEvent.change(screen.getByLabelText("Filter recent notes or search all notes"), {
      target: { value: "note 3" },
    });

    expect(screen.getByText("note-3.md")).toBeTruthy();
    expect(screen.queryByText("note-0.md")).toBeNull();
  });

  it("a leading / + Enter escalates to global search instead of filtering", () => {
    render(<RecentNotesList />);
    const input = screen.getByLabelText("Filter recent notes or search all notes");
    fireEvent.change(input, { target: { value: "/deadline" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(useWorkspaceStore.getState().searchSeed).toBe("deadline");
    expect(useWorkspaceStore.getState().searchOpen).toBe(true);
    expect(openNote).not.toHaveBeenCalled();
  });
});
