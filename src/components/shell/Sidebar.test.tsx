// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { NoteRecord } from "@/lib/note-types";

const NOTES: NoteRecord[] = [
  {
    id: "1",
    title: "shipping plan",
    pinned: false,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
    content: "#project",
  },
];

const isDesktopRef = { current: true as boolean | null };

vi.mock("next/navigation", () => ({ usePathname: () => "/notes/1" }));
vi.mock("@/lib/notes-query", () => ({ useNotesQuery: () => ({ data: NOTES }) }));
vi.mock("@/lib/use-is-desktop", () => ({ useIsDesktop: () => isDesktopRef.current }));
vi.mock("@/components/workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    activeNoteId: "1",
    openNote: vi.fn(),
    goHome: vi.fn(),
    createAndOpenNote: vi.fn(),
  }),
}));

import { Sidebar } from "@/components/shell/Sidebar";

afterEach(() => {
  cleanup();
  isDesktopRef.current = true;
});

describe("Sidebar", () => {
  it("keeps the wordmark and new-note action mounted -- the Tags drill-down overlays only the list region below them", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("tab", { name: "Tags" }));

    expect(screen.getByText("RbNotes")).toBeTruthy();
    expect(screen.getByText("+ New Note")).toBeTruthy();
    expect(screen.getByText("project")).toBeTruthy();
  });

  it("renders nothing on mobile -- its browse role lives in the Dashboard route's List screen instead", () => {
    isDesktopRef.current = false;
    const { container } = render(<Sidebar />);
    expect(container.firstChild).toBeNull();
  });
});
