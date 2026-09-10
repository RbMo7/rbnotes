"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notesQueryKey } from "@/lib/note-types";
import type { NoteRecord } from "@/lib/note-types";
import { warmNoteContent } from "@/lib/notes-query";
import { runWarmUpLoop } from "@/lib/warm-up";
import { isNoteDirty } from "@/lib/store";

const STAGGER_MS = 200;

/**
 * Starts the background warm-up loop once, after first paint, and lets it
 * run until every note is warm or the workspace unmounts. Nothing in this
 * hook is itself visible -- see lib/warm-up.ts for the ordering/cadence and
 * lib/notes-query.ts's warmNoteContent for the skip-dirty and
 * stale-never-clobbers guarantees.
 */
export function useWarmUpScheduler(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const controller = new AbortController();
    void runWarmUpLoop({
      getNotes: () => queryClient.getQueryData<NoteRecord[]>(notesQueryKey) ?? [],
      warmOne: (noteId) => warmNoteContent(queryClient, noteId, isNoteDirty),
      delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      staggerMs: STAGGER_MS,
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [queryClient]);
}
