"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { groupNotes, type NoteGroup } from "@/lib/grouping";
import { NoteListItem } from "@/components/shell/NoteListItem";
import type { NoteRecord } from "@/lib/note-types";

// ARCHIVE starts collapsed (old notes you're not actively working with);
// the recency groups start open since that's the normal browsing view.
const DEFAULT_OPEN: Record<NoteGroup["label"], boolean> = {
  TODAY: true,
  "THIS WEEK": true,
  EARLIER: true,
  ARCHIVE: false,
};

export function SidebarBufferList({ notes, filter }: { notes: NoteRecord[]; filter: string }) {
  const [openGroups, setOpenGroups] = useState(DEFAULT_OPEN);

  const query = filter.startsWith("/") ? "" : filter.trim().toLowerCase();
  const visible = query ? notes.filter((n) => n.title.toLowerCase().includes(query)) : notes;
  const groups = groupNotes(visible.map((n) => ({ ...n, updatedAt: new Date(n.updatedAt) })));

  function toggleGroup(label: NoteGroup["label"]) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <div className="space-y-space-4">
      {groups.map((group) => {
        const isOpen = openGroups[group.label];
        return (
          <div key={group.label} className="space-y-space-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleGroup(group.label);
              }}
              className="w-full flex items-center justify-between px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider hover:text-on-surface-variant transition-colors"
            >
              <span className="flex items-center gap-space-1">
                {isOpen ? (
                  <ChevronDown size={12} strokeWidth={2} />
                ) : (
                  <ChevronRight size={12} strokeWidth={2} />
                )}
                {group.label}
              </span>
              <span className="normal-case tracking-normal text-outline/70">
                {group.notes.length}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-space-px">
                {group.notes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    id={note.id}
                    title={note.title}
                    updatedAt={note.updatedAt}
                    archived={note.archived}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {groups.length === 0 && (
        <p className="px-space-2 font-body-sm text-body-sm text-outline/50">
          {query ? "~ no matches" : "~ no notes yet"}
        </p>
      )}
    </div>
  );
}
