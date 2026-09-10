"use client";

import { useEffect, useState, type ReactNode } from "react";

function isTypingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

/**
 * The shared auth window chrome: one terminal-styled frame, reused verbatim
 * (only the title-bar label and commands change) across login, register,
 * forgot-password, and reset -- the design has one auth window, not four.
 *
 * `commands` is what makes the ex-command chips shown on each screen's
 * submit button (`[:wq]`, `[:new]`, `[:w]`) real rather than decorative:
 * `:` opens a command line right in the title bar, type the command, Enter
 * to run it -- the same command-line surface the real editor uses, not a
 * literal key-combo shortcut. Mapping "focused in a field" to Vim's insert
 * mode, `:` only ever fires outside one, and Escape while focused in a
 * field blurs it -- exactly Vim's own Escape (leave insert mode; it never
 * discards what you typed), which is what lets `:` reach the command line
 * next without an extra manual click or Tab out of the field.
 */
export function TerminalWindow({
  titleBarLabel,
  commands,
  children,
}: {
  titleBarLabel: string;
  commands?: Record<string, () => void>;
  children: ReactNode;
}) {
  const [typed, setTyped] = useState<string | null>(null);

  useEffect(() => {
    if (!commands) return;

    function handleKeydown(event: KeyboardEvent) {
      if (typed === null) {
        if (isTypingInField(event.target)) {
          // Escape here is Vim's own: leave insert mode, keep what you
          // typed. Blurring is what lets `:` reach the command line on the
          // very next keystroke, with no extra click or Tab needed.
          if (event.key === "Escape") (event.target as HTMLElement).blur();
          return;
        }
        if (event.key === ":") {
          event.preventDefault();
          setTyped("");
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setTyped(null);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        commands?.[typed.trim()]?.();
        setTyped(null);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        setTyped((t) => (t ?? "").slice(0, -1));
        return;
      }
      if (event.key.length === 1) {
        event.preventDefault();
        setTyped((t) => (t ?? "") + event.key);
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [commands, typed]);

  return (
    <div className="flex flex-col w-full bg-surface-container-lowest border border-outline-variant shadow-2xl">
      <div className="px-space-4 py-space-2 bg-surface-container-high border-b border-outline-variant select-none">
        {typed !== null ? (
          <span className="text-primary font-code-editor text-code-editor">
            :{typed}
            <span className="animate-pulse">▌</span>
          </span>
        ) : (
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            {titleBarLabel}
          </span>
        )}
      </div>
      <div className="p-space-6 flex flex-col gap-space-5">{children}</div>
    </div>
  );
}

export function TerminalHeader({ tagline }: { tagline: string }) {
  return (
    <div className="flex flex-col gap-space-1 border-b border-outline-variant pb-space-4">
      <span className="text-primary font-headline-lg text-headline-lg font-bold tracking-tight">
        RbNotes
      </span>
      <p className="font-body-sm text-body-sm text-on-surface-variant italic">
        &ldquo;{tagline}&rdquo;
      </p>
    </div>
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center justify-center my-space-1">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-outline-variant" />
      </div>
      <div className="relative bg-surface-container-lowest px-space-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest select-none">
        {label}
      </div>
    </div>
  );
}
