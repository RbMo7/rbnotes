"use client";

import { useWorkspaceStore } from "@/lib/store";

/**
 * The hint row from the NORMAL screenshot's "Authentic Vim Statusline"
 * block -- mode/filename/save-state live in the global StatusBar footer
 * already (StatusBar.tsx), so this only carries what that footer doesn't:
 * the command-line hint and the shortcut legend, both of which change with
 * the live vim mode.
 */
export function VimStatuslineDock({ onSave }: { onSave: () => void }) {
  const mode = useWorkspaceStore((s) => s.mode);
  const isNormal = mode === "NORMAL";

  return (
    <div className="w-full mt-space-4 bg-surface-container-low text-on-surface rounded overflow-hidden px-space-3 py-space-2 flex flex-col md:flex-row md:items-center justify-between gap-space-2">
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
              <span className="text-secondary">[/]</span> Find
            </span>
            <span>
              <span className="text-secondary">[^/]</span> Global
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
  );
}
