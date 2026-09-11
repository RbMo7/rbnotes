"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { displayFilename } from "@/lib/format";
import { useNotesQuery } from "@/lib/notes-query";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { useGlobalSearch } from "@/components/overlay/useGlobalSearch";
import { RESPONSIVE_DIALOG_CONTENT } from "@/components/overlay/dialog-classes";

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-on-surface">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/**
 * Ctrl+/ from anywhere -- searches note titles and content. See
 * useGlobalSearch for the warm-cache-vs-server-fallback resolution order.
 */
export function SearchPalette() {
  const open = useWorkspaceStore((s) => s.searchOpen);
  const setOpen = useWorkspaceStore((s) => s.setSearchOpen);
  const setPendingSearchMatch = useWorkspaceStore((s) => s.setPendingSearchMatch);
  const searchSeed = useWorkspaceStore((s) => s.searchSeed);
  const setSearchSeed = useWorkspaceStore((s) => s.setSearchSeed);
  const { data: notes = [] } = useNotesQuery();
  const { openNote } = useWorkspace();
  const [query, setQuery] = useState("");

  const { results, loading } = useGlobalSearch(query, notes);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      return;
    }
    if (searchSeed !== null) {
      setQuery(searchSeed);
      setSearchSeed(null); // consume once, same pattern as pendingSearchMatch
    }
  }, [open, searchSeed, setSearchSeed]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[60]" />
        <Dialog.Content className={`${RESPONSIVE_DIALOG_CONTENT} shadow-2xl`}>
          <Dialog.Title className="sr-only">Search notes</Dialog.Title>
          <div className="flex items-center gap-space-2 px-space-4 py-space-3 border-b border-outline-variant shrink-0">
            <span className="text-primary font-bold">/</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search titles and content..."
              className="flex-1 bg-transparent outline-none border-none text-on-surface placeholder-on-surface-variant/40"
              aria-label="Search"
            />
            {loading && <span className="text-outline text-label-sm font-label-sm">…</span>}
            <Dialog.Close asChild>
              <button aria-label="Close search" className="sm:hidden text-on-surface-variant hover:text-on-surface p-space-1 -mr-space-1">
                <X size={18} strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 sm:flex-none sm:max-h-96 overflow-y-auto py-space-2">
            {query && !loading && results.length === 0 && (
              <p className="px-space-4 py-space-2 font-body-sm text-body-sm text-outline/50">
                ~ no matches
              </p>
            )}
            {results.map((result) => (
              <button
                key={result.noteId}
                onClick={() => {
                  setOpen(false);
                  // Consumed once by WorkspaceBuffer on activation (see
                  // store.ts) to select the matched text instead of just
                  // opening the note at wherever the cursor last was. If
                  // the query doesn't literally appear in the content (a
                  // title-only match, say), Editor.tsx's lookup simply
                  // finds nothing and this is a no-op.
                  setPendingSearchMatch({ noteId: result.noteId, query });
                  openNote(result.noteId);
                }}
                className="w-full flex flex-col gap-space-1 px-space-4 py-space-2 text-left hover:bg-surface-container-high"
              >
                <span className="flex items-center gap-space-2 font-body-sm text-body-sm text-on-surface">
                  <FileText size={14} strokeWidth={1.5} className="text-outline shrink-0" />
                  {highlight(displayFilename(result.title), query)}
                </span>
                {result.snippet && (
                  <span className="pl-space-6 font-label-sm text-label-sm text-on-surface-variant truncate">
                    {highlight(result.snippet, query)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
