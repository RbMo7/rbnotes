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
    content: "body",
  },
];

const pathnameRef = { current: "/" };
const activeNoteIdRef = { current: null as string | null };

vi.mock("next/navigation", () => ({ usePathname: () => pathnameRef.current }));
vi.mock("@/lib/notes-query", () => ({ useNotesQuery: () => ({ data: NOTES }) }));
vi.mock("@/components/workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    activeNoteId: activeNoteIdRef.current,
    openNote: vi.fn(),
    goHome: vi.fn(),
    createAndOpenNote: vi.fn(),
  }),
}));

import { TopBar } from "@/components/shell/TopBar";

afterEach(() => {
  cleanup();
  pathnameRef.current = "/";
  activeNoteIdRef.current = null;
});

describe("TopBar", () => {
  it("falls back to the section name and hides :insp when no buffer is active (Dashboard)", () => {
    pathnameRef.current = "/";
    activeNoteIdRef.current = null;
    render(<TopBar email="a@b.com" />);

    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.queryByText(":insp")).toBeNull();
  });

  it("falls back to the section name on Settings", () => {
    pathnameRef.current = "/settings";
    activeNoteIdRef.current = null;
    render(<TopBar email="a@b.com" />);

    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.queryByText(":insp")).toBeNull();
  });

  it("shows the active note's filename and the :insp toggle when a buffer is open", () => {
    pathnameRef.current = "/notes/1";
    activeNoteIdRef.current = "1";
    render(<TopBar email="a@b.com" />);

    expect(screen.getByText("shipping-plan.md")).toBeTruthy();
    expect(screen.getByText(":insp")).toBeTruthy();
  });
});
