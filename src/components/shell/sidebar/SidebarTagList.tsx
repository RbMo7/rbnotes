"use client";

import { ChevronLeft, Hash } from "lucide-react";
import { computeTagSummaries, filterNotesByTag } from "@/lib/tags";
import { NoteListItem } from "@/components/shell/NoteListItem";
import type { NoteRecord } from "@/lib/note-types";

export function SidebarTagList({
  notes,
  tag,
  filter,
  onSelectTag,
  onBack,
}: {
  notes: NoteRecord[];
  tag: string | null;
  filter: string;
  onSelectTag: (tag: string) => void;
  onBack: () => void;
}) {
  const query = filter.startsWith("/") ? "" : filter.trim().toLowerCase();

  if (tag) {
    const files = filterNotesByTag(notes, tag)
      .filter((n) => !query || n.title.toLowerCase().includes(query))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return (
      <div className="space-y-space-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          className="flex items-center gap-space-1 px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider hover:text-on-surface-variant transition-colors"
        >
          <ChevronLeft size={12} strokeWidth={2} />
          <span>Tags</span>
        </button>
        <div className="px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider">
          #{tag}
        </div>
        <div className="space-y-space-px">
          {files.map((note) => (
            <NoteListItem
              key={note.id}
              id={note.id}
              title={note.title}
              updatedAt={new Date(note.updatedAt)}
              archived={note.archived}
            />
          ))}
        </div>
        {files.length === 0 && (
          <p className="px-space-2 font-body-sm text-body-sm text-outline/50">~ no matches</p>
        )}
      </div>
    );
  }

  const tags = computeTagSummaries(notes).filter((t) => !query || t.tag.includes(query));

  return (
    <div className="space-y-space-px">
      {tags.map((t) => (
        <button
          key={t.tag}
          onClick={(e) => {
            e.stopPropagation();
            onSelectTag(t.tag);
          }}
          className="w-full flex items-center justify-between px-space-2 py-space-1 font-body-sm text-body-sm rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
        >
          <span className="flex items-center gap-space-2 truncate">
            <Hash size={14} strokeWidth={1.5} className="text-outline shrink-0" />
            <span className="truncate">{t.tag}</span>
          </span>
          <span className="font-label-sm text-label-sm text-outline/70 shrink-0">{t.count}</span>
        </button>
      ))}
      {tags.length === 0 && (
        <p className="px-space-2 py-space-4 text-center font-body-sm text-body-sm text-outline/50">
          {query ? "~ no matches" : "~ no tags yet"}
        </p>
      )}
    </div>
  );
}
