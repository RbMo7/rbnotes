"use client";

import { GLOBAL_SHORTCUTS } from "@/components/editor/shortcuts";

/** Reuses the same table the editor and shell key listeners match against, so this never drifts from what actually works. */
export function ShortcutCheatsheet() {
  const rows = GLOBAL_SHORTCUTS.filter((s) => s.inGlobalHelp);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-space-4 gap-y-space-1 font-label-sm text-label-sm">
      {rows.map((s) => (
        <span key={s.id} className="flex items-center gap-space-1">
          <span className="text-on-surface-variant">{s.label}</span>
          <span className="text-outline/70">{s.description}</span>
        </span>
      ))}
    </div>
  );
}
