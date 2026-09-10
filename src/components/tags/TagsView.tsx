"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { displayFilename } from "@/lib/format";
import { useNotesQuery } from "@/lib/notes-query";
import { computeTagSummaries, filterNotesByTag } from "@/lib/tags";

/**
 * Real view, derived from the sidebar's own group/list styling -- Stitch
 * has no TAGS screen to copy. Computes over the already-loaded
 * notes-query cache (useMemo, pure JS) instead of fetching per tag click
 * or on page load -- opening this page or switching tags never hits the
 * network.
 */
export function TagsView() {
  const { data: notes = [] } = useNotesQuery();
  const tags = useMemo(() => computeTagSummaries(notes), [notes]);
  const [active, setActive] = useState<string | null>(null);
  const activeTag = active ?? tags[0]?.tag ?? null;

  const notesForTag = useMemo(
    () => (activeTag ? filterNotesByTag(notes, activeTag) : []),
    [notes, activeTag],
  );

  if (tags.length === 0) {
    return (
      <div className="w-full px-space-8 pt-space-8 font-code-editor text-code-editor">
        <p className="text-on-surface-variant"># tags</p>
        <p className="text-outline/50 mt-space-2">
          ~ no tags yet — write #tag-name in a note to create one
        </p>
      </div>
    );
  }

  return (
    <div className="w-full px-space-4 sm:px-space-8 py-space-6 flex flex-col sm:flex-row gap-space-8">
      <div className="w-full sm:w-56 shrink-0">
        <div className="px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider mb-space-2">
          Tags
        </div>
        <div className="space-y-space-px">
          {tags.map((t) => (
            <button
              key={t.tag}
              onClick={() => setActive(t.tag)}
              data-active={t.tag === activeTag}
              className="w-full flex items-center justify-between px-space-2 py-space-1 font-body-sm text-body-sm rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface data-[active=true]:bg-surface-container-high data-[active=true]:text-on-surface data-[active=true]:border-l-2 data-[active=true]:border-primary"
            >
              <span className="text-secondary">#{t.tag}</span>
              <span className="font-label-sm text-label-sm text-outline">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="px-space-2 font-label-sm text-label-sm text-outline uppercase tracking-wider mb-space-2">
          {activeTag ? `#${activeTag}` : "select a tag"}
        </div>
        <div className="space-y-space-px">
          {notesForTag
            .slice()
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map((note) => (
              <Link
                key={note.id}
                href={`/notes/${note.id}`}
                className="w-full flex items-center gap-space-2 px-space-2 py-space-1 font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded"
              >
                <FileText size={14} strokeWidth={1.5} className="text-outline shrink-0" />
                <span className="truncate">{displayFilename(note.title)}</span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
