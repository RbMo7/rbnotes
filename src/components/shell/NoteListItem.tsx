"use client";

import { FileText, Archive } from "lucide-react";
import { formatSidebarTimestamp } from "@/lib/grouping";
import { displayFilename } from "@/lib/format";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { noteHref } from "@/components/workspace/note-path";

export function NoteListItem({
  id,
  title,
  updatedAt,
  archived,
}: {
  id: string;
  title: string;
  updatedAt: Date;
  archived: boolean;
}) {
  const { activeNoteId, openNote } = useWorkspace();
  const active = activeNoteId === id;
  const Icon = archived ? Archive : FileText;

  return (
    // A real <a href> (not a plain button) so middle-click/ctrl-click "open
    // in new tab" and right-click "copy link" keep working -- the click
    // handler intercepts a plain left click for the instant in-app switch,
    // matching ADR-0001 (never round-trip next/navigation for this).
    <a
      href={noteHref(id)}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
          return;
        }
        e.preventDefault();
        openNote(id);
      }}
      data-active={active}
      className="w-full flex items-center justify-between px-space-2 py-space-1 font-body-sm text-body-sm group data-[active=true]:bg-surface-container-high data-[active=true]:text-on-surface data-[active=true]:font-medium data-[active=true]:border-l-2 data-[active=true]:border-primary text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
    >
      <span className="flex items-center gap-space-2 truncate">
        <Icon
          size={14}
          strokeWidth={1.5}
          className="text-outline group-hover:text-primary shrink-0"
        />
        <span className="truncate" title={displayFilename(title)}>
          {displayFilename(title)}
        </span>
      </span>
      <span className="font-label-sm text-label-sm text-outline/70 shrink-0">
        {formatSidebarTimestamp(updatedAt)}
      </span>
    </a>
  );
}
