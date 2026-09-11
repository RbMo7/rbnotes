"use client";

import { FileText, Archive, Pin } from "lucide-react";
import { formatSidebarTimestamp } from "@/lib/grouping";
import { displayFilename } from "@/lib/format";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { noteHref } from "@/components/workspace/note-path";
import { useTogglePin } from "@/lib/notes-query";

export function NoteListItem({
  id,
  title,
  updatedAt,
  pinned = false,
  archived,
}: {
  id: string;
  title: string;
  updatedAt: Date;
  pinned?: boolean;
  archived: boolean;
}) {
  const { activeNoteId, openNote } = useWorkspace();
  const togglePin = useTogglePin();
  const active = activeNoteId === id;
  const Icon = archived ? Archive : FileText;

  return (
    // A plain <div> row, not the whole-row <a> this used to be -- it now
    // has to host a real <button> (the pin toggle) alongside the link, and
    // a <button> nested inside an <a> is invalid HTML. The title itself
    // stays a real <a href> (middle-click/ctrl-click "open in new tab",
    // right-click "copy link" keep working) with a plain left click
    // intercepted for the instant in-app switch (ADR-0001).
    <div
      data-active={active}
      className="w-full flex items-center gap-space-2 px-space-2 py-space-1 font-body-sm text-body-sm group data-[active=true]:bg-surface-container-high data-[active=true]:text-on-surface data-[active=true]:font-medium data-[active=true]:border-l-2 data-[active=true]:border-primary text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
    >
      <a
        href={noteHref(id)}
        onClick={(e) => {
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
            return;
          }
          e.preventDefault();
          openNote(id);
        }}
        className="flex-1 flex items-center gap-space-2 min-w-0"
      >
        <Icon
          size={14}
          strokeWidth={1.5}
          className="text-outline group-hover:text-primary shrink-0"
        />
        <span className="truncate" title={displayFilename(title)}>
          {displayFilename(title)}
        </span>
      </a>
      {/* Always shown once pinned; otherwise only on row hover/focus so the
          list doesn't get noisy with an icon on every row. */}
      <button
        type="button"
        onClick={() => togglePin({ id, pinned, archived })}
        aria-label={pinned ? "Unpin note" : "Pin note"}
        aria-pressed={pinned}
        title={pinned ? "Unpin" : "Pin"}
        className={`shrink-0 rounded transition-opacity ${
          pinned
            ? "text-primary opacity-100"
            : "text-outline opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-primary"
        }`}
      >
        <Pin size={13} strokeWidth={1.5} fill={pinned ? "currentColor" : "none"} />
      </button>
      <span className="font-label-sm text-label-sm text-outline/70 shrink-0">
        {formatSidebarTimestamp(updatedAt)}
      </span>
    </div>
  );
}
