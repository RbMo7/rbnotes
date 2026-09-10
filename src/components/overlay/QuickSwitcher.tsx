"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Archive } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { displayFilename } from "@/lib/format";
import { formatSidebarTimestamp, type SidebarNote } from "@/lib/grouping";

/**
 * Ctrl+P. Per the design system spec: centered at 20% viewport height,
 * 38rem wide, bg-surface-container, 1px solid outline (#363D47-equivalent),
 * no shadow -- unlike every other overlay in this app, this one is
 * explicitly specified with zero elevation.
 */
export function QuickSwitcher({ notes }: { notes: SidebarNote[] }) {
  const open = useWorkspaceStore((s) => s.quickSwitcherOpen);
  const setOpen = useWorkspaceStore((s) => s.setQuickSwitcherOpen);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? notes.filter((n) => n.title.toLowerCase().includes(q)) : notes;
    return list.slice(0, 20);
  }, [notes, query]);

  const openNote = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/notes/${id}`);
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
          className="fixed left-1/2 top-[20vh] -translate-x-1/2 w-[90vw] max-w-[38rem] bg-surface-container border border-outline-variant z-[61] font-code-editor text-code-editor"
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
          <Dialog.Title className="sr-only">Quick switcher</Dialog.Title>
          <div className="flex items-center gap-space-2 px-space-4 py-space-3 border-b border-outline-variant">
            <span className="text-primary font-bold">&gt;</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="jump to note..."
              className="flex-1 bg-transparent outline-none border-none text-on-surface placeholder-on-surface-variant/40"
              aria-label="Search notes"
            />
            <span className="w-2 h-4 bg-primary inline-block animate-pulse" />
          </div>
          <div role="listbox" className="max-h-80 overflow-y-auto py-space-2">
            {filtered.length === 0 && (
              <p className="px-space-4 py-space-2 font-body-sm text-body-sm text-outline/50">
                ~ no matches
              </p>
            )}
            {filtered.map((note, i) => {
              const Icon = note.archived ? Archive : FileText;
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
                    <span className="truncate">{displayFilename(note.title)}</span>
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
