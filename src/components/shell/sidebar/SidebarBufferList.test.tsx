// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { NoteRecord } from "@/lib/note-types";

vi.mock("@/components/workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    activeNoteId: null,
    openNote: vi.fn(),
    goHome: vi.fn(),
    createAndOpenNote: vi.fn(),
  }),
}));

import { SidebarBufferList } from "@/components/shell/sidebar/SidebarBufferList";

const now = new Date();
const threeDaysAgo = new Date(now);
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

const NOTES: NoteRecord[] = [
  {
    id: "1",
    title: "today note",
    pinned: false,
    archived: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    content: "",
  },
  {
    id: "2",
    title: "old archived note",
    pinned: false,
    archived: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    content: "",
  },
  {
    id: "3",
    title: "this week note",
    pinned: false,
    archived: false,
    createdAt: threeDaysAgo.toISOString(),
    updatedAt: threeDaysAgo.toISOString(),
    content: "",
  },
];

afterEach(cleanup);

describe("SidebarBufferList", () => {
  it("only TODAY starts open -- THIS WEEK, EARLIER, and ARCHIVE all start collapsed", () => {
    render(<SidebarBufferList notes={NOTES} filter="" />);

    expect(screen.getByText("today-note.md")).toBeTruthy();
    expect(screen.queryByText("this-week-note.md")).toBeNull();
    expect(screen.queryByText("old-archived-note.md")).toBeNull();
  });

  it("clicking a recency group header collapses it", () => {
    render(<SidebarBufferList notes={NOTES} filter="" />);

    fireEvent.click(screen.getByText("TODAY"));
    expect(screen.queryByText("today-note.md")).toBeNull();

    fireEvent.click(screen.getByText("TODAY"));
    expect(screen.getByText("today-note.md")).toBeTruthy();
  });

  it("clicking the ARCHIVE header expands it", () => {
    render(<SidebarBufferList notes={NOTES} filter="" />);

    fireEvent.click(screen.getByText("ARCHIVE"));
    expect(screen.getByText("old-archived-note.md")).toBeTruthy();
  });
});
