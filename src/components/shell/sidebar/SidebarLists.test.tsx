// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import type { NoteRecord } from "@/lib/note-types";
import { useWorkspaceStore } from "@/lib/store";

const NOTES: NoteRecord[] = [
  {
    id: "1",
    title: "shipping plan",
    pinned: false,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
    content: "notes #project #urgent",
  },
  {
    id: "2",
    title: "grocery list",
    pinned: false,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    content: "milk eggs #home",
  },
  {
    id: "3",
    title: "q3 roadmap",
    pinned: false,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    content: "plan #project",
  },
];

vi.mock("@/lib/notes-query", () => ({ useNotesQuery: () => ({ data: NOTES }) }));
vi.mock("@/components/workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({
    activeNoteId: null,
    openNote: vi.fn(),
    goHome: vi.fn(),
    createAndOpenNote: vi.fn(),
  }),
}));

import { SidebarLists } from "@/components/shell/sidebar/SidebarLists";

afterEach(() => {
  cleanup();
  useWorkspaceStore.setState({ searchSeed: null, searchOpen: false, focusTagsRequestId: 0 });
});

describe("SidebarLists", () => {
  it("shows the buffer list by default", () => {
    render(<SidebarLists />);
    // Fixture notes are months old, so they land in EARLIER, which --
    // like every non-TODAY group -- starts collapsed; open it first.
    fireEvent.click(screen.getByText("EARLIER"));
    expect(screen.getByText("shipping-plan.md")).toBeTruthy();
    expect(screen.getByText("grocery-list.md")).toBeTruthy();
  });

  it("Tags tab shows tag counts derived from note content", () => {
    render(<SidebarLists />);
    fireEvent.click(screen.getByRole("tab", { name: "Tags" }));

    expect(screen.getByText("project")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("home")).toBeTruthy();
  });

  it("expands a tag inline as an accordion, alongside the other tags, and collapses on a second click", () => {
    render(<SidebarLists />);
    fireEvent.click(screen.getByRole("tab", { name: "Tags" }));
    fireEvent.click(screen.getByText("project"));

    expect(screen.getByText("shipping-plan.md")).toBeTruthy();
    expect(screen.getByText("q3-roadmap.md")).toBeTruthy();
    expect(screen.queryByText("grocery-list.md")).toBeNull();
    // Other tags stay visible -- this is an accordion, not a drill-down.
    expect(screen.getByText("home")).toBeTruthy();

    fireEvent.click(screen.getByText("project"));
    expect(screen.queryByText("shipping-plan.md")).toBeNull();
  });

  it("multiple tags can be expanded at once", () => {
    render(<SidebarLists />);
    fireEvent.click(screen.getByRole("tab", { name: "Tags" }));
    fireEvent.click(screen.getByText("project"));
    fireEvent.click(screen.getByText("home"));

    expect(screen.getByText("shipping-plan.md")).toBeTruthy();
    expect(screen.getByText("grocery-list.md")).toBeTruthy();
  });

  it("the Buffers tab returns to the top-level list regardless of expanded tags", () => {
    render(<SidebarLists />);
    fireEvent.click(screen.getByRole("tab", { name: "Tags" }));
    fireEvent.click(screen.getByText("project"));
    fireEvent.click(screen.getByRole("tab", { name: "Buffers" }));
    fireEvent.click(screen.getByText("EARLIER"));

    expect(screen.getByText("shipping-plan.md")).toBeTruthy();
    expect(screen.getByText("grocery-list.md")).toBeTruthy();
  });

  it("plain typing filters the buffer list by title", () => {
    render(<SidebarLists />);
    fireEvent.click(screen.getByText("EARLIER"));
    fireEvent.change(screen.getByLabelText("Filter or search"), {
      target: { value: "grocery" },
    });

    expect(screen.getByText("grocery-list.md")).toBeTruthy();
    expect(screen.queryByText("shipping-plan.md")).toBeNull();
  });

  it("a leading / in the filter box escalates to global search on Enter, seeding it and leaving the local list untouched", () => {
    render(<SidebarLists />);
    fireEvent.click(screen.getByText("EARLIER"));
    const input = screen.getByLabelText("Filter or search");
    fireEvent.change(input, { target: { value: "/deadline" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(useWorkspaceStore.getState().searchSeed).toBe("deadline");
    expect(useWorkspaceStore.getState().searchOpen).toBe(true);
    expect(screen.getByText("shipping-plan.md")).toBeTruthy();
  });

  it("Ctrl+T (requestFocusTags) switches to the Tags tab and focuses the filter box, from anywhere", async () => {
    render(<SidebarLists />);
    expect(screen.getByRole("tab", { name: "Buffers" }).getAttribute("aria-selected")).toBe(
      "true",
    );

    act(() => {
      useWorkspaceStore.getState().requestFocusTags();
    });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Tags" }).getAttribute("aria-selected")).toBe(
        "true",
      );
      expect(screen.getByLabelText("Filter or search")).toBe(document.activeElement);
    });
  });

  it("Ctrl+T again re-focuses even when Tags is already the active tab", async () => {
    render(<SidebarLists />);
    fireEvent.click(screen.getByRole("tab", { name: "Tags" }));
    fireEvent.click(screen.getByText("project"));

    act(() => {
      useWorkspaceStore.getState().requestFocusTags();
    });

    await waitFor(() => {
      // Collapses any expanded tag accordions, not just "still on Tags".
      expect(screen.queryByText("shipping-plan.md")).toBeNull();
      expect(screen.getByLabelText("Filter or search")).toBe(document.activeElement);
    });
  });
});
