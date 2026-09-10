"use client";

import { useWorkspaceStore } from "@/lib/store";
import { displayFilename, formatRelativeCreated, formatWordCount, shortHash } from "@/lib/format";

export function BufferHeaderNormal({
  title,
  content,
  bufferNumber,
  createdAt,
  onToggleInspector,
}: {
  title: string;
  content: string;
  bufferNumber: number;
  createdAt: Date;
  onToggleInspector: () => void;
}) {
  const saveState = useWorkspaceStore((s) => s.saveState);
  const mode = useWorkspaceStore((s) => s.mode);
  const clean = saveState === "clean";

  return (
    <div className="w-full flex items-center justify-between bg-surface flex-wrap gap-space-2">
      <div className="flex flex-col gap-space-1 min-w-0">
        <div className="flex items-center gap-space-3 flex-wrap">
          <span className="text-primary font-headline-md text-headline-md tracking-tight truncate">
            {displayFilename(title)}
          </span>
          <span className="font-label-sm text-label-sm bg-surface-container-high text-on-surface-variant px-space-2 py-space-0 rounded">
            buffer #{bufferNumber}
          </span>
          <span className="font-label-sm text-label-sm text-outline flex items-center gap-space-1">
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${clean ? "bg-primary" : "bg-secondary"}`}
            />{" "}
            {clean ? "clean" : "modified"}
          </span>
        </div>
        <div className="font-label-sm text-label-sm text-outline flex items-center gap-space-3 flex-wrap">
          <span>created {formatRelativeCreated(createdAt)}</span>
          <span>·</span>
          <span>{formatWordCount(content)} words</span>
          <span>·</span>
          <span className="text-secondary">markdown</span>
          <span>·</span>
          <span>
            SHA: <code className="text-on-surface-variant">{shortHash(content)}</code>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-space-2">
        <div className="flex items-center bg-surface-container-low px-space-3 py-space-1 rounded gap-space-2">
          <span className="font-label-md text-label-md bg-primary text-on-primary px-space-2 py-space-0 font-semibold rounded-sm tracking-wider">
            {mode}
          </span>
          <span className="font-label-sm text-label-sm text-primary font-medium">
            {clean ? "[Saved]" : "[+]"}
          </span>
        </div>
        <button
          onClick={onToggleInspector}
          className="px-space-2 py-space-1 bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm rounded transition-colors"
          title="Toggle Side Inspector [:insp]"
        >
          :insp
        </button>
      </div>
    </div>
  );
}
