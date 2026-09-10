"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { displayFilename } from "@/lib/format";
import { useNotesQuery } from "@/lib/notes-query";

function matchedLine(content: string, query: string): string | null {
  const q = query.toLowerCase();
  const line = content.split("\n").find((l) => l.toLowerCase().includes(q));
  return line?.trim().slice(0, 120) ?? null;
}

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
 * `/` from anywhere outside the editor -- searches note titles and content.
 * Filters the already-loaded notes-query cache in memory instead of
 * calling the server per keystroke, so results are instant with no
 * debounce needed.
 */
export function SearchPalette() {
  const open = useWorkspaceStore((s) => s.searchOpen);
  const setOpen = useWorkspaceStore((s) => s.setSearchOpen);
  const setPendingSearchMatch = useWorkspaceStore((s) => s.setPendingSearchMatch);
  const { data: notes = [] } = useNotesQuery();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return notes
      .filter((n) => !n.archived && (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 30);
  }, [notes, query]);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[60]" />
        <Dialog.Content className="fixed left-1/2 top-[20vh] -translate-x-1/2 w-[90vw] max-w-[38rem] bg-surface-container border border-outline-variant shadow-2xl z-[61] font-code-editor text-code-editor">
          <Dialog.Title className="sr-only">Search notes</Dialog.Title>
          <div className="flex items-center gap-space-2 px-space-4 py-space-3 border-b border-outline-variant">
            <span className="text-primary font-bold">/</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search titles and content..."
              className="flex-1 bg-transparent outline-none border-none text-on-surface placeholder-on-surface-variant/40"
              aria-label="Search"
            />
          </div>
          <div className="max-h-96 overflow-y-auto py-space-2">
            {query && results.length === 0 && (
              <p className="px-space-4 py-space-2 font-body-sm text-body-sm text-outline/50">
                ~ no matches
              </p>
            )}
            {results.map((note) => {
              const snippet = matchedLine(note.content, query);
              return (
                <button
                  key={note.id}
                  onClick={() => {
                    setOpen(false);
                    // Consumed once by BufferWorkspace on mount (see
                    // store.ts) to select the matched text instead of
                    // just opening the note at wherever the cursor last
                    // was. If the query doesn't literally appear in the
                    // content (a title-only match, say), Editor.tsx's
                    // lookup simply finds nothing and this is a no-op.
                    setPendingSearchMatch({ noteId: note.id, query });
                    router.push(`/notes/${note.id}`);
                  }}
                  className="w-full flex flex-col gap-space-1 px-space-4 py-space-2 text-left hover:bg-surface-container-high"
                >
                  <span className="flex items-center gap-space-2 font-body-sm text-body-sm text-on-surface">
                    <FileText size={14} strokeWidth={1.5} className="text-outline shrink-0" />
                    {highlight(displayFilename(note.title), query)}
                  </span>
                  {snippet && (
                    <span className="pl-space-6 font-label-sm text-label-sm text-on-surface-variant truncate">
                      {highlight(snippet, query)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
