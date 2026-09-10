"use client";

import { displayFilename } from "@/lib/format";

/**
 * Minimal, single-line header: just the title and the inspector toggle.
 * Everything else that used to live here (buffer #, clean/modified,
 * created date, word count, SHA hash) either duplicated the bottom
 * StatusBar (mode, save state) or moved into it (created date, word count,
 * hash) -- see StatusBar.tsx.
 */
export function BufferHeaderNormal({
  title,
  onToggleInspector,
}: {
  title: string;
  onToggleInspector: () => void;
}) {
  return (
    <div className="w-full flex items-center justify-between bg-surface gap-space-2">
      <span className="text-primary font-headline-md text-headline-md tracking-tight truncate">
        {displayFilename(title)}
      </span>
      <button
        onClick={onToggleInspector}
        className="px-space-2 py-space-1 bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm rounded transition-colors shrink-0"
        title="Toggle Side Inspector [:insp]"
      >
        :insp
      </button>
    </div>
  );
}
