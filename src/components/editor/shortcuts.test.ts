import { describe, it, expect, vi } from "vitest";
import {
  matchGlobalShortcut,
  dispatchIntent,
  GLOBAL_SHORTCUTS,
  type IntentHandlers,
} from "@/components/editor/shortcuts";

// A plain stub: the predicate only reads these four fields, so the pure test
// needs no DOM.
function key(init: KeyboardEventInit): KeyboardEvent {
  return {
    key: init.key ?? "",
    ctrlKey: !!init.ctrlKey,
    metaKey: !!init.metaKey,
    altKey: !!init.altKey,
  } as unknown as KeyboardEvent;
}

describe("matchGlobalShortcut", () => {
  it("maps Ctrl+N to a new note from any mode", () => {
    expect(matchGlobalShortcut(key({ key: "n", ctrlKey: true }), "NORMAL")).toEqual({
      type: "newNote",
    });
    expect(matchGlobalShortcut(key({ key: "N", ctrlKey: true }), "INSERT")).toEqual({
      type: "newNote",
    });
  });

  it("maps Ctrl+S to a save even outside the editor (no mode)", () => {
    expect(matchGlobalShortcut(key({ key: "s", ctrlKey: true }), null)).toEqual({
      type: "save",
    });
  });

  it("maps Ctrl+P and Ctrl+B to their overlays/sidebar from both contexts", () => {
    expect(matchGlobalShortcut(key({ key: "p", ctrlKey: true }), null)).toEqual({
      type: "openQuickSwitcher",
    });
    expect(matchGlobalShortcut(key({ key: "b", ctrlKey: true }), "NORMAL")).toEqual({
      type: "toggleSidebar",
    });
  });

  it("regression (44ade68, e9ee86d): Ctrl+/ opens global search from inside and outside the editor", () => {
    expect(matchGlobalShortcut(key({ key: "/", ctrlKey: true }), "NORMAL")).toEqual({
      type: "openSearch",
    });
    expect(matchGlobalShortcut(key({ key: "/", ctrlKey: true }), null)).toEqual({
      type: "openSearch",
    });
  });

  it("maps Ctrl+T to focusTags from both contexts", () => {
    expect(matchGlobalShortcut(key({ key: "t", ctrlKey: true }), "NORMAL")).toEqual({
      type: "focusTags",
    });
    expect(matchGlobalShortcut(key({ key: "t", ctrlKey: true }), null)).toEqual({
      type: "focusTags",
    });
  });

  it("accepts Cmd (meta) as the modifier too", () => {
    expect(matchGlobalShortcut(key({ key: "n", metaKey: true }), "NORMAL")).toEqual({
      type: "newNote",
    });
  });

  it("regression (44ade68): ':' opens the command dock only in NORMAL mode", () => {
    expect(matchGlobalShortcut(key({ key: ":" }), "NORMAL")).toEqual({
      type: "openCommandDock",
    });
    expect(matchGlobalShortcut(key({ key: ":" }), "INSERT")).toBeNull();
    expect(matchGlobalShortcut(key({ key: ":" }), "VISUAL")).toBeNull();
  });

  it("never opens the command dock outside the editor (no mode) or with a modifier", () => {
    expect(matchGlobalShortcut(key({ key: ":" }), null)).toBeNull();
    expect(matchGlobalShortcut(key({ key: ":", ctrlKey: true }), "NORMAL")).toBeNull();
  });

  it("ignores unmodified letter keys and unknown chords", () => {
    expect(matchGlobalShortcut(key({ key: "n" }), "NORMAL")).toBeNull();
    expect(matchGlobalShortcut(key({ key: "q", ctrlKey: true }), "NORMAL")).toBeNull();
  });

  it("ignores Alt chords", () => {
    expect(matchGlobalShortcut(key({ key: "n", ctrlKey: true, altKey: true }), "NORMAL")).toBeNull();
  });
});

describe("dispatchIntent", () => {
  it("routes each intent to its handler", () => {
    const handlers: IntentHandlers = {
      save: vi.fn(),
      newNote: vi.fn(),
      openQuickSwitcher: vi.fn(),
      openSearch: vi.fn(),
      toggleSidebar: vi.fn(),
      openCommandDock: vi.fn(),
      focusTags: vi.fn(),
    };

    dispatchIntent({ type: "save" }, handlers);
    dispatchIntent({ type: "newNote" }, handlers);
    dispatchIntent({ type: "openQuickSwitcher" }, handlers);
    dispatchIntent({ type: "openSearch" }, handlers);
    dispatchIntent({ type: "toggleSidebar" }, handlers);
    dispatchIntent({ type: "openCommandDock" }, handlers);
    dispatchIntent({ type: "focusTags" }, handlers);

    expect(handlers.save).toHaveBeenCalledOnce();
    expect(handlers.newNote).toHaveBeenCalledOnce();
    expect(handlers.openQuickSwitcher).toHaveBeenCalledOnce();
    expect(handlers.openSearch).toHaveBeenCalledOnce();
    expect(handlers.toggleSidebar).toHaveBeenCalledOnce();
    expect(handlers.openCommandDock).toHaveBeenCalledOnce();
    expect(handlers.focusTags).toHaveBeenCalledOnce();
  });
});

describe("GLOBAL_SHORTCUTS", () => {
  it("has a display row for every matchable intent except the command dock's ':')", () => {
    const intents = GLOBAL_SHORTCUTS.map((s) => s.intent.type);
    expect(intents).toContain("save");
    expect(intents).toContain("newNote");
    expect(intents).toContain("openQuickSwitcher");
    expect(intents).toContain("openSearch");
    expect(intents).toContain("toggleSidebar");
    expect(intents).toContain("focusTags");
  });

  it("every row carries a label and a description for help", () => {
    for (const s of GLOBAL_SHORTCUTS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it("exposes exactly the modifier chords in global help", () => {
    const globalLabels = GLOBAL_SHORTCUTS.filter((s) => s.inGlobalHelp).map((s) => s.label);
    expect(globalLabels).toEqual(["Ctrl+S", "Ctrl+N", "Ctrl+P", "Ctrl+B", "Ctrl+/", "Ctrl+T"]);
    // The editor-only command-line row stays out of the global section.
    expect(GLOBAL_SHORTCUTS.find((s) => s.id === "command-line")?.inGlobalHelp).toBe(false);
  });
});
