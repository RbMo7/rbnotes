// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { NoteRecord } from "@/lib/note-types";

const mocks = vi.hoisted(() => ({ searchNotesAction: vi.fn() }));

vi.mock("@/server/actions/notes", () => ({
  searchNotesAction: mocks.searchNotesAction,
}));

import { useGlobalSearch } from "@/components/overlay/useGlobalSearch";
import { searchWarmCache } from "@/components/overlay/global-search";

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

describe("searchWarmCache", () => {
  it("matches title or content, case-insensitively, excluding archived notes", () => {
    const notes = [
      note({ id: "a", title: "Grocery list", content: "milk, eggs" }),
      note({ id: "b", title: "Recipe", content: "needs GROCERY items" }),
      note({ id: "c", title: "Grocery archived", content: "", archived: true }),
    ];
    const results = searchWarmCache(notes, "grocery");
    expect(results.map((r) => r.noteId).sort()).toEqual(["a", "b"]);
  });
});

describe("useGlobalSearch resolution order", () => {
  beforeEach(() => {
    mocks.searchNotesAction.mockReset();
  });

  it("regression (warm-cache boundary): once every note is warm, results come from the cache -- no server call", () => {
    const notes = [note({ id: "a", title: "Alpha", content: "alpha body" })];
    const { result } = renderHook(() => useGlobalSearch("alpha", notes));

    expect(result.current.source).toBe("cache");
    expect(result.current.results.map((r) => r.noteId)).toEqual(["a"]);
    expect(mocks.searchNotesAction).not.toHaveBeenCalled();
  });

  it("regression (warm-cache boundary): while any note is still cold, results come from the server fallback, not the incomplete cache", async () => {
    const notes = [
      note({ id: "a", title: "Alpha", content: "alpha body" }),
      note({ id: "b", title: "Beta" }), // cold -- content absent
    ];
    mocks.searchNotesAction.mockResolvedValue([
      { noteId: "b", title: "Beta", line: "beta has alpha in it", index: 0 },
    ]);

    const { result } = renderHook(() => useGlobalSearch("alpha", notes));
    expect(result.current.source).toBe("server");

    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0].noteId).toBe("b");
    expect(mocks.searchNotesAction).toHaveBeenCalledWith({ query: "alpha" });
  });

  it("never calls the server once every note has warmed, even for a query that only the cache can answer", () => {
    const notes = [note({ id: "a", title: "Solo", content: "" })];
    renderHook(() => useGlobalSearch("solo", notes));
    expect(mocks.searchNotesAction).not.toHaveBeenCalled();
  });
});
