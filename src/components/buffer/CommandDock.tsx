"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COMMAND_CHIPS } from "@/components/editor/command-dispatch";

/**
 * The Stitch command-mode screen's bottom dock: a TAB-COMPLETE BUFFER chip
 * grid above a `:` command line with a block caret. Replaces
 * @replit/codemirror-vim's own (hidden) ex-mode panel entirely, so this is
 * the only UI a `:` command is ever typed into.
 */
export function CommandDock({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (raw: string) => void;
}) {
  const [value, setValue] = useState("");
  const [activeChip, setActiveChip] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Reset the command line each time the dock opens (not just once on
      // mount) -- legitimate sync-on-prop-change, not derivable at render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue("");
      setActiveChip(0);
      // Focus after the dock has actually mounted/painted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const firstWord = value.split(" ")[0] ?? "";
  const matches = useMemo(
    () =>
      firstWord
        ? COMMAND_CHIPS.filter((c) => c.full.startsWith(firstWord))
        : COMMAND_CHIPS,
    [firstWord],
  );

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit(value);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (matches.length === 0) return;
      const next = (activeChip + 1) % matches.length;
      setActiveChip(next);
      setValue(matches[next].full);
    }
  };

  return (
    <div className="sticky bottom-0 z-30 bg-surface-container-lowest shadow-2xl">
      <div className="bg-surface-container-high px-space-4 py-space-2">
        <div className="flex items-center justify-between mb-space-1">
          <span className="text-label-sm font-label-sm text-outline uppercase tracking-wider">
            Tab-Complete Buffer
          </span>
          <span className="text-label-sm font-label-sm text-outline">
            {matches.length} matches
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-space-2">
          {COMMAND_CHIPS.map((chip, i) => {
            const isMatch = matches.includes(chip);
            const isActive = matches[activeChip] === chip;
            return (
              <button
                key={chip.label}
                type="button"
                // Prevent the button from stealing focus on mousedown, which
                // would blur the command input before the click fires.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setValue(chip.full);
                  inputRef.current?.focus();
                }}
                className={`px-space-2 py-1 flex items-center justify-between font-label-md text-label-md text-left transition-colors ${
                  isActive
                    ? "bg-primary text-on-primary"
                    : isMatch
                      ? "bg-surface-container text-on-surface-variant hover:text-on-surface"
                      : "bg-surface-container/40 text-on-surface-variant/40"
                }`}
              >
                <span className={chip.danger && !isActive ? "text-error" : ""}>
                  {chip.label}
                </span>
                <span className="text-label-sm font-label-sm opacity-70">#{i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="h-10 bg-surface-container-lowest px-space-4 flex items-center justify-between font-code-editor text-code-editor">
        <div className="flex items-center gap-space-1 flex-1 min-w-0">
          <span className="text-primary font-bold text-headline-sm font-headline-sm leading-none">
            :
          </span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onClose}
            className="flex-1 min-w-0 bg-transparent text-on-surface outline-none border-none"
            spellCheck={false}
            autoComplete="off"
            aria-label="Command"
          />
        </div>
        <div className="hidden sm:flex items-center gap-space-4 font-label-sm text-label-sm text-outline select-none shrink-0">
          <span className="flex items-center gap-1">
            <span className="bg-surface-container px-1 py-0.5 text-on-surface">Enter</span>{" "}
            Execute
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-surface-container px-1 py-0.5 text-on-surface">Tab</span> Next
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-surface-container px-1 py-0.5 text-on-surface">Esc</span> Cancel
          </span>
        </div>
      </div>
    </div>
  );
}
