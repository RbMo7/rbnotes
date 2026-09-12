import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  dispatchCommand,
  resolveDeleteMode,
  type CommandContext,
  type EditorOps,
} from "@/components/editor/command-dispatch";
import { defaultSettings } from "@/lib/schemas";

function makeHarness(options: { execVimEx?: boolean; saveResult?: boolean } = {}) {
  const opsCalls: string[] = [];
  const ops: EditorOps = {
    replaceFirstH1: (title) => {
      opsCalls.push(`replaceFirstH1:${title}`);
    },
    execVimEx: (command) => {
      opsCalls.push(`execVimEx:${command}`);
      return options.execVimEx ?? true;
    },
  };

  const note = {
    save: vi.fn(async () => options.saveResult ?? true),
    isDirty: vi.fn(() => false),
    create: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    togglePin: vi.fn(),
  };
  const workspace = {
    notify: vi.fn(),
    openHelp: vi.fn(),
    openCheatsheet: vi.fn(),
    openPinnedSwitcher: vi.fn(),
    quit: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleInspector: vi.fn(),
    share: vi.fn(),
    unshare: vi.fn(),
    updateSettings: vi.fn(),
    getSettings: vi.fn(() => ({ ...defaultSettings, wordWrap: false })),
    openSettings: vi.fn(),
    goHome: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  };
  const ctx: CommandContext = { note, workspace };

  return { ops, opsCalls, ctx, note, workspace };
}

describe("dispatchCommand", () => {
  let h: ReturnType<typeof makeHarness>;

  beforeEach(() => {
    h = makeHarness();
  });

  it("ignores empty input", async () => {
    await dispatchCommand("   ", h.ops, h.ctx);
    expect(h.note.save).not.toHaveBeenCalled();
  });

  it(":w saves the buffer", async () => {
    await dispatchCommand("w", h.ops, h.ctx);
    expect(h.note.save).toHaveBeenCalledOnce();
  });

  it(":q quits a clean buffer", async () => {
    await dispatchCommand("q", h.ops, h.ctx);
    expect(h.workspace.quit).toHaveBeenCalledOnce();
    expect(h.workspace.notify).not.toHaveBeenCalled();
  });

  it(":q refuses a dirty buffer with Vim's E37", async () => {
    h.note.isDirty.mockReturnValue(true);
    await dispatchCommand("q", h.ops, h.ctx);
    expect(h.workspace.quit).not.toHaveBeenCalled();
    expect(h.workspace.notify).toHaveBeenCalledWith(expect.stringContaining("E37"));
  });

  it(":q! quits a dirty buffer", async () => {
    h.note.isDirty.mockReturnValue(true);
    await dispatchCommand("q!", h.ops, h.ctx);
    expect(h.workspace.quit).toHaveBeenCalledOnce();
  });

  it(":wq writes then quits on success", async () => {
    await dispatchCommand("wq", h.ops, h.ctx);
    expect(h.note.save).toHaveBeenCalledOnce();
    expect(h.workspace.quit).toHaveBeenCalledOnce();
    expect(h.note.save.mock.invocationCallOrder[0]).toBeLessThan(
      h.workspace.quit.mock.invocationCallOrder[0],
    );
  });

  it(":wq does not quit when the write fails", async () => {
    h = makeHarness({ saveResult: false });
    await dispatchCommand("wq", h.ops, h.ctx);
    expect(h.workspace.quit).not.toHaveBeenCalled();
    expect(h.workspace.notify).toHaveBeenCalledWith(expect.stringContaining("E212"));
  });

  it(":new creates a note", async () => {
    await dispatchCommand("new", h.ops, h.ctx);
    expect(h.note.create).toHaveBeenCalledOnce();
  });

  it(":write and :x are aliases for :w and :wq", async () => {
    await dispatchCommand("write", h.ops, h.ctx);
    expect(h.note.save).toHaveBeenCalledOnce();
    expect(h.workspace.quit).not.toHaveBeenCalled();

    h = makeHarness();
    await dispatchCommand("x", h.ops, h.ctx);
    expect(h.note.save).toHaveBeenCalledOnce();
    expect(h.workspace.quit).toHaveBeenCalledOnce();
  });

  it(":quit is an alias for :q", async () => {
    await dispatchCommand("quit", h.ops, h.ctx);
    expect(h.workspace.quit).toHaveBeenCalledOnce();
  });

  it(":set nornu falls back to absolute line numbers", async () => {
    await dispatchCommand("set nornu", h.ops, h.ctx);
    expect(h.workspace.updateSettings).toHaveBeenCalledWith({ lineNumbers: "absolute" });
  });

  it(":rename rewrites the first H1 through the editor adapter, then saves", async () => {
    await dispatchCommand("rename My Title", h.ops, h.ctx);
    expect(h.opsCalls).toContain("replaceFirstH1:My Title");
    expect(h.note.rename).toHaveBeenCalledWith("My Title");
    expect(h.note.save).toHaveBeenCalledOnce();
  });

  it(":rename without a title notifies and changes nothing", async () => {
    await dispatchCommand("rename", h.ops, h.ctx);
    expect(h.opsCalls).toEqual([]);
    expect(h.note.save).not.toHaveBeenCalled();
    expect(h.workspace.notify).toHaveBeenCalled();
  });

  it(":delete archives and :delete! hard-deletes", async () => {
    await dispatchCommand("delete", h.ops, h.ctx);
    await dispatchCommand("delete!", h.ops, h.ctx);
    expect(h.note.delete).toHaveBeenNthCalledWith(1, false);
    expect(h.note.delete).toHaveBeenNthCalledWith(2, true);
  });

  it("routes overlay and workspace commands to their operations", async () => {
    await dispatchCommand("help", h.ops, h.ctx);
    await dispatchCommand("cheat", h.ops, h.ctx);
    await dispatchCommand("insp", h.ops, h.ctx);
    await dispatchCommand("b", h.ops, h.ctx);
    await dispatchCommand("share", h.ops, h.ctx);
    await dispatchCommand("unshare", h.ops, h.ctx);
    await dispatchCommand("pin", h.ops, h.ctx);
    expect(h.workspace.openHelp).toHaveBeenCalledOnce();
    expect(h.workspace.openCheatsheet).toHaveBeenCalledOnce();
    expect(h.workspace.toggleInspector).toHaveBeenCalledOnce();
    expect(h.workspace.toggleSidebar).toHaveBeenCalledOnce();
    expect(h.workspace.share).toHaveBeenCalledOnce();
    expect(h.workspace.unshare).toHaveBeenCalledOnce();
    expect(h.note.togglePin).toHaveBeenCalledOnce();
  });

  it(":set maps app display options onto settings", async () => {
    await dispatchCommand("set nu", h.ops, h.ctx);
    await dispatchCommand("set nonu", h.ops, h.ctx);
    await dispatchCommand("set rnu", h.ops, h.ctx);
    await dispatchCommand("set wrap", h.ops, h.ctx);
    await dispatchCommand("set nowrap", h.ops, h.ctx);
    await dispatchCommand("set ts=4", h.ops, h.ctx);
    expect(h.workspace.updateSettings).toHaveBeenNthCalledWith(1, { lineNumbers: "absolute" });
    expect(h.workspace.updateSettings).toHaveBeenNthCalledWith(2, { lineNumbers: "off" });
    expect(h.workspace.updateSettings).toHaveBeenNthCalledWith(3, { lineNumbers: "hybrid" });
    expect(h.workspace.updateSettings).toHaveBeenNthCalledWith(4, { wordWrap: true });
    expect(h.workspace.updateSettings).toHaveBeenNthCalledWith(5, { wordWrap: false });
    expect(h.workspace.updateSettings).toHaveBeenNthCalledWith(6, { tabSize: 4 });
  });

  it(":set wrap toggles off the currently-on state instead of only ever forcing it on", async () => {
    h.workspace.getSettings = vi.fn(() => ({ ...defaultSettings, wordWrap: true }));
    await dispatchCommand("set wrap", h.ops, h.ctx);
    expect(h.workspace.updateSettings).toHaveBeenCalledWith({ wordWrap: false });
  });

  it(":set rejects an unknown app option with E518", async () => {
    await dispatchCommand("set bogus", h.ops, h.ctx);
    expect(h.workspace.updateSettings).not.toHaveBeenCalled();
    expect(h.workspace.notify).toHaveBeenCalledWith(expect.stringContaining("E518"));
  });

  it(":pins opens the pinned-notes switcher", async () => {
    await dispatchCommand("pins", h.ops, h.ctx);
    expect(h.workspace.openPinnedSwitcher).toHaveBeenCalledOnce();
  });

  it(":home navigates to the Dashboard", async () => {
    await dispatchCommand("home", h.ops, h.ctx);
    expect(h.workspace.goHome).toHaveBeenCalledOnce();
  });

  it(":set with no option opens Settings instead of erroring", async () => {
    await dispatchCommand("set", h.ops, h.ctx);
    expect(h.workspace.openSettings).toHaveBeenCalledOnce();
    expect(h.workspace.updateSettings).not.toHaveBeenCalled();
    expect(h.workspace.notify).not.toHaveBeenCalled();
  });

  it(":login and :logout route to their operations", async () => {
    await dispatchCommand("login", h.ops, h.ctx);
    await dispatchCommand("logout", h.ops, h.ctx);
    expect(h.workspace.login).toHaveBeenCalledOnce();
    expect(h.workspace.logout).toHaveBeenCalledOnce();
  });

  it("falls unknown commands through to genuine Vim ex commands", async () => {
    await dispatchCommand("sort", h.ops, h.ctx);
    expect(h.opsCalls).toContain("execVimEx:sort");
    expect(h.workspace.notify).not.toHaveBeenCalled();
  });

  it("reports E492 when the Vim ex fall-through does not handle the command", async () => {
    h = makeHarness({ execVimEx: false });
    await dispatchCommand("totally-not-a-command", h.ops, h.ctx);
    expect(h.workspace.notify).toHaveBeenCalledWith(expect.stringContaining("E492"));
  });
});

describe("resolveDeleteMode", () => {
  it("purges an empty buffer and archives a non-empty one", () => {
    expect(resolveDeleteMode(false, "   \n  ")).toBe("purge");
    expect(resolveDeleteMode(false, "# Title\n\nsome body")).toBe("archive");
  });

  it("purges any buffer when forced with :delete!", () => {
    expect(resolveDeleteMode(true, "# Title\n\nsome body")).toBe("purge");
  });
});
