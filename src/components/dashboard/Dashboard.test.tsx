// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { NoteRecord } from "@/lib/note-types";

const NOTES: NoteRecord[] = [
  {
    id: "1",
    title: "shipping plan",
    pinned: false,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
    content: "notes #project",
  },
];

const isDesktopRef = { current: true as boolean | null };
const createAndOpenNote = vi.fn();

vi.mock("@/lib/notes-query", () => ({ useNotesQuery: () => ({ data: NOTES }) }));
vi.mock("@/lib/use-is-desktop", () => ({ useIsDesktop: () => isDesktopRef.current }));
vi.mock("@/components/workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    activeNoteId: null,
    openNote: vi.fn(),
    goHome: vi.fn(),
    createAndOpenNote,
  }),
}));

import { Dashboard } from "@/components/dashboard/Dashboard";

afterEach(() => {
  cleanup();
  isDesktopRef.current = true;
  createAndOpenNote.mockClear();
});

describe("Dashboard", () => {
  it("renders the desktop landing screen (quote + recent notes) at desktop widths", () => {
    render(<Dashboard email="a@b.com" />);
    expect(screen.getByText("shipping-plan.md")).toBeTruthy();
  });

  it("renders the mobile List screen instead -- search, tags, every note -- below the breakpoint", () => {
    isDesktopRef.current = false;
    render(<Dashboard email="a@b.com" />);

    // SidebarLists' buffer tab, folded into the Dashboard route on mobile.
    expect(screen.getByText("shipping-plan.md")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Tags" })).toBeTruthy();
  });

  it("mobile's + New note creates a note directly", () => {
    isDesktopRef.current = false;
    render(<Dashboard email="a@b.com" />);

    screen.getByText("+ New note").click();
    expect(createAndOpenNote).toHaveBeenCalledOnce();
  });
});
