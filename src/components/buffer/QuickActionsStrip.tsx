"use client";

import { useWorkspaceStore } from "@/lib/store";

/**
 * The INSERT screen's "Quick Actions" strip. Doubles as the mobile bottom
 * hint (no Vim, so there's no `[i][v][/]` row to show there either) --
 * see build plan §10. Save state uses the same [Saved]/[+] vocabulary as
 * everywhere else in the app -- nothing auto-syncs (§13.4), so this no
 * longer implies background saving.
 */
export function QuickActionsStrip({ onSave }: { onSave: () => void }) {
  const saveState = useWorkspaceStore((s) => s.saveState);

  return (
    <div className="mt-space-6 flex flex-wrap items-center justify-between gap-space-3 p-space-4 rounded bg-surface-container text-on-surface-variant">
      <div className="flex items-center gap-space-3 flex-wrap">
        <span className="px-space-2 py-0.5 rounded bg-surface-container-highest text-on-surface font-label-sm text-label-sm uppercase font-semibold">
          Quick Actions
        </span>
        <span className="font-body-sm text-body-sm text-outline">
          Press{" "}
          <button
            onClick={onSave}
            className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm hover:bg-surface-container-highest"
          >
            Ctrl+S
          </button>{" "}
          to write buffer
        </span>
      </div>
      <span
        className={`px-space-2 py-0.5 rounded font-label-sm text-label-sm ${
          saveState === "clean"
            ? "bg-primary/10 text-primary"
            : saveState === "error"
              ? "bg-error/10 text-error"
              : "bg-surface-container-highest text-on-surface-variant"
        }`}
      >
        {saveState === "saving"
          ? "[Saving...]"
          : saveState === "error"
            ? "[write failed]"
            : saveState === "clean"
              ? "[Saved]"
              : "[+]"}
      </span>
    </div>
  );
}
