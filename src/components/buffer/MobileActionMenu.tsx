"use client";

import { useEffect, useRef, useState } from "react";
import { FilePlus, Pencil, Save, Share2, Trash2, X, type LucideIcon } from "lucide-react";
import { COMMAND } from "@/components/editor/command-dispatch";

/**
 * Mobile's Action menu (CONTEXT.md): the same actions the Command dock
 * drives (save, rename, new, delete, share), presented as plain labeled
 * buttons instead of `:`-command syntax -- no chip grid, no tab-complete,
 * no vim-only options like `:set rnu`. Submits the same raw command
 * strings `dispatchCommand` already understands, so it's wired the same
 * way CommandDock is.
 */
export function MobileActionMenu({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (raw: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      // Reset so the next open starts on the action grid, not mid-rename --
      // legitimate sync-on-prop-change, not derivable at render.
      /* eslint-disable react-hooks/set-state-in-effect */
      setRenaming(false);
      setTitle("");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  useEffect(() => {
    if (renaming) requestAnimationFrame(() => inputRef.current?.focus());
  }, [renaming]);

  if (!open) return null;

  const runAndClose = (command: string) => {
    onSubmit(command);
    onClose();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-surface-container-lowest border-t border-outline-variant/30 shadow-2xl rounded-t-xl">
      <div className="flex items-center justify-between px-space-4 py-space-3 border-b border-outline-variant/20">
        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
          Actions
        </span>
        <button
          onClick={onClose}
          aria-label="Close actions"
          className="text-on-surface-variant hover:text-on-surface p-space-1"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      {renaming ? (
        <form
          className="flex items-center gap-space-2 px-space-4 py-space-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) runAndClose(`${COMMAND.renamePrefix}${title.trim()}`);
            else onClose();
          }}
        >
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New title"
            aria-label="New title"
            className="flex-1 bg-surface-container px-space-3 py-space-2 rounded outline-none text-on-surface"
          />
          <button
            type="submit"
            className="px-space-3 py-space-2 bg-primary text-on-primary rounded font-label-md text-label-md"
          >
            Save
          </button>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-space-2 p-space-4 pb-space-6">
          <ActionButton icon={Save} label="Save" onClick={() => runAndClose(COMMAND.save)} />
          <ActionButton icon={Pencil} label="Rename" onClick={() => setRenaming(true)} />
          <ActionButton icon={FilePlus} label="New note" onClick={() => runAndClose(COMMAND.newNote)} />
          <ActionButton icon={Share2} label="Share" onClick={() => runAndClose(COMMAND.share)} />
          <ActionButton icon={Trash2} label="Delete" danger onClick={() => runAndClose(COMMAND.delete)} />
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-space-2 px-space-3 py-space-3 rounded bg-surface-container hover:bg-surface-container-high font-label-md text-label-md ${
        danger ? "text-error" : "text-on-surface"
      }`}
    >
      <Icon size={16} strokeWidth={1.5} />
      {label}
    </button>
  );
}
