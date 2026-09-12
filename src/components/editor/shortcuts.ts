import type { VimMode } from "@/lib/store";

/**
 * The intent set, declared once. `Intent`, `IntentHandlers`, and
 * `dispatchIntent` all derive from this map, so adding an intent is a
 * single-line change here (plus its row and its handler), not edits in
 * three parallel type declarations.
 */
export type IntentMap = {
  save: true;
  newNote: true;
  openQuickSwitcher: true;
  openPinnedSwitcher: true;
  openSearch: true;
  toggleSidebar: true;
  openCommandDock: true;
  focusTags: true;
};

type IntentType = keyof IntentMap;

/** The app-level actions a global shortcut can ask for. */
export type Intent = { [K in IntentType]: { type: K } }[IntentType];

export type IntentHandlers = { [K in IntentType]: () => void };

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
  /** Requires Shift too. Defaults to false -- omitting it on every other row keeps them from also matching a Shift-held chord that shares the same key. */
  shift?: boolean;
  /** Vim modes the shortcut is legal in; empty means any mode (and no mode). */
  modes: VimMode[];
  /**
   * Whether this row belongs in the help buffer's GLOBAL section. Explicit
   * so a new global row can never silently fail to appear; editor-only rows
   * (the ':') are listed in their own mode section instead.
   */
  inGlobalHelp: boolean;
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
    inGlobalHelp: true,
    intent: { type: "save" },
  },
  {
    id: "new-note",
    label: "Ctrl+N",
    description: "new note",
    key: "n",
    ctrl: true,
    modes: [],
    inGlobalHelp: true,
    intent: { type: "newNote" },
  },
  {
    id: "quick-switcher",
    label: "Ctrl+P",
    description: "quick switcher",
    key: "p",
    ctrl: true,
    modes: [],
    inGlobalHelp: true,
    intent: { type: "openQuickSwitcher" },
  },
  {
    id: "pinned-switcher",
    label: "Ctrl+Shift+P",
    description: "pinned notes switcher",
    key: "p",
    ctrl: true,
    shift: true,
    modes: [],
    inGlobalHelp: true,
    intent: { type: "openPinnedSwitcher" },
  },
  {
    id: "toggle-sidebar",
    label: "Ctrl+B",
    description: "toggle sidebar",
    key: "b",
    ctrl: true,
    modes: [],
    inGlobalHelp: true,
    intent: { type: "toggleSidebar" },
  },
  {
    id: "search",
    label: "Ctrl+/",
    description: "search every note",
    key: "/",
    ctrl: true,
    modes: [],
    inGlobalHelp: true,
    intent: { type: "openSearch" },
  },
  {
    id: "focus-tags",
    label: "Ctrl+T",
    description: "open tags, focus search",
    key: "t",
    ctrl: true,
    modes: [],
    inGlobalHelp: true,
    intent: { type: "focusTags" },
  },
  {
    id: "command-line",
    label: ":",
    description: "command line",
    key: ":",
    ctrl: false,
    modes: ["NORMAL"],
    inGlobalHelp: false,
    intent: { type: "openCommandDock" },
  },
];

/**
 * The one predicate: keydown + current vim mode -> Intent, or nothing.
 * `mode` is null exclusively for the shell-level listener (AppShell), which
 * fires when there's no editor mounted/focused at all -- Editor.tsx's own
 * listener always passes a real mode ("EDIT" as the vim-off sentinel, never
 * null; see its handleCapture doc). So `mode === null` unambiguously means
 * "no editor to misfire a plain `:` keystroke into," and mode-gated
 * shortcuts are allowed through in that case; a *mounted* editor in the
 * wrong mode (e.g. INSERT) still blocks them, so `:` keeps typing a literal
 * colon there instead of opening the command dock.
 */
export function matchGlobalShortcut(
  event: KeyboardEvent,
  mode: VimMode | null,
): Intent | null {
  const ctrl = event.ctrlKey || event.metaKey;

  for (const shortcut of GLOBAL_SHORTCUTS) {
    if (shortcut.ctrl !== ctrl) continue;
    if (event.altKey) continue;
    // Only chorded (ctrl) shortcuts care about Shift as an independent
    // disambiguator (Ctrl+P vs Ctrl+Shift+P) -- a bare character key like
    // ':' or '?' already bakes Shift into which character was produced
    // (':' IS Shift+';' on a US layout), so checking shiftKey there too
    // rejected every plain ':' keydown outright (shortcut.shift defaults
    // to false, but event.shiftKey is genuinely true for ':').
    if (shortcut.ctrl && event.shiftKey !== (shortcut.shift ?? false)) continue;
    if (event.key.toLowerCase() !== shortcut.key) continue;
    if (shortcut.modes.length > 0 && mode !== null && !shortcut.modes.includes(mode)) {
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
  handlers[intent.type]();
}
