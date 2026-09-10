"use client";

import { create } from "zustand";

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

  // Desktop (>=1024px): docked collapse, shifts the main content padding.
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Below 1024px: the sidebar is an overlay drawer instead of docked
  // (design system's own breakpoint rule), governed independently so
  // opening it never shifts buffer content.
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  commandDockOpen: boolean;
  setCommandDockOpen: (open: boolean) => void;

  quickSwitcherOpen: boolean;
  setQuickSwitcherOpen: (open: boolean) => void;

  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  inspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;

  // Set by whichever note buffer is mounted, so the global fixed footer
  // (which lives above the per-route page tree) can show it.
  activeFilename: string | null;
  setActiveFilename: (name: string | null) => void;
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

  inspectorOpen: false,
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),

  activeFilename: null,
  setActiveFilename: (activeFilename) => set({ activeFilename }),
}));
