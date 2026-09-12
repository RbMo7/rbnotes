"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import { FileText, Archive, Pin, X } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { displayFilename } from "@/lib/format";
import { formatSidebarTimestamp } from "@/lib/grouping";
import { useNotesQuery } from "@/lib/notes-query";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { RESPONSIVE_DIALOG_CONTENT } from "@/components/overlay/dialog-classes";
import type { NoteRecord } from "@/lib/note-types";

type SwitcherNote = Omit<NoteRecord, "updatedAt"> & { updatedAt: Date };

/**
 * The switcher body shared by Ctrl+P's "every note" QuickSwitcher and
 * `:pins`/PinnedSwitcher's pinned-only one -- same list/search/keyboard-nav
 * dialog, just parameterized over which notes it's given and its own copy.
 * Per the design system spec: centered at 20% viewport height, 38rem wide,
 * bg-surface-container, 1px solid outline (#363D47-equivalent), no shadow --
 * unlike every other overlay in this app, this one is explicitly specified
 * with zero elevation.
 */
function NoteSwitcherDialog({
  open,
  setOpen,
  notes,
  placeholder,
  dialogTitle,
  emptyLabel,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  notes: NoteRecord[];
  placeholder: string;
  dialogTitle: string;
  emptyLabel: string;
}) {
  const { openNote: switchToNote } = useWorkspace();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo<SwitcherNote[]>(() => {
    const q = query.trim().toLowerCase();
    const list = q ? notes.filter((n) => n.title.toLowerCase().includes(q)) : notes;
    return list.slice(0, 20).map((n) => ({ ...n, updatedAt: new Date(n.updatedAt) }));
  }, [notes, query]);

  const openNote = (id: string) => {
    setOpen(false);
    setQuery("");
    switchToNote(id);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[60]" />
        <Dialog.Content
          className={RESPONSIVE_DIALOG_CONTENT}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "j")) {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "k")) {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && filtered[activeIndex]) {
              e.preventDefault();
              openNote(filtered[activeIndex].id);
            }
          }}
        >
          <Dialog.Title className="sr-only">{dialogTitle}</Dialog.Title>
          <div className="flex items-center gap-space-2 px-space-4 py-space-3 border-b border-outline-variant shrink-0">
            <span className="text-primary font-bold">&gt;</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none border-none text-on-surface placeholder-on-surface-variant/40"
              aria-label={dialogTitle}
            />
            <span className="w-2 h-4 bg-primary inline-block animate-pulse" />
            <Dialog.Close asChild>
              <button aria-label={`Close ${dialogTitle.toLowerCase()}`} className="sm:hidden text-on-surface-variant hover:text-on-surface p-space-1 -mr-space-1">
                <X size={18} strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </div>
          <div role="listbox" className="flex-1 sm:flex-none sm:max-h-80 overflow-y-auto py-space-2">
            {filtered.length === 0 && (
              <p className="px-space-4 py-space-2 font-body-sm text-body-sm text-outline/50">
                {emptyLabel}
              </p>
            )}
            {filtered.map((note, i) => {
              const Icon = note.archived ? Archive : note.pinned ? Pin : FileText;
              return (
                <button
                  key={note.id}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => openNote(note.id)}
                  className={`w-full flex items-center justify-between px-space-4 py-space-2 font-body-sm text-body-sm text-left ${
                    i === activeIndex
                      ? "bg-surface-container-high text-on-surface"
                      : "text-on-surface-variant"
                  }`}
                >
                  <span className="flex items-center gap-space-2 truncate">
                    <Icon size={14} strokeWidth={1.5} className="text-outline shrink-0" />
                    <span className="truncate" title={displayFilename(note.title)}>
                      {displayFilename(note.title)}
                    </span>
                  </span>
                  <span className="font-label-sm text-label-sm text-outline/70 shrink-0">
                    {formatSidebarTimestamp(note.updatedAt)}
                  </span>
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Ctrl+P -- every note, most-recent first (whatever order useNotesQuery already returns). */
export function QuickSwitcher() {
  const open = useWorkspaceStore((s) => s.quickSwitcherOpen);
  const setOpen = useWorkspaceStore((s) => s.setQuickSwitcherOpen);
  const { data: notes = [] } = useNotesQuery();

  return (
    <NoteSwitcherDialog
      open={open}
      setOpen={setOpen}
      notes={notes}
      placeholder="jump to note..."
      dialogTitle="Quick switcher"
      emptyLabel="~ no matches"
    />
  );
}

/** `:pins` / Ctrl+Shift+P -- pinned notes only, same dialog otherwise. */
export function PinnedSwitcher() {
  const open = useWorkspaceStore((s) => s.pinnedSwitcherOpen);
  const setOpen = useWorkspaceStore((s) => s.setPinnedSwitcherOpen);
  const { data: notes = [] } = useNotesQuery();
  const pinned = useMemo(() => notes.filter((n) => n.pinned), [notes]);

  return (
    <NoteSwitcherDialog
      open={open}
      setOpen={setOpen}
      notes={pinned}
      placeholder="jump to pinned note..."
      dialogTitle="Pinned notes"
      emptyLabel="~ no pinned notes -- :pin one first"
    />
  );
}
