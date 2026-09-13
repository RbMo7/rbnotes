"use client";

import { ChevronDown, ChevronRight, Hash } from "lucide-react";
import { computeTagSummaries, filterNotesByTag } from "@/lib/tags";
import { NoteListItem } from "@/components/shell/NoteListItem";
import type { NoteRecord } from "@/lib/note-types";

export function SidebarTagList({
  notes,
  filter,
  expandedTags,
  onToggleTag,
}: {
  notes: NoteRecord[];
  filter: string;
  expandedTags: Set<string>;
  onToggleTag: (tag: string) => void;
}) {
  const query = filter.startsWith("/") ? "" : filter.trim().toLowerCase();
  const tags = computeTagSummaries(notes).filter((t) => !query || t.tag.includes(query));

  return (
    <div className="space-y-space-1">
      {tags.map((t) => {
        const isOpen = expandedTags.has(t.tag);
        const files = isOpen
          ? filterNotesByTag(notes, t.tag).sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            )
          : [];

        return (
          <div key={t.tag}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleTag(t.tag);
              }}
              className="w-full flex items-center justify-between px-space-2 py-space-1 font-body-sm text-body-sm rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            >
              <span className="flex items-center gap-space-2 truncate">
                {isOpen ? (
                  <ChevronDown size={12} strokeWidth={2} className="text-outline shrink-0" />
                ) : (
                  <ChevronRight size={12} strokeWidth={2} className="text-outline shrink-0" />
                )}
                <Hash size={14} strokeWidth={1.5} className="text-outline shrink-0" />
                <span className="truncate" title={t.tag}>
                  {t.tag}
                </span>
              </span>
              <span className="font-label-sm text-label-sm text-outline/70 shrink-0">
                {t.count}
              </span>
            </button>
            {isOpen && (
              <div className="pl-space-4 space-y-space-px">
                {files.map((note) => (
                  <NoteListItem
                    key={note.id}
                    id={note.id}
                    title={note.title}
                    updatedAt={new Date(note.updatedAt)}
                    pinned={note.pinned}
                    archived={note.archived}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {tags.length === 0 && (
        <p className="px-space-2 py-space-4 text-center font-body-sm text-body-sm text-outline/50">
          {query ? (
            "~ no matches"
          ) : (
            <>
              ~ no tags yet
              <br />
              write <span className="text-primary">#like-this</span> anywhere in a note
            </>
          )}
        </p>
      )}
    </div>
  );
}
