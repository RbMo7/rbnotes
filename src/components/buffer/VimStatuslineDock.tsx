"use client";

import { useWorkspaceStore } from "@/lib/store";
import { displayFilename } from "@/lib/format";

/** The "Authentic Vim Statusline" block from the NORMAL screenshot. */
export function VimStatuslineDock({
  title,
  onSave,
}: {
  title: string;
  onSave: () => void;
}) {
  const mode = useWorkspaceStore((s) => s.mode);
  const saveState = useWorkspaceStore((s) => s.saveState);
  const dirty = saveState !== "clean";
  const now = new Date();
  // `:` only opens the command line from NORMAL (Editor.tsx checks the vim
  // engine's own live mode before intercepting it) -- in INSERT/VISUAL it's
  // just a literal character, so the hint row swaps to the one command
  // that actually applies there instead of advertising a dead key.
  const isNormal = mode === "NORMAL";

  return (
    <div className="w-full mt-space-4 bg-surface-container-highest text-on-surface rounded overflow-hidden">
      <div className="flex flex-wrap items-center justify-between px-space-3 py-space-1 font-label-md text-label-md">
        <div className="flex items-center gap-space-2">
          <span className="bg-primary text-on-primary font-bold px-space-2 py-space-0 rounded-sm">
            {mode}
          </span>
          <span className="text-outline">|</span>
          <span className="text-on-surface font-semibold">{displayFilename(title)}</span>
          {dirty && <span className="text-primary font-medium">[+]</span>}
          <span className="text-outline">[utf-8]</span>
        </div>
        <div className="flex items-center gap-space-4 font-label-sm text-label-sm">
          <span className="text-on-surface-variant font-mono">
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
          <span className="text-outline">|</span>
          <span
            className={saveState === "saving" ? "text-secondary" : "text-primary font-medium"}
          >
            {saveState === "saving" ? ":w saving" : saveState === "error" ? ":w failed" : ":w saved"}
          </span>
        </div>
      </div>
      <div className="bg-surface-container-low px-space-3 py-space-2 flex flex-col md:flex-row md:items-center justify-between gap-space-2">
        <div className="flex items-center gap-space-2 font-code-editor text-body-sm text-primary">
          {isNormal ? (
            <>
              <span className="font-bold">:</span>
              <span className="text-outline font-label-sm text-label-sm">
                press &lsquo;:&rsquo; to open the command line
              </span>
            </>
          ) : (
            <span className="text-outline font-label-sm text-label-sm">
              -- {mode} --
            </span>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-space-3 font-label-sm text-label-sm text-outline">
          {isNormal ? (
            <>
              <span>
                <span className="text-secondary">[i]</span> Insert
              </span>
              <span>
                <span className="text-secondary">[v]</span> Visual
              </span>
              <span>
                <span className="text-secondary">[/]</span> Search
              </span>
            </>
          ) : (
            <span>
              <span className="text-secondary">[Esc]</span> Normal
            </span>
          )}
          <button
            onClick={onSave}
            className="hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="text-primary">[:w]</span> Save
          </button>
          <span>
            <span className="text-secondary">[^P]</span> Switcher
          </span>
          <span>
            <span className="text-outline-variant hover:text-outline">[?]</span> Help
          </span>
        </div>
      </div>
    </div>
  );
}
