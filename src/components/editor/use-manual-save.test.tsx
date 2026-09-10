// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspaceStore } from "@/lib/store";

const mocks = vi.hoisted(() => ({ saveNoteContentAction: vi.fn() }));

vi.mock("@/server/actions/notes", () => ({
  saveNoteContentAction: mocks.saveNoteContentAction,
}));

import { useManualSave } from "@/components/editor/use-manual-save";

function saveState() {
  return useWorkspaceStore.getState().saveState;
}

describe("useManualSave save-state lifecycle", () => {
  beforeEach(() => {
    mocks.saveNoteContentAction.mockReset();
    useWorkspaceStore.setState({ saveState: "clean" });
  });

  it("shows clean when a buffer mounts, even if the store was left dirty by the previous buffer", () => {
    useWorkspaceStore.setState({ saveState: "dirty" });

    renderHook(() => useManualSave("note-1", () => "content"));

    expect(saveState()).toBe("clean");
  });

  it("moves saving then clean across an explicit write", async () => {
    let resolveSave: (value: { title: string; updatedAt: string }) => void = () => {};
    mocks.saveNoteContentAction.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );

    const { result } = renderHook(() => useManualSave("note-1", () => "hello"));

    act(() => {
      result.current.markDirty();
    });
    expect(saveState()).toBe("dirty");

    let written: Promise<boolean> | undefined;
    act(() => {
      written = result.current.write();
    });
    expect(saveState()).toBe("saving");

    await act(async () => {
      resolveSave({ title: "hello", updatedAt: "2026-09-10T00:00:00.000Z" });
      await written;
    });
    expect(saveState()).toBe("clean");
  });

  it("reports clean when writing a buffer with no changes, rather than leaving a stale dirty flag", async () => {
    useWorkspaceStore.setState({ saveState: "dirty" });

    const { result } = renderHook(() => useManualSave("note-1", () => "hello"));

    await act(async () => {
      await result.current.write();
    });

    expect(saveState()).toBe("clean");
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalled();
  });

  it("reports error when the write fails", async () => {
    mocks.saveNoteContentAction.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useManualSave("note-1", () => "hello"));

    act(() => {
      result.current.markDirty();
    });
    let ok = true;
    await act(async () => {
      ok = await result.current.write();
    });

    expect(ok).toBe(false);
    expect(saveState()).toBe("error");
  });
});
