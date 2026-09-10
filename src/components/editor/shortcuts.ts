import type { VimMode } from "@/lib/store";

/** The app-level actions a global shortcut can ask for. */
export type Intent =
  | { type: "save" }
  | { type: "newNote" }
  | { type: "openQuickSwitcher" }
  | { type: "openSearch" }
  | { type: "toggleSidebar" }
  | { type: "openCommandDock" };

export type IntentHandlers = {
  save: () => void;
  newNote: () => void;
  openQuickSwitcher: () => void;
  openSearch: () => void;
  toggleSidebar: () => void;
  openCommandDock: () => void;
};

/**
 * The one table of global shortcuts. Both key listeners -- the editor's
 * capture-phase listener and the shell's document-level listener -- are
 * adapters over `matchGlobalShortcut`; help renders the same rows. Adding a
 * shortcut means one row here, not an edit in each listener (which is how
 * the two historical `/` bugs happened).
 */
export type GlobalShortcut = {
  id: string;
  /** Display label for the help buffer, e.g. "Ctrl+N" or ":". */
  label: string;
  description: string;
  /** Lowercased `KeyboardEvent.key` to match. */
  key: string;
  ctrl: boolean;
  /** Vim modes the shortcut is legal in; empty means any mode (and no mode). */
  modes: VimMode[];
  intent: Intent;
};

export const GLOBAL_SHORTCUTS: GlobalShortcut[] = [
  {
    id: "save",
    label: "Ctrl+S",
    description: "force write",
    key: "s",
    ctrl: true,
    modes: [],
    intent: { type: "save" },
  },
  {
    id: "new-note",
    label: "Ctrl+N",
    description: "new note",
    key: "n",
    ctrl: true,
    modes: [],
    intent: { type: "newNote" },
  },
  {
    id: "quick-switcher",
    label: "Ctrl+P",
    description: "quick switcher",
    key: "p",
    ctrl: true,
    modes: [],
    intent: { type: "openQuickSwitcher" },
  },
  {
    id: "toggle-sidebar",
    label: "Ctrl+B",
    description: "toggle sidebar",
    key: "b",
    ctrl: true,
    modes: [],
    intent: { type: "toggleSidebar" },
  },
  {
    id: "search",
    label: "Ctrl+/",
    description: "search every note",
    key: "/",
    ctrl: true,
    modes: [],
    intent: { type: "openSearch" },
  },
  {
    id: "command-line",
    label: ":",
    description: "command line",
    key: ":",
    ctrl: false,
    modes: ["NORMAL"],
    intent: { type: "openCommandDock" },
  },
];

/**
 * The one predicate: keydown + current vim mode -> Intent, or nothing.
 * `mode` is null when focus is outside the editor (or vim is off), which is
 * why mode-gated shortcuts (only `:` today) simply never match there.
 */
export function matchGlobalShortcut(
  event: KeyboardEvent,
  mode: VimMode | null,
): Intent | null {
  const ctrl = event.ctrlKey || event.metaKey;

  for (const shortcut of GLOBAL_SHORTCUTS) {
    if (shortcut.ctrl !== ctrl) continue;
    if (event.altKey) continue;
    if (event.key.toLowerCase() !== shortcut.key) continue;
    if (shortcut.modes.length > 0 && (mode === null || !shortcut.modes.includes(mode))) {
      continue;
    }
    return shortcut.intent;
  }
  return null;
}

/**
 * Single dispatcher for intents, so the two listeners don't each re-implement
 * intent -> effect. Pure apart from the handlers it is given.
 */
export function dispatchIntent(intent: Intent, handlers: IntentHandlers): void {
  switch (intent.type) {
    case "save":
      handlers.save();
      return;
    case "newNote":
      handlers.newNote();
      return;
    case "openQuickSwitcher":
      handlers.openQuickSwitcher();
      return;
    case "openSearch":
      handlers.openSearch();
      return;
    case "toggleSidebar":
      handlers.toggleSidebar();
      return;
    case "openCommandDock":
      handlers.openCommandDock();
      return;
  }
}
