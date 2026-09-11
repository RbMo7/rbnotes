"use client";

import { create } from "zustand";
import { defaultSettings, type Settings } from "@/lib/schemas";

export type VimMode = "NORMAL" | "INSERT" | "VISUAL" | "EDIT" | "RO";
export type SaveState = "clean" | "dirty" | "saving" | "error";

type WorkspaceState = {
  mode: VimMode;
  setMode: (mode: VimMode) => void;

  cursorLine: number;
  cursorCol: number;
  setCursor: (line: number, col: number) => void;

  saveState: SaveState;
  setSaveState: (state: SaveState) => void;

  // Which notes currently hold unsaved local edits, keyed by noteId --
  // shared between autosave (the sole writer) and the warm-up loop, which
  // must never fetch-and-overwrite a buffer the user is actively editing.
  // A plain object (not a Set) so it round-trips through Zustand's default
  // equality-by-reference the same way every other field here does.
  dirtyNoteIds: Record<string, true>;
  setNoteDirty: (noteId: string, dirty: boolean) => void;

  // The active buffer registers its write here, so the shell's global
  // Ctrl+S (which lives above the per-route page tree) can reach the one
  // editor that is actually mounted. Null outside a note buffer.
  saveActive: (() => void) | null;
  registerActiveSave: (save: (() => void) | null) => void;

  // Desktop (>=1024px): docked collapse, shifts the main content padding.
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Below 1024px: Sidebar (when it renders at all -- see its own doc
  // comment) is an overlay drawer instead of docked, governed independently
  // so opening it never shifts buffer content.
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  commandDockOpen: boolean;
  setCommandDockOpen: (open: boolean) => void;

  quickSwitcherOpen: boolean;
  setQuickSwitcherOpen: (open: boolean) => void;

  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // One-shot handoff from a global-search result click to the note buffer
  // it navigates to: WorkspaceBuffer reads and clears this once on mount
  // (see SettingsHydrator for the same "consume the initial value once"
  // pattern) so the editor can select the matched text instead of just
  // opening the note at whatever the cursor last was.
  pendingSearchMatch: { noteId: string; query: string } | null;
  setPendingSearchMatch: (match: { noteId: string; query: string } | null) => void;

  // A query typed elsewhere (the sidebar filter's `/` escalation, the
  // Dashboard's search box) that should seed SearchPalette the moment it
  // opens. Consumed once, same pattern as pendingSearchMatch.
  searchSeed: string | null;
  setSearchSeed: (seed: string | null) => void;
  openSearchWith: (query: string) => void;

  // A pulse counter (not a boolean) so SidebarLists can react even if the
  // sidebar's Tags tab and filter box are already focused when Ctrl+T is
  // pressed again -- an unchanged boolean's effect wouldn't re-fire, but an
  // incrementing counter always produces a new value to key off.
  focusTagsRequestId: number;
  requestFocusTags: () => void;

  inspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;

  // Set by whichever note buffer is mounted, so the global fixed footer
  // (which lives above the per-route page tree) can show it.
  activeFilename: string | null;
  setActiveFilename: (name: string | null) => void;

  // The rest of the buffer sub-header's old detail line (created date, word
  // count, SHA hash), now shown in the footer instead -- the header itself
  // is just the title. Derived values, not raw content: the store
  // deliberately never holds note content (see the module doc), and word
  // count/hash only need to be as fresh as note.content already is (i.e.
  // last-saved, not live-per-keystroke -- same staleness the old header
  // had). Null outside a note buffer, or while it's still cold.
  activeBufferInfo: { wordCount: number; hash: string; createdAt: string } | null;
  setActiveBufferInfo: (info: WorkspaceState["activeBufferInfo"]) => void;

  // Editor display settings. Seeded once from the server at the top of the
  // (app) layout (SettingsHydrator) so both the Settings page and every
  // open note read and write the exact same values -- changing a setting
  // in one place is reflected everywhere without a reload.
  settings: Settings;
  setSettings: (settings: Settings) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  // Whether this session is Synced (CONTEXT.md) -- signed in -- vs.
  // Local-only (anonymous). Seeded once from the server (SettingsHydrator,
  // alongside settings) so notes-query.ts and useAutosave can read it
  // without prop-drilling `email` through every consumer of the shared
  // notes cache. Defaults true so anything that reads it before the
  // hydrator runs (or in a test that never sets it) keeps today's
  // always-signed-in behavior rather than silently going Local-only.
  syncEnabled: boolean;
  setSyncEnabled: (syncEnabled: boolean) => void;
};

/**
 * Shared UI state for the workspace shell (chrome: sidebar, header, footer,
 * overlays). Deliberately does NOT hold note content or cursor internals
 * beyond display position — the editor owns its own text in CodeMirror
 * state, so a note-list refresh here never re-renders the editor.
 */
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mode: "NORMAL",
  setMode: (mode) => set({ mode }),

  cursorLine: 1,
  cursorCol: 1,
  setCursor: (cursorLine, cursorCol) => set({ cursorLine, cursorCol }),

  saveState: "clean",
  setSaveState: (saveState) => set({ saveState }),

  dirtyNoteIds: {},
  setNoteDirty: (noteId, dirty) =>
    set((s) => {
      if (dirty) {
        if (s.dirtyNoteIds[noteId]) return s;
        return { dirtyNoteIds: { ...s.dirtyNoteIds, [noteId]: true } };
      }
      if (!s.dirtyNoteIds[noteId]) return s;
      const rest = { ...s.dirtyNoteIds };
      delete rest[noteId];
      return { dirtyNoteIds: rest };
    }),

  saveActive: null,
  registerActiveSave: (saveActive) => set({ saveActive }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  mobileSidebarOpen: false,
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),

  commandDockOpen: false,
  setCommandDockOpen: (commandDockOpen) => set({ commandDockOpen }),

  quickSwitcherOpen: false,
  setQuickSwitcherOpen: (quickSwitcherOpen) => set({ quickSwitcherOpen }),

  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),

  pendingSearchMatch: null,
  setPendingSearchMatch: (pendingSearchMatch) => set({ pendingSearchMatch }),

  searchSeed: null,
  setSearchSeed: (searchSeed) => set({ searchSeed }),
  openSearchWith: (searchSeed) => set({ searchSeed, searchOpen: true }),

  focusTagsRequestId: 0,
  requestFocusTags: () => set((s) => ({ focusTagsRequestId: s.focusTagsRequestId + 1 })),

  inspectorOpen: false,
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),

  activeFilename: null,
  setActiveFilename: (activeFilename) => set({ activeFilename }),

  activeBufferInfo: null,
  setActiveBufferInfo: (activeBufferInfo) => set({ activeBufferInfo }),

  settings: defaultSettings,
  setSettings: (settings) => set({ settings }),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  // false until SettingsHydrator's lazy useState initializer corrects it
  // from the real session -- Local-only is the safe default while that
  // hasn't run yet (first paint, a stray re-mount, dev Fast Refresh). The
  // dangerous direction is defaulting to true: useAutosave would then
  // attempt a real server push for a session that's actually anonymous,
  // which hits getAuthedUser()'s redirect("/login").
  syncEnabled: false,
  setSyncEnabled: (syncEnabled) => set({ syncEnabled }),
}));

/**
 * An imperative (non-subscribing) read of dirtyNoteIds, for the two callers
 * that need "is this note dirty right now" as a plain predicate rather than
 * a reactive hook value: warm-up (must never fetch-and-overwrite a buffer
 * mid-edit) and cold-open (must never jump the queue for one either).
 */
export function isNoteDirty(noteId: string): boolean {
  return !!useWorkspaceStore.getState().dirtyNoteIds[noteId];
}
