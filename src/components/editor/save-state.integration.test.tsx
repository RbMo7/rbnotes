// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspaceStore } from "@/lib/store";

const mocks = vi.hoisted(() => ({ saveNoteContentAction: vi.fn() }));

vi.mock("@/server/actions/notes", () => ({
  saveNoteContentAction: mocks.saveNoteContentAction,
}));

import { useAutosave } from "@/components/workspace/useAutosave";
import {
  dispatchCommand,
  type CommandContext,
  type EditorOps,
} from "@/components/editor/command-dispatch";

const ops: EditorOps = { replaceFirstH1: () => {}, execVimEx: () => true };

function saveState() {
  return useWorkspaceStore.getState().saveState;
}

/**
 * Integration across the command seam: the real useAutosave engine behind
 * the command context, driven by the actual `:w` dispatch. This asserts
 * the save-state lifecycle at the same interface the command suite uses --
 * unchanged by the move from manual-only save to autosave-with-force-flush,
 * since `:w` still resolves to the exact same `flush` path a debounced
 * autosave would have used.
 */
function renderCommandHarness() {
  return renderHook(() => {
    const { markDirty, flush, isDirty } = useAutosave({
      getContentFor: () => "content",
      activeNoteId: "note-1",
      onSaved: () => {},
    });
    const ctx: CommandContext = {
      note: {
        save: () => flush("note-1"),
        isDirty: () => isDirty("note-1"),
        create: () => {},
        rename: () => {},
        delete: () => {},
        togglePin: () => {},
      },
      workspace: {
        notify: () => {},
        openHelp: () => {},
        openCheatsheet: () => {},
        openPinnedSwitcher: () => {},
        quit: () => {},
        toggleSidebar: () => {},
        toggleInspector: () => {},
        share: () => {},
        unshare: () => {},
        updateSettings: () => {},
        getSettings: () => useWorkspaceStore.getState().settings,
        openSettings: () => {},
        goHome: () => {},
        login: () => {},
        logout: () => {},
      },
    };
    return { markDirty: () => markDirty("note-1"), ctx };
  });
}

describe("save-state transitions at the command seam", () => {
  beforeEach(() => {
    mocks.saveNoteContentAction.mockReset();
    // This suite exercises the Synced (signed-in) save path specifically --
    // syncEnabled defaults to false (Local-only) since the store fix.
    useWorkspaceStore.setState({ saveState: "clean", dirtyNoteIds: {}, syncEnabled: true });
  });

  it(":w drives clean -> saving -> clean", async () => {
    let resolveSave!: (value: { title: string; updatedAt: string }) => void;
    mocks.saveNoteContentAction.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );

    const { result } = renderCommandHarness();
    act(() => {
      result.current.markDirty();
    });
    expect(saveState()).toBe("dirty");

    let command: Promise<void> = Promise.resolve();
    act(() => {
      command = dispatchCommand("w", ops, result.current.ctx);
    });
    expect(saveState()).toBe("saving");

    await act(async () => {
      resolveSave({ title: "content", updatedAt: "2026-09-10T00:00:00.000Z" });
      await command;
    });
    expect(saveState()).toBe("clean");
  });

  it(":w on a clean buffer leaves the indicator clean (early-return stays clean)", async () => {
    const { result } = renderCommandHarness();
    // Simulate the stale flag a previous buffer could leave behind.
    useWorkspaceStore.setState({ saveState: "dirty" });

    await act(async () => {
      await dispatchCommand("w", ops, result.current.ctx);
    });

    expect(saveState()).toBe("clean");
    expect(mocks.saveNoteContentAction).not.toHaveBeenCalled();
  });
});
