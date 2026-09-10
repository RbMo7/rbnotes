"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { groupNotes } from "@/lib/grouping";
import { NoteListItem } from "@/components/shell/NoteListItem";
import type { NoteRecord } from "@/lib/note-types";

export function SidebarBufferList({ notes, filter }: { notes: NoteRecord[]; filter: string }) {
  const [archiveOpen, setArchiveOpen] = useState(false);

  const query = filter.startsWith("/") ? "" : filter.trim().toLowerCase();
  const visible = query ? notes.filter((n) => n.title.toLowerCase().includes(query)) : notes;
  const groups = groupNotes(visible.map((n) => ({ ...n, updatedAt: new Date(n.updatedAt) })));

  return (
    <div className="space-y-space-4">
      {groups.map((group) =>
        group.label === "ARCHIVE" ? (
          <div key={group.label} className="space-y-space-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setArchiveOpen((v) => !v);
              }}
              className="w-full flex items-center justify-between px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider hover:text-on-surface-variant transition-colors"
            >
              <span className="flex items-center gap-space-1">
                {archiveOpen ? (
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
            {archiveOpen && (
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
        ) : (
          <div key={group.label} className="space-y-space-1">
            <div className="px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider">
              {group.label}
            </div>
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
          </div>
        ),
      )}
      {groups.length === 0 && (
        <p className="px-space-2 font-body-sm text-body-sm text-outline/50">
          {query ? "~ no matches" : "~ no notes yet"}
        </p>
      )}
    </div>
  );
}
