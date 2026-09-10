"use client";

import { useWorkspaceStore } from "@/lib/store";
import { displayFilename } from "@/lib/format";
import type { Settings } from "@/lib/schemas";

export function BufferHeaderInsert({
  title,
  settings,
}: {
  title: string;
  settings: Settings;
}) {
  const saveState = useWorkspaceStore((s) => s.saveState);
  const saving = saveState === "saving";

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-space-2">
      <div className="flex items-center gap-space-3 flex-wrap">
        <span className="inline-flex items-center px-space-2 py-0.5 bg-primary text-on-primary font-label-md text-label-md rounded font-semibold tracking-wide">
          [INSERT]
        </span>
        <span className="text-on-surface-variant font-label-sm text-label-sm tracking-wider truncate">
          {displayFilename(title)}
        </span>
        {saving && (
          <span className="inline-flex items-center gap-1.5 px-space-2 py-0.5 bg-surface-container-high rounded text-on-surface-variant font-label-sm text-label-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            [Saving...]
          </span>
        )}
      </div>
      <div className="flex items-center gap-space-4">
        <div className="hidden sm:flex items-center gap-space-2 font-label-sm text-label-sm text-outline">
          <span className="text-primary-fixed-dim">tabsize: {settings.tabSize}</span>
          <span>•</span>
          <span>encoding: utf-8</span>
          <span>•</span>
          <span>syntax: markdown</span>
        </div>
        <span className="px-space-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
          [Esc] Return to NORMAL mode
        </span>
      </div>
    </div>
  );
}
