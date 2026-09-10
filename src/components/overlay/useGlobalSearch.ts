"use client";

import { useEffect, useState } from "react";
import { searchNotesAction } from "@/server/actions/notes";
import { isFullyWarm } from "@/lib/notes-query";
import type { NoteRecord } from "@/lib/note-types";
import { searchWarmCache, fromServerHits, type SearchResult } from "@/components/overlay/global-search";

const SERVER_DEBOUNCE_MS = 150;

/**
 * Hybrid resolution: once every note in the cache is warm, search reads it
 * directly (instant, complete, works offline). Until then -- the first few
 * seconds after load, while the background warm-up loop is still filling
 * in -- a local-only search could silently miss a note whose content
 * hasn't arrived, so this falls back to the server, which has no such gap.
 * The overlay itself never blocks on either branch: it opens instantly
 * either way, and the warm-cache branch never even touches the network.
 */
export function useGlobalSearch(
  query: string,
  notes: NoteRecord[],
): { source: "cache" | "server"; loading: boolean; results: SearchResult[] } {
  const warm = isFullyWarm(notes);
  const [serverResults, setServerResults] = useState<SearchResult[]>([]);
  const [serverLoading, setServerLoading] = useState(false);

  useEffect(() => {
    if (warm) return;
    const q = query.trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setServerResults([]);
      return;
    }
    let cancelled = false;
    setServerLoading(true);
    const timer = setTimeout(() => {
      searchNotesAction({ query: q })
        .then((hits) => {
          if (!cancelled) setServerResults(fromServerHits(hits));
        })
        .catch(() => {
          if (!cancelled) setServerResults([]);
        })
        .finally(() => {
          if (!cancelled) setServerLoading(false);
        });
    }, SERVER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [warm, query]);

  if (warm) {
    return { source: "cache", loading: false, results: searchWarmCache(notes, query) };
  }
  return { source: "server", loading: serverLoading, results: serverResults };
}
