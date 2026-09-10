// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspaceStore } from "@/lib/store";

const mocks = vi.hoisted(() => ({ saveNoteContentAction: vi.fn() }));

vi.mock("@/server/actions/notes", () => ({
  saveNoteContentAction: mocks.saveNoteContentAction,
}));

import { useAutosave } from "@/components/workspace/useAutosave";

function setup(activeNoteId: string | null, content: Record<string, string>) {
  return renderHook(
    ({ activeNoteId }: { activeNoteId: string | null }) =>
      useAutosave({
        getContentFor: (id) => content[id] ?? null,
        activeNoteId,
        onSaved: () => {},
      }),
    { initialProps: { activeNoteId } },
  );
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.saveNoteContentAction.mockReset();
    mocks.saveNoteContentAction.mockResolvedValue({ title: "t", updatedAt: "2026-01-01T00:00:00.000Z" });
    useWorkspaceStore.setState({ saveState: "clean", dirtyNoteIds: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists silently after a short idle with no explicit flush call", async () => {
    const { result } = setup("a", { a: "hello" });

    act(() => result.current.markDirty("a"));
    expect(useWorkspaceStore.getState().saveState).toBe("dirty");
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNoteContentAction).toHaveBeenCalledWith({ noteId: "a", content: "hello" });
    expect(useWorkspaceStore.getState().saveState).toBe("clean");
  });

  it("`:w`/Ctrl+S (flush) persists immediately through the same path, cancelling the pending debounce", async () => {
    const { result } = setup("a", { a: "hello" });
    act(() => result.current.markDirty("a"));

    await act(async () => {
      await result.current.flush("a");
    });

    expect(mocks.saveNoteContentAction).toHaveBeenCalledOnce();
    // The debounce timer that was pending must not fire a second save.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(mocks.saveNoteContentAction).toHaveBeenCalledOnce();
  });

  it("[+] shows while dirty and clears silently (no throw, no notify) on success", async () => {
    const { result } = setup("a", { a: "x" });
    act(() => result.current.markDirty("a"));
    expect(useWorkspaceStore.getState().saveState).toBe("dirty");

    await act(async () => {
      await result.current.flush("a");
    });
    expect(useWorkspaceStore.getState().saveState).toBe("clean");
    expect(useWorkspaceStore.getState().dirtyNoteIds["a"]).toBeUndefined();
  });

  it("a failed save keeps the buffer dirty and reports the error state -- text ownership stays with the caller (content is never mutated here)", async () => {
    mocks.saveNoteContentAction.mockRejectedValueOnce(new Error("network"));
    const { result } = setup("a", { a: "unsaved work" });
    act(() => result.current.markDirty("a"));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.flush("a");
    });

    expect(ok).toBe(false);
    expect(useWorkspaceStore.getState().saveState).toBe("error");
    expect(result.current.isDirty("a")).toBe(true);
  });

  it("retrying after a failure re-flushes the same content and clears the error", async () => {
    mocks.saveNoteContentAction.mockRejectedValueOnce(new Error("network"));
    mocks.saveNoteContentAction.mockResolvedValueOnce({
      title: "t",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const { result } = setup("a", { a: "unsaved work" });
    act(() => result.current.markDirty("a"));
    await act(async () => {
      await result.current.flush("a");
    });
    expect(useWorkspaceStore.getState().saveState).toBe("error");

    await act(async () => {
      await result.current.flush("a");
    });
    expect(useWorkspaceStore.getState().saveState).toBe("clean");
  });

  it("a clean buffer's flush (no-op :w) reports clean without calling the server", async () => {
    const { result } = setup("a", { a: "x" });
    await act(async () => {
      await result.current.flush("a");
    });
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().saveState).toBe("clean");
  });

  it("a background buffer's debounce keeps running after the active buffer switches away, and doesn't affect the newly active buffer's status", async () => {
    const { result, rerender } = setup("a", { a: "typing in a" });
    act(() => result.current.markDirty("a"));
    expect(useWorkspaceStore.getState().saveState).toBe("dirty");

    rerender({ activeNoteId: "b" });
    // Switching away reflects buffer b's (clean) status, not a's.
    expect(useWorkspaceStore.getState().saveState).toBe("clean");

    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNoteContentAction).toHaveBeenCalledWith({
      noteId: "a",
      content: "typing in a",
    });
    // Still on buffer b -- its status is untouched by a's background save.
    expect(useWorkspaceStore.getState().saveState).toBe("clean");
  });
});
