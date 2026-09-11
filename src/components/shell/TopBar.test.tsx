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
    content: "body",
  },
];

const pathnameRef = { current: "/" };
const activeNoteIdRef = { current: null as string | null };
const isDesktopRef = { current: true as boolean | null };
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("@/lib/notes-query", () => ({ useNotesQuery: () => ({ data: NOTES }) }));
vi.mock("@/lib/use-is-desktop", () => ({ useIsDesktop: () => isDesktopRef.current }));
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
  isDesktopRef.current = true;
  pushMock.mockClear();
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

  it("hides the leading button on mobile's List screen (nothing to toggle)", () => {
    isDesktopRef.current = false;
    pathnameRef.current = "/";
    activeNoteIdRef.current = null;
    render(<TopBar email="a@b.com" />);

    expect(screen.queryByLabelText("Toggle sidebar")).toBeNull();
    expect(screen.queryByLabelText("Back to notes")).toBeNull();
  });

  it("shows a Back button instead of the sidebar toggle on mobile's Note screen", () => {
    isDesktopRef.current = false;
    pathnameRef.current = "/notes/1";
    activeNoteIdRef.current = "1";
    render(<TopBar email="a@b.com" />);

    const back = screen.getByLabelText("Back to notes");
    fireEvent.click(back);
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(screen.queryByLabelText("Toggle sidebar")).toBeNull();
  });
});
