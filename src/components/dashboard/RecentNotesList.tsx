"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { FileText } from "lucide-react";
import { useNotesQuery } from "@/lib/notes-query";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { useWorkspaceStore } from "@/lib/store";
import { displayFilename } from "@/lib/format";
import { formatSidebarTimestamp } from "@/lib/grouping";

const RECENT_LIMIT = 8;

/**
 * The Dashboard's keyboard-first recent-notes widget. Focused on mount so
 * j/k and arrows work immediately with zero clicks; `/` hands off to the
 * filter box. Plain typing filters this list by title; a leading `/`
 * switches the same box into "global" mode -- Enter there opens the real
 * SearchPalette (openSearchWith) rather than filtering in place, since a
 * content search isn't scoped to these 8 recent notes.
 */
export function RecentNotesList() {
  const { data: notes = [] } = useNotesQuery();
  const { openNote } = useWorkspace();
  const openSearchWith = useWorkspaceStore((s) => s.openSearchWith);

  const recent = useMemo(
    () =>
      notes
        .filter((n) => !n.archived)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, RECENT_LIMIT),
    [notes],
  );

  const [filter, setFilter] = useState("");
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isGlobal = filter.startsWith("/");
  const filtered = useMemo(() => {
    if (!filter || isGlobal) return recent;
    const q = filter.toLowerCase();
    return recent.filter((n) => n.title.toLowerCase().includes(q));
  }, [recent, filter, isGlobal]);

  const updateFilter = useCallback((value: string) => {
    setFilter(value);
    setHighlight(0);
  }, []);

  useEffect(() => {
    listRef.current?.focus();
  }, []);

  function openHighlighted() {
    const note = filtered[highlight];
    if (note) openNote(note.id);
  }

  function moveHighlight(delta: number) {
    setHighlight((i) => Math.min(Math.max(i + delta, 0), Math.max(filtered.length - 1, 0)));
  }

  function handleListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      openHighlighted();
    } else if (e.key === "/") {
      e.preventDefault();
      inputRef.current?.focus();
    }
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isGlobal) {
        const query = filter.slice(1);
        if (query) openSearchWith(query);
      } else {
        openHighlighted();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      updateFilter("");
      listRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-space-3 w-full">
      <input
        ref={inputRef}
        value={filter}
        onChange={(e) => updateFilter(e.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder="type to filter, / to search every note"
        className="w-full bg-surface-container px-space-3 py-space-2 rounded border border-outline-variant/40 font-code-editor text-code-editor text-on-surface placeholder-on-surface-variant/40 outline-none focus:border-primary"
        aria-label="Filter recent notes or search all notes"
      />
      <div
        ref={listRef}
        tabIndex={-1}
        onKeyDown={handleListKeyDown}
        role="listbox"
        aria-label="Recent notes"
        className="flex flex-col gap-space-px outline-none"
      >
        {filtered.length === 0 && (
          <p className="px-space-2 py-space-4 text-center font-body-sm text-body-sm text-outline/50">
            ~ no matches
          </p>
        )}
        {filtered.map((note, i) => (
          <button
            key={note.id}
            type="button"
            role="option"
            aria-selected={i === highlight}
            onMouseEnter={() => setHighlight(i)}
            onClick={() => openNote(note.id)}
            className={`w-full flex items-center justify-between gap-space-2 px-space-3 py-space-2 text-left font-body-sm text-body-sm transition-colors ${
              i === highlight
                ? "bg-surface-container-high text-on-surface border-l-2 border-primary"
                : "text-on-surface-variant hover:bg-surface-container border-l-2 border-transparent"
            }`}
          >
            <span className="flex items-center gap-space-2 truncate">
              <FileText size={14} strokeWidth={1.5} className="text-outline shrink-0" />
              <span className="truncate">{displayFilename(note.title)}</span>
            </span>
            <span className="font-label-sm text-label-sm text-outline/70 shrink-0">
              {formatSidebarTimestamp(new Date(note.updatedAt))}
            </span>
          </button>
        ))}
      </div>
      <p className="font-label-sm text-label-sm text-outline text-center">
        j/k move · ↵ open · / search
      </p>
    </div>
  );
}
