"use client";

import { HelpCircle } from "lucide-react";
import { useWorkspaceStore, type VimMode } from "@/lib/store";
import { formatRelativeCreated } from "@/lib/format";
import { useZoomLevel } from "@/lib/use-zoom-level";

// Both real Stitch screenshots (NORMAL and INSERT) render this exact pill in
// solid `bg-primary`/`text-on-primary` — only the label changes between
// modes, never the color. That's what we reproduce; VISUAL/EDIT/RO extend
// the same treatment rather than inventing new mode colors the screens
// never show.
const MODE_LABEL: Record<VimMode, string> = {
  NORMAL: "NORMAL",
  INSERT: "INSERT",
  VISUAL: "VISUAL",
  EDIT: "EDIT",
  RO: "RO",
};

export function StatusBar({ filename }: { filename: string | null }) {
  const mode = useWorkspaceStore((s) => s.mode);
  const saveState = useWorkspaceStore((s) => s.saveState);
  const cursorLine = useWorkspaceStore((s) => s.cursorLine);
  const cursorCol = useWorkspaceStore((s) => s.cursorCol);
  const bufferInfo = useWorkspaceStore((s) => s.activeBufferInfo);
  const setCheatsheetOpen = useWorkspaceStore((s) => s.setCheatsheetOpen);
  const zoom = useZoomLevel();

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-status-bar-height bg-surface-container-high border-t border-outline-variant/40 z-50 flex items-center justify-between px-space-4 font-label-sm text-label-sm">
      <div className="flex items-center h-full gap-space-3 min-w-0">
        <div className="h-full bg-primary text-on-primary px-space-3 font-semibold flex items-center tracking-wider shrink-0">
          {MODE_LABEL[mode]}
        </div>
        <div className="flex items-center gap-space-2 text-on-surface-variant min-w-0">
          <span className="truncate" title={filename ?? undefined}>
            {filename ?? "no buffer"}
          </span>
          {filename && (
            <span className={saveState === "clean" ? "text-primary" : "text-outline"}>
              {saveState === "saving"
                ? "[Saving...]"
                : saveState === "error"
                  ? "[write failed]"
                  : saveState === "dirty"
                    ? "[+]"
                    : "[Saved]"}
            </span>
          )}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-space-4 text-on-surface-variant shrink-0">
        {bufferInfo && (
          <>
            <span>created {formatRelativeCreated(new Date(bufferInfo.createdAt))}</span>
            <span>|</span>
            <span>{bufferInfo.wordCount} words</span>
            <span>|</span>
          </>
        )}
        <span>markdown</span>
        <span>|</span>
        <span>utf-8</span>
        <span>|</span>
        <span>
          Ln {cursorLine}, Col {cursorCol}
        </span>
        {bufferInfo && (
          <>
            <span>|</span>
            <span>
              SHA: <code className="text-on-surface">{bufferInfo.hash}</code>
            </span>
          </>
        )}
        <span>|</span>
        <span className="text-outline">{zoom}%</span>
      </div>
      <button
        onClick={() => setCheatsheetOpen(true)}
        className="flex items-center gap-space-1 text-on-surface-variant hover:text-primary shrink-0"
      >
        <HelpCircle size={14} strokeWidth={1.5} />
        <span className="hidden sm:inline">Need help?</span>
      </button>
    </footer>
  );
}
