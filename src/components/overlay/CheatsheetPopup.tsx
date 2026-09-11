"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { SECTIONS } from "@/components/overlay/HelpBuffer";
import { RESPONSIVE_DIALOG_CONTENT } from "@/components/overlay/dialog-classes";

/**
 * The footer's "Need help?" / `:cheat` popup -- a compact reference over
 * the same SECTIONS table HelpBuffer's full-screen `:help` uses, but global
 * (driven by the store, not WorkspaceBuffer-local state) so it opens from
 * the Dashboard too and stays usable as a live reference while typing,
 * unlike `:help` which owns the whole buffer.
 */
export function CheatsheetPopup() {
  const open = useWorkspaceStore((s) => s.cheatsheetOpen);
  const setOpen = useWorkspaceStore((s) => s.setCheatsheetOpen);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[60]" />
        <Dialog.Content
          className={`${RESPONSIVE_DIALOG_CONTENT} sm:max-w-2xl sm:max-h-[80vh] shadow-2xl`}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between px-space-4 py-space-3 border-b border-outline-variant shrink-0">
            <Dialog.Title className="text-primary font-semibold"># cheatsheet.md</Dialog.Title>
            <Dialog.Close aria-label="Close cheatsheet" className="text-on-surface-variant hover:text-on-surface">
              <X size={16} strokeWidth={1.5} />
            </Dialog.Close>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-space-4 flex flex-col gap-space-4">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="text-secondary font-bold text-body-sm mb-space-1">
                  ## {section.title}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-1">
                  {section.keys.map(([key, desc]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between bg-surface-container px-space-2 py-space-1 gap-space-2 text-label-sm font-label-sm"
                    >
                      <span className="text-primary font-semibold shrink-0">{key}</span>
                      <span className="text-on-surface-variant text-right">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
