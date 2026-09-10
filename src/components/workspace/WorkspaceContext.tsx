"use client";

import { createContext, useContext } from "react";

export type WorkspaceApi = {
  /** The buffer currently showing, or null (home not yet resolved / no notes). */
  activeNoteId: string | null;
  /** A real buffer switch: instant client state, pushes history. */
  openNote: (noteId: string) => void;
  /** Resolve and open the most-recently-updated non-archived note (bare `/notes`, or after closing the active buffer). */
  goHome: () => void;
  /** `:new` / Ctrl+N -- creates a note in the cache and opens it in one step. */
  createAndOpenNote: () => void;
};

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function useWorkspace(): WorkspaceApi {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}

export const WorkspaceContextProvider = WorkspaceContext.Provider;
