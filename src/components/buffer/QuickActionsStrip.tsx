"use client";

import { useWorkspaceStore } from "@/lib/store";

/**
 * The Note screen's bottom bar (no Vim there, so there's no status-line
 * mode/keybinding chrome to show instead). A plain Save button and the
 * current save state -- no keyboard hints, since these viewers never have
 * Vim mode or a physical-keyboard affordance to lean on.
 */
export function QuickActionsStrip({ onSave }: { onSave: () => void }) {
  const saveState = useWorkspaceStore((s) => s.saveState);

  return (
    <div className="mt-space-6 flex items-center justify-between gap-space-3 p-space-4 rounded bg-surface-container text-on-surface-variant">
      <button
        onClick={onSave}
        className="px-space-3 py-space-2 rounded bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-fixed transition-colors"
      >
        Save
      </button>
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
          ? "Saving…"
          : saveState === "error"
            ? "Save failed"
            : saveState === "clean"
              ? "Saved"
              : "Unsaved"}
      </span>
    </div>
  );
}
