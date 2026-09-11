// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspaceStore } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  saveNoteContentAction: vi.fn(),
  getNote: vi.fn(),
  setNote: vi.fn(),
  markSynced: vi.fn(),
}));

vi.mock("@/server/actions/notes", () => ({
  saveNoteContentAction: mocks.saveNoteContentAction,
}));

vi.mock("@/lib/local-notes-store", () => ({
  getNote: mocks.getNote,
  setNote: mocks.setNote,
  markSynced: mocks.markSynced,
}));

import { useAutosave } from "@/components/workspace/useAutosave";

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
}

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
    mocks.getNote.mockReset().mockResolvedValue(undefined);
    mocks.setNote.mockReset().mockResolvedValue(undefined);
    mocks.markSynced.mockReset().mockResolvedValue(undefined);
    setOnline(true);
    useWorkspaceStore.setState({ saveState: "clean", dirtyNoteIds: {}, syncEnabled: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    setOnline(true);
    useWorkspaceStore.setState({ syncEnabled: true });
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

  it("markDirty persists content to the Local store on a short debounce, independent of the server debounce", async () => {
    const { result } = setup("a", { a: "hello" });
    act(() => result.current.markDirty("a"));

    expect(mocks.setNote).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.setNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", content: "hello", deleted: false }),
    );
  });

  it("a rapid burst of edits writes to the Local store once, not once per keystroke", async () => {
    const content: Record<string, string> = { a: "h" };
    const { result } = setup("a", content);

    for (const c of ["he", "hel", "hell", "hello"]) {
      content.a = c;
      act(() => result.current.markDirty("a"));
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
    }
    expect(mocks.setNote).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.setNote).toHaveBeenCalledTimes(1);
    expect(mocks.setNote).toHaveBeenCalledWith(expect.objectContaining({ content: "hello" }));
  });

  it("a forced flush (:w/Ctrl+S) persists locally immediately, without waiting for the local debounce", async () => {
    const { result } = setup("a", { a: "hello" });
    act(() => result.current.markDirty("a"));

    await act(async () => {
      await result.current.flush("a");
    });

    expect(mocks.setNote).toHaveBeenCalledWith(expect.objectContaining({ content: "hello" }));
  });

  it("a Local-only session (no sync) never calls the server -- local persistence is the save", async () => {
    useWorkspaceStore.setState({ syncEnabled: false });
    const { result } = setup("a", { a: "hello" });
    act(() => result.current.markDirty("a"));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.flush("a");
    });

    expect(ok).toBe(true);
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalled();
    expect(mocks.markSynced).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().saveState).toBe("clean");
  });

  it("a Local-only session ignores navigator.onLine entirely -- offline is offline for everyone, but there's nothing to push anyway", async () => {
    useWorkspaceStore.setState({ syncEnabled: false });
    setOnline(false);
    const { result } = setup("a", { a: "hello" });
    act(() => result.current.markDirty("a"));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.flush("a");
    });

    expect(ok).toBe(true);
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalled();
  });

  it("flush is skipped while offline -- stays dirty, never calls the server", async () => {
    setOnline(false);
    const { result } = setup("a", { a: "hello" });
    act(() => result.current.markDirty("a"));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.flush("a");
    });

    expect(ok).toBe(false);
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalled();
    expect(result.current.isDirty("a")).toBe(true);
    expect(useWorkspaceStore.getState().saveState).toBe("dirty");
  });

  it("a pending offline note flushes automatically once the browser 'online' event fires", async () => {
    setOnline(false);
    const { result } = setup("a", { a: "hello" });
    act(() => result.current.markDirty("a"));
    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
    });
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalled();

    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNoteContentAction).toHaveBeenCalledWith({ noteId: "a", content: "hello" });
  });

  it("a successful push records the Synced mark in the Local store", async () => {
    const { result } = setup("a", { a: "hello" });
    act(() => result.current.markDirty("a"));

    await act(async () => {
      await result.current.flush("a");
    });

    expect(mocks.markSynced).toHaveBeenCalledWith("a", "2026-01-01T00:00:00.000Z");
  });

  it("periodically retries a still-dirty note in the background", async () => {
    setOnline(false);
    const { result } = setup("a", { a: "hello" });
    act(() => result.current.markDirty("a"));
    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
    });
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalled();

    setOnline(true);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveNoteContentAction).toHaveBeenCalledWith({ noteId: "a", content: "hello" });
  });
});
